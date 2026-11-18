import type { BluetoothTransport } from '../bluetoothTransport';
import { ScaleError } from '../scale';
import { decodeDifluidFrame, encodeDifluidFrame } from '../difluid/frame';

export type FakeR2Mode =
  /** Answers a test the way DiFluid's document shows: status, status, temperatures, result. */
  | 'normal'
  /** Reports an error frame instead of a result (for example no liquid on the prism). */
  | 'error'
  /** Sends a result with a concentration of zero. */
  | 'zero'
  /** Starts the test but never sends a result. */
  | 'unfinished'
  /** Never answers anything. */
  | 'silent'
  /** Sends the frames from DiFluid's average-test example whose concentration reads FF F9. */
  | 'top-bit';

export interface FakeR2DeviceOptions {
  /** TDS values, in percent, given to successive tests, then repeated. Default: 1.41, 1.38, 1.45. */
  tdsValues?: number[];
  /** Pretend delay for connecting and between frames, in milliseconds. Default: 2. */
  delayMs?: number;
  /** Cut every notification into pieces of this many bytes. */
  chunkSize?: number;
  mode?: FakeR2Mode;
  /** Send a stray byte before every frame. */
  noise?: boolean;
  failConnect?: 'failed' | 'unavailable';
}

/**
 * A stand-in for an R2 that answers the way DiFluid's document shows. It is only a test double:
 * the real device has not been tried.
 */
export class FakeR2Device implements BluetoothTransport {
  /** Every command the driver sent, as bytes. */
  readonly received: number[][] = [];
  /** Can be changed while running. */
  mode: FakeR2Mode;

  private open = false;
  private count = 0;
  private dataListeners = new Set<(bytes: Uint8Array) => void>();
  private lostListeners = new Set<() => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();

  private readonly delayMs: number;
  private readonly tdsValues: number[];

  constructor(private readonly options: FakeR2DeviceOptions = {}) {
    this.delayMs = options.delayMs ?? 2;
    this.tdsValues = options.tdsValues ?? [1.41, 1.38, 1.45];
    this.mode = options.mode ?? 'normal';
  }

  dropConnection(): void {
    if (!this.open) return;
    this.clearTimers();
    this.open = false;
    for (const listener of [...this.lostListeners]) listener();
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  private wait(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new ScaleError('aborted', 'Cancelled.'));
        return;
      }
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new ScaleError('aborted', 'Cancelled.'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  async connect(signal?: AbortSignal): Promise<void> {
    if (this.open) return;
    await this.wait(this.delayMs, signal);
    if (this.options.failConnect) {
      throw new ScaleError(this.options.failConnect, 'The fake device refused to connect.');
    }
    this.open = true;
  }

  async disconnect(): Promise<void> {
    this.clearTimers();
    this.open = false;
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (!this.open) throw new ScaleError('not-connected', 'The fake device is not connected.');
    this.received.push(Array.from(bytes));
    const decoded = decodeDifluidFrame(bytes);
    if (!decoded.ok) return;
    const { func, cmd } = decoded.frame;
    // Single test (Func 3, Cmd 0).
    if (func === 3 && cmd === 0 && this.mode !== 'silent') this.runTest();
  }

  private runTest(): void {
    const tds = this.tdsValues[this.count % this.tdsValues.length] ?? 1;
    // Only a test that produces a result uses up one of the values.
    if (this.mode === 'normal') this.count += 1;
    const concentration = this.mode === 'zero' ? 0 : Math.round(tds * 100);
    const frames: Uint8Array[] = [
      encodeDifluidFrame(3, 0, [0, 0x0b, 0]), // test started
      encodeDifluidFrame(3, 0, [0, 0x00, 0]), // test finished
      encodeDifluidFrame(3, 0, [1, 0x03, 0x17, 0x03, 0x14, 0x01]), // temperatures
    ];
    if (this.mode === 'unfinished') {
      frames.length = 1;
    } else if (this.mode === 'error') {
      frames.length = 1;
      frames.push(encodeDifluidFrame(3, 254, [2, 3]));
    } else if (this.mode === 'top-bit') {
      frames.length = 1;
      frames.push(encodeDifluidFrame(3, 0, [2, 0xff, 0xf9, 0x00, 0x02, 0x08, 0xa6]));
    } else {
      // Result: concentration x 100 (two bytes), refractive index x 100000 (four bytes).
      frames.push(
        encodeDifluidFrame(3, 0, [
          2,
          (concentration >>> 8) & 0xff,
          concentration & 0xff,
          0x00,
          0x02,
          0x09,
          0x3d,
        ]),
      );
    }
    frames.forEach((frame, i) => {
      const timer = setTimeout(
        () => {
          this.timers.delete(timer);
          if (!this.open) return;
          if (this.options.noise) this.emit(new Uint8Array([0x00]));
          this.emit(frame);
        },
        this.delayMs * (i + 1),
      );
      this.timers.add(timer);
    });
  }

  private emit(bytes: Uint8Array): void {
    const size = this.options.chunkSize;
    const pieces: Uint8Array[] = [];
    if (size && size > 0) {
      for (let i = 0; i < bytes.length; i += size) pieces.push(bytes.subarray(i, i + size));
    } else {
      pieces.push(bytes);
    }
    for (const piece of pieces) {
      for (const listener of [...this.dataListeners]) listener(Uint8Array.from(piece));
    }
  }

  onData(listener: (bytes: Uint8Array) => void): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onDisconnect(listener: () => void): () => void {
    this.lostListeners.add(listener);
    return () => this.lostListeners.delete(listener);
  }
}
