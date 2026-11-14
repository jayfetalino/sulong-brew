import {
  RefractometerError,
  assertValidTds,
  type Refractometer,
  type RefractometerReading,
  type RefractometerStatus,
} from './refractometer';

export interface SimulatedRefractometerOptions {
  /** TDS values to hand out, in order, then start again. Default: 1.41, 1.38, 1.45. */
  readings?: number[];
  /** Pretend delay in milliseconds for connecting and for each reading. Default: 400. */
  delayMs?: number;
  /** Make a step fail, to test error handling. */
  failOn?: 'connect' | 'read';
  /** For tests: supplies the current time. */
  now?: () => Date;
}

const DEFAULT_READINGS = [1.41, 1.38, 1.45];

/** Waits, but gives up early (and rejects with 'aborted') if the signal fires. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RefractometerError('aborted', 'Cancelled.'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new RefractometerError('aborted', 'Cancelled.'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * A pretend refractometer for building and demoing the app without hardware.
 * It makes up numbers, so it always reports isDemo = true, and the lab must label
 * anything it produces as a demo reading.
 */
export class SimulatedRefractometer implements Refractometer {
  readonly id = 'simulated-r2';
  readonly label = 'Demo refractometer (simulated)';
  readonly isDemo = true;

  private current: RefractometerStatus = 'disconnected';
  private listeners = new Set<(status: RefractometerStatus) => void>();
  private nextIndex = 0;
  private readonly readings: number[];
  private readonly delayMs: number;
  private readonly failOn?: 'connect' | 'read';
  private readonly now: () => Date;

  constructor(options: SimulatedRefractometerOptions = {}) {
    this.readings = options.readings ?? DEFAULT_READINGS;
    this.delayMs = options.delayMs ?? 400;
    this.failOn = options.failOn;
    this.now = options.now ?? (() => new Date());
  }

  get status(): RefractometerStatus {
    return this.current;
  }

  onStatusChange(listener: (status: RefractometerStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(next: RefractometerStatus): void {
    if (next === this.current) return;
    this.current = next;
    for (const listener of [...this.listeners]) listener(next);
  }

  async connect(signal?: AbortSignal): Promise<void> {
    if (this.current === 'connected') return;
    this.setStatus('connecting');
    try {
      await wait(this.delayMs, signal);
      if (this.failOn === 'connect') {
        throw new RefractometerError('failed', 'The simulated device refused to connect.');
      }
      this.setStatus('connected');
    } catch (error) {
      this.setStatus('disconnected');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.setStatus('disconnected');
  }

  async readTds(signal?: AbortSignal): Promise<RefractometerReading> {
    if (this.current !== 'connected') {
      throw new RefractometerError('not-connected', 'Connect to the refractometer first.');
    }
    await wait(this.delayMs, signal);
    if (this.current !== 'connected') {
      throw new RefractometerError('not-connected', 'The refractometer was disconnected.');
    }
    if (this.failOn === 'read') {
      throw new RefractometerError('failed', 'The simulated device could not take a reading.');
    }
    const tdsPercent = this.readings[this.nextIndex % this.readings.length];
    this.nextIndex += 1;
    if (tdsPercent === undefined) {
      throw new RefractometerError('failed', 'The simulated device has no readings.');
    }
    assertValidTds(tdsPercent);
    return { tdsPercent, measuredAt: this.now().toISOString() };
  }
}
