import type { BluetoothTransport } from '../bluetoothTransport';
import { ScaleError, type Scale, type ScaleStatus, type WeightReading } from '../scale';
import { DifluidFrameAssembler, type DifluidFrame } from './frame';
import { parseTiFrame, tiCommands, type TiMessage } from './ti';

export interface DifluidTiScaleOptions {
  /** For tests: supplies the current time for readings. */
  now?: () => Date;
  /** How long to wait for the scale to answer a command, in milliseconds. Default: 3000. */
  replyTimeoutMs?: number;
}

type Waiter = {
  match: (message: TiMessage) => boolean;
  resolve: () => void;
  reject: (error: ScaleError) => void;
};

/**
 * The DiFluid Microbalance Ti, driven through a Bluetooth transport.
 *
 * Written only from DiFluid's open documentation (see docs/protocols/difluid-microbalance-ti.md).
 * NOT YET TESTED ON A REAL SCALE. The first things to check on a real device are how a weight
 * below zero is sent (readings that DiFluid's document does not explain are ignored, and shown as
 * a problem) and whether the scale really sends weights after the auto-send command.
 *
 * What it does:
 * - connect: opens the connection, switches weight sending on, and waits for the scale to answer.
 * - tare: sends the tare command and waits for the scale to repeat it back.
 * - weights: every weight frame becomes a reading, in grams (an ounce setting is converted).
 * - it never changes the scale's unit or other settings, except weight sending.
 */
export class DifluidTiScale implements Scale {
  readonly id = 'difluid-microbalance-ti';
  readonly label = 'DiFluid Microbalance Ti';
  readonly isDemo = false;

  private current: ScaleStatus = 'disconnected';
  private latest: WeightReading | null = null;
  private problem: string | null = null;
  private battery: { percent: number; charging: boolean } | null = null;

  private readonly assembler = new DifluidFrameAssembler();
  private readonly statusListeners = new Set<(status: ScaleStatus) => void>();
  private readonly weightListeners = new Set<(reading: WeightReading) => void>();
  private readonly problemListeners = new Set<(message: string | null) => void>();
  private waiters: Waiter[] = [];
  private stopData: (() => void) | null = null;
  private stopLost: (() => void) | null = null;

  private readonly now: () => Date;
  private readonly replyTimeoutMs: number;

  constructor(
    private readonly transport: BluetoothTransport,
    options: DifluidTiScaleOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.replyTimeoutMs = options.replyTimeoutMs ?? 3000;
  }

  get status(): ScaleStatus {
    return this.current;
  }

  get lastReading(): WeightReading | null {
    return this.latest;
  }

  /** Battery level and charging state, from the last status message. Null until one arrives. */
  get batteryStatus(): { percent: number; charging: boolean } | null {
    return this.battery;
  }

  onStatusChange(listener: (status: ScaleStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onWeight(listener: (reading: WeightReading) => void): () => void {
    this.weightListeners.add(listener);
    return () => this.weightListeners.delete(listener);
  }

  onProblem(listener: (message: string | null) => void): () => void {
    this.problemListeners.add(listener);
    return () => this.problemListeners.delete(listener);
  }

  private setStatus(next: ScaleStatus): void {
    if (next === this.current) return;
    this.current = next;
    for (const listener of [...this.statusListeners]) {
      try {
        listener(next);
      } catch {
        // A broken listener must not stop the others.
      }
    }
  }

  private setProblem(message: string | null): void {
    if (message === this.problem) return;
    this.problem = message;
    for (const listener of [...this.problemListeners]) {
      try {
        listener(message);
      } catch {
        // A broken listener must not stop the others.
      }
    }
  }

  /** Waits for a message from the scale. Rejects on timeout, on cancel, or if the link closes. */
  private waitFor(match: (message: TiMessage) => boolean, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new ScaleError('aborted', 'Cancelled.'));
        return;
      }
      const finish = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        this.waiters = this.waiters.filter((w) => w !== waiter);
      };
      const waiter: Waiter = {
        match,
        resolve: () => {
          finish();
          resolve();
        },
        reject: (error) => {
          finish();
          reject(error);
        },
      };
      const timer = setTimeout(
        () => waiter.reject(new ScaleError('timeout', 'The scale did not answer in time.')),
        this.replyTimeoutMs,
      );
      const onAbort = () => waiter.reject(new ScaleError('aborted', 'Cancelled.'));
      signal?.addEventListener('abort', onAbort, { once: true });
      this.waiters.push(waiter);
    });
  }

  private rejectWaiters(error: ScaleError): void {
    for (const waiter of [...this.waiters]) waiter.reject(error);
  }

  private handleBytes(bytes: Uint8Array): void {
    for (const frame of this.assembler.push(bytes)) this.handleFrame(frame);
  }

  private handleFrame(frame: DifluidFrame): void {
    const parsed = parseTiFrame(frame);
    if (!parsed.ok) {
      this.setProblem(parsed.message);
      return;
    }
    const message = parsed.message;

    for (const waiter of [...this.waiters]) if (waiter.match(message)) waiter.resolve();

    if (message.type === 'weight') {
      const reading: WeightReading = {
        weightG: message.weightG,
        measuredAt: this.now().toISOString(),
      };
      this.latest = reading;
      this.setProblem(null);
      for (const listener of [...this.weightListeners]) {
        try {
          listener(reading);
        } catch {
          // A broken listener must not stop the others or the stream.
        }
      }
    } else if (message.type === 'status') {
      this.battery = { percent: message.batteryPercent, charging: message.charging };
    }
  }

  private handleLost(): void {
    this.stopListening();
    this.rejectWaiters(new ScaleError('not-connected', 'The scale disconnected.'));
    this.setStatus('disconnected');
  }

  private stopListening(): void {
    this.stopData?.();
    this.stopLost?.();
    this.stopData = null;
    this.stopLost = null;
    this.assembler.reset();
  }

  private async closeTransport(): Promise<void> {
    this.stopListening();
    this.rejectWaiters(new ScaleError('not-connected', 'The scale disconnected.'));
    try {
      await this.transport.disconnect();
    } catch {
      // Already closed.
    }
  }

  async connect(signal?: AbortSignal): Promise<void> {
    if (this.current === 'connected') return;
    this.setStatus('connecting');
    this.latest = null;
    this.setProblem(null);
    try {
      await this.transport.connect(signal);
      this.stopData = this.transport.onData((bytes) => this.handleBytes(bytes));
      this.stopLost = this.transport.onDisconnect(() => this.handleLost());

      // Switch weight sending on. The scale answers by repeating the command (DiFluid's
      // document), and a weight arriving also proves it is sending.
      const confirmed = this.waitFor(
        (m) => (m.type === 'ack' && m.func === 1 && m.cmd === 0) || m.type === 'weight',
        signal,
      );
      confirmed.catch(() => undefined); // Handled below; avoids an unhandled rejection if the write fails first.
      await this.transport.write(tiCommands.autoSend(true));
      await confirmed;

      this.setStatus('connected');
    } catch (error) {
      await this.closeTransport();
      this.setStatus('disconnected');
      throw error instanceof ScaleError
        ? error
        : new ScaleError('failed', error instanceof Error ? error.message : 'Could not connect.');
    }
  }

  async disconnect(): Promise<void> {
    if (this.current === 'disconnected') return;
    if (this.current === 'connected') {
      try {
        // Leave weight sending off, as it was in DiFluid's example. Not a problem if it fails.
        await this.transport.write(tiCommands.autoSend(false));
      } catch {
        // The link may already be gone.
      }
    }
    await this.closeTransport();
    this.setStatus('disconnected');
  }

  /** Asks the scale for its battery level and charging state. */
  async readBattery(signal?: AbortSignal): Promise<{ percent: number; charging: boolean }> {
    if (this.current !== 'connected') {
      throw new ScaleError('not-connected', 'Connect to the scale first.');
    }
    const answered = this.waitFor((m) => m.type === 'status', signal);
    answered.catch(() => undefined);
    await this.transport.write(tiCommands.getDeviceStatus());
    await answered;
    if (!this.battery) throw new ScaleError('failed', 'The scale did not report its battery.');
    return this.battery;
  }

  async tare(signal?: AbortSignal): Promise<void> {
    if (this.current !== 'connected') {
      throw new ScaleError('not-connected', 'Connect to the scale first.');
    }
    // The scale repeats the tare command (Power Button Single Click, data 01) when it has done it.
    const confirmed = this.waitFor(
      (m) => m.type === 'ack' && m.func === 3 && m.cmd === 2 && m.data[0] === 1,
      signal,
    );
    confirmed.catch(() => undefined);
    try {
      await this.transport.write(tiCommands.tare());
    } catch (error) {
      this.rejectWaiters(new ScaleError('failed', 'The tare command could not be sent.'));
      throw error instanceof ScaleError
        ? error
        : new ScaleError('failed', 'The tare command could not be sent.');
    }
    await confirmed;
  }
}
