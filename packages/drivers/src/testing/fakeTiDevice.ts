import type { BluetoothTransport } from '../bluetoothTransport';
import { ScaleError } from '../scale';
import { decodeDifluidFrame, encodeDifluidFrame } from '../difluid/frame';

export interface FakeTiDeviceOptions {
  /** Pretend delay for connecting and for answering a command, in milliseconds. Default: 2. */
  delayMs?: number;
  /** How often a weight is sent once weight sending is on, in milliseconds. Default: 5. */
  intervalMs?: number;
  /** Cut every notification into pieces of this many bytes, like a small Bluetooth packet size. */
  chunkSize?: number;
  /** The unit the fake scale starts set to: 0 gram, 1 ounce, 2 gering. Default 0. */
  unitCode?: number;
  /** Start by sending each weight with the top bit set, like a negative number might be. */
  topBitWeights?: boolean;
  /** Send a stray byte before every weight frame. */
  noise?: boolean;
  /** Never answer the command that switches weight sending on (and never send weights). */
  ignoreAutoSend?: boolean;
  /** Never answer the tare command. */
  ignoreTare?: boolean;
  /** Fail to connect with this code. */
  failConnect?: 'failed' | 'unavailable';
}

/**
 * A stand-in for a Microbalance Ti that behaves the way DiFluid's document says the real one does:
 * it repeats commands back, sends weights after the auto-send command, and zeroes on tare.
 * It is only a test double. The real device has not been tried.
 */
export class FakeTiDevice implements BluetoothTransport {
  /** Every command frame the driver sent, in order, as spaced hex. */
  readonly received: number[][] = [];

  private open = false;
  private streaming = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private placedTenths = 0;
  private zeroTenths = 0;
  private dataListeners = new Set<(bytes: Uint8Array) => void>();
  private lostListeners = new Set<() => void>();
  private tick = 0;

  private readonly delayMs: number;
  private readonly intervalMs: number;

  /** Can be changed while running, to show a scale that starts or stops sending odd weights. */
  topBitWeights: boolean;
  /** Can be changed while running: 0 gram, 1 ounce, 2 gering. */
  unitCode: number;

  constructor(private readonly options: FakeTiDeviceOptions = {}) {
    this.delayMs = options.delayMs ?? 2;
    this.intervalMs = options.intervalMs ?? 5;
    this.topBitWeights = options.topBitWeights ?? false;
    this.unitCode = options.unitCode ?? 0;
  }

  /** Puts a weight on the fake scale, in grams (before tare). */
  place(weightG: number): void {
    this.placedTenths = Math.round(weightG * 10);
  }

  /** What the fake scale's display shows, in grams. */
  get shownG(): number {
    return (this.placedTenths - this.zeroTenths) / 10;
  }

  /** Pretends the connection was lost (the scale went to sleep, or moved out of range). */
  dropConnection(): void {
    if (!this.open) return;
    this.stop();
    this.open = false;
    for (const listener of [...this.lostListeners]) listener();
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
    this.stop();
    this.open = false;
  }

  private stop(): void {
    this.streaming = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (!this.open) throw new ScaleError('not-connected', 'The fake device is not connected.');
    this.received.push(Array.from(bytes));
    const decoded = decodeDifluidFrame(bytes);
    if (!decoded.ok) return;
    const { func, cmd, data } = decoded.frame;

    // Weight sending on or off (Func 1, Cmd 0).
    if (func === 1 && cmd === 0) {
      if (this.options.ignoreAutoSend) return;
      this.reply(bytes);
      if (data[0] === 1) this.startStreaming();
      else this.stop();
      return;
    }
    // Tare (Func 3, Cmd 2, data 01 = power button).
    if (func === 3 && cmd === 2 && data[0] === 1) {
      if (this.options.ignoreTare) return;
      this.zeroTenths = this.placedTenths;
      this.reply(bytes);
      return;
    }
    // Device status: idle, battery 100 percent, charging.
    if (func === 3 && cmd === 5) {
      this.reply(encodeDifluidFrame(3, 5, [5, 100, 1, 0, 0, 0, 0, 0]));
      return;
    }
    // One weight on request.
    if (func === 3 && cmd === 0) {
      this.reply(this.weightFrame());
    }
  }

  private weightFrame(): Uint8Array {
    this.tick += 1;
    let raw = this.placedTenths - this.zeroTenths;
    if (this.unitCode === 1) {
      // Ounces x 1000: convert the shown grams.
      raw = Math.round((raw / 10 / 28.349523125) * 1000);
    }
    if (this.topBitWeights) raw = (0xffffff00 + (raw & 0xff)) >>> 0;
    const tick = this.tick;
    return encodeDifluidFrame(3, 0, [
      (raw >>> 24) & 0xff,
      (raw >>> 16) & 0xff,
      (raw >>> 8) & 0xff,
      raw & 0xff,
      0,
      0,
      0,
      0,
      (tick >>> 24) & 0xff,
      (tick >>> 16) & 0xff,
      (tick >>> 8) & 0xff,
      tick & 0xff,
      this.unitCode,
    ]);
  }

  private startStreaming(): void {
    if (this.streaming) return;
    this.streaming = true;
    this.timer = setInterval(() => {
      if (!this.open || !this.streaming) return;
      if (this.options.noise) this.emit(new Uint8Array([0x00]));
      this.emit(this.weightFrame());
    }, this.intervalMs);
  }

  private reply(bytes: Uint8Array): void {
    const copy = Uint8Array.from(bytes);
    setTimeout(() => {
      if (this.open) this.emit(copy);
    }, this.delayMs);
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
