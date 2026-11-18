import {
  ScaleError,
  assertValidWeight,
  type Scale,
  type ScaleStatus,
  type WeightReading,
} from './scale';

export interface SimulatedScaleOptions {
  /** How often a reading is sent while connected, in milliseconds. Default: 100. */
  intervalMs?: number;
  /** Set false to send readings only when emit() is called. Handy for tests. Default: true. */
  autoEmit?: boolean;
  /** Pretend delay in milliseconds for connecting and taring. Default: 300. */
  delayMs?: number;
  /** Make a step fail, to test error handling. */
  failOn?: 'connect' | 'tare';
  /** For tests: supplies the current time. */
  now?: () => Date;
}

/** Waits, but gives up early (and rejects with 'aborted') if the signal fires. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
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

/**
 * A pretend scale for building and demoing the live pour guide without hardware.
 * It makes up weights, so it always reports isDemo = true, and the lab must label anything
 * it produces as demo data.
 *
 * Use setWeight() to put a weight on it at once, or pourTo() to make the weight rise
 * smoothly, the way water does during a pour.
 */
export class SimulatedScale implements Scale {
  readonly id = 'simulated-scale';
  readonly label = 'Demo scale (simulated)';
  readonly isDemo = true;

  private current: ScaleStatus = 'disconnected';
  private latest: WeightReading | null = null;
  private statusListeners = new Set<(status: ScaleStatus) => void>();
  private weightListeners = new Set<(reading: WeightReading) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;

  /** What is physically on the scale, before tare. */
  private onScaleG = 0;
  /** The weight that counts as zero after a tare. */
  private zeroG = 0;
  private ramp: { fromG: number; toG: number; startMs: number; durationMs: number } | null = null;

  private readonly intervalMs: number;
  private readonly autoEmit: boolean;
  private readonly delayMs: number;
  private readonly failOn?: 'connect' | 'tare';
  private readonly now: () => Date;

  constructor(options: SimulatedScaleOptions = {}) {
    this.intervalMs = options.intervalMs ?? 100;
    this.autoEmit = options.autoEmit ?? true;
    this.delayMs = options.delayMs ?? 300;
    this.failOn = options.failOn;
    this.now = options.now ?? (() => new Date());
  }

  get status(): ScaleStatus {
    return this.current;
  }

  get lastReading(): WeightReading | null {
    return this.latest;
  }

  onStatusChange(listener: (status: ScaleStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onWeight(listener: (reading: WeightReading) => void): () => void {
    this.weightListeners.add(listener);
    return () => this.weightListeners.delete(listener);
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

  private stopTimer(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** The weight on the scale right now, following a pour if one is under way. */
  private onScaleNow(): number {
    if (!this.ramp) return this.onScaleG;
    const { fromG, toG, startMs, durationMs } = this.ramp;
    const elapsed = this.now().getTime() - startMs;
    if (durationMs <= 0 || elapsed >= durationMs) {
      this.onScaleG = toG;
      this.ramp = null;
      return toG;
    }
    return fromG + ((toG - fromG) * Math.max(0, elapsed)) / durationMs;
  }

  /** Puts a weight on the scale at once (grams, before any tare). */
  setWeight(weightG: number): void {
    this.ramp = null;
    this.onScaleG = weightG;
  }

  /** Adds (or takes off) grams at once, like a splash of water. Stops any pour under way. */
  addWeight(deltaG: number): void {
    this.onScaleG = this.onScaleNow() + deltaG;
    this.ramp = null;
  }

  /** Puts a weight on the scale so that the display shows exactly this (after tare). */
  setShownWeight(shownG: number): void {
    this.ramp = null;
    this.onScaleG = this.zeroG + shownG;
  }

  /**
   * Makes the weight rise (or fall) smoothly over a time, like a pour. The target is the weight
   * the scale will SHOW (after tare), which is what a recipe step's target weight means.
   */
  pourTo(targetWeightG: number, durationMs: number): void {
    this.ramp = {
      fromG: this.onScaleNow(),
      toG: this.zeroG + targetWeightG,
      startMs: this.now().getTime(),
      durationMs,
    };
  }

  /**
   * Sends one reading to every listener now. Called by the timer when autoEmit is on, and by
   * tests or demos directly. Does nothing unless connected.
   */
  emit(): void {
    if (this.current !== 'connected') return;
    const weightG = this.onScaleNow() - this.zeroG;
    try {
      assertValidWeight(weightG);
    } catch {
      return; // Never send a reading that cannot be a weight.
    }
    const reading: WeightReading = { weightG, measuredAt: this.now().toISOString() };
    this.latest = reading;
    for (const listener of [...this.weightListeners]) {
      try {
        listener(reading);
      } catch {
        // A broken listener must not stop the others or the stream.
      }
    }
  }

  async connect(signal?: AbortSignal): Promise<void> {
    if (this.current === 'connected') return;
    this.setStatus('connecting');
    try {
      await wait(this.delayMs, signal);
      if (this.failOn === 'connect') {
        throw new ScaleError('failed', 'The simulated scale refused to connect.');
      }
      this.latest = null;
      this.setStatus('connected');
      if (this.autoEmit) this.timer = setInterval(() => this.emit(), this.intervalMs);
    } catch (error) {
      this.setStatus('disconnected');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopTimer();
    this.setStatus('disconnected');
  }

  async tare(signal?: AbortSignal): Promise<void> {
    if (this.current !== 'connected') {
      throw new ScaleError('not-connected', 'Connect to the scale first.');
    }
    await wait(this.delayMs, signal);
    if (this.current !== 'connected') {
      throw new ScaleError('not-connected', 'The scale was disconnected.');
    }
    if (this.failOn === 'tare') {
      throw new ScaleError('failed', 'The simulated scale could not tare.');
    }
    this.zeroG = this.onScaleNow();
  }
}
