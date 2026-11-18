import type { BluetoothTransport } from '../bluetoothTransport';
import {
  RefractometerError,
  assertValidTds,
  type Refractometer,
  type RefractometerReading,
  type RefractometerStatus,
} from '../refractometer';
import { ScaleError } from '../scale';
import { DifluidFrameAssembler, type DifluidFrame } from './frame';
import { R2SingleTestCollector, r2Commands } from './r2';

export interface DifluidR2RefractometerOptions {
  /** For tests: supplies the current time for readings. */
  now?: () => Date;
  /**
   * How long to wait for a test to finish, in milliseconds. DiFluid does not state how long a
   * test takes, so the default is generous (60 seconds). Measure it on a real R2 and tighten it.
   */
  testTimeoutMs?: number;
  /**
   * After a test is cancelled or times out, the R2 may still send that test's frames, and DiFluid
   * documents no way to cancel a test on the device. To keep late frames from being mistaken for
   * the next test's result, a new test is refused for this long afterwards, in milliseconds.
   * The default (5000) is a safety margin, not a measured value. Tune it on a real R2.
   */
  settleMs?: number;
}

type ActiveTest = {
  collector: R2SingleTestCollector;
  resolve: (tdsPercent: number) => void;
  reject: (error: RefractometerError) => void;
};

/** The transports speak ScaleError. The refractometer side uses RefractometerError. */
function toRefractometerError(error: unknown): RefractometerError {
  if (error instanceof RefractometerError) return error;
  if (error instanceof ScaleError) return new RefractometerError(error.code, error.message);
  return new RefractometerError(
    'failed',
    error instanceof Error ? error.message : 'Something went wrong with the refractometer.',
  );
}

/**
 * The DiFluid R2 Extract, driven through a Bluetooth transport.
 *
 * Written only from DiFluid's open documentation and DiFluid support's email of 2026-11-18
 * (see docs/protocols/difluid-r2.md). NOT YET TESTED ON A REAL R2. The first things to check on
 * a real device are that the R2 is found by the service plus the name prefix, that it sends the
 * documented frames after the single-test command, and how long a test takes.
 *
 * Reading TDS = one single test: send the documented command, follow the frames the R2 sends
 * back (status, temperatures, result), and take the concentration from the result frame.
 * The sample must already be on the prism: if there is none, the R2 reports an error.
 */
export class DifluidR2Refractometer implements Refractometer {
  readonly id = 'difluid-r2';
  readonly label = 'DiFluid R2 Extract';
  readonly isDemo = false;

  private current: RefractometerStatus = 'disconnected';
  private readonly statusListeners = new Set<(status: RefractometerStatus) => void>();
  private readonly assembler = new DifluidFrameAssembler();
  private test: ActiveTest | null = null;
  private stopData: (() => void) | null = null;
  private stopLost: (() => void) | null = null;

  private readonly now: () => Date;
  private readonly testTimeoutMs: number;
  private readonly settleMs: number;
  /** A new test is refused until this time (ms), after a cancelled or timed-out test. */
  private busyUntilMs = 0;

  constructor(
    private readonly transport: BluetoothTransport,
    options: DifluidR2RefractometerOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.testTimeoutMs = options.testTimeoutMs ?? 60_000;
    this.settleMs = options.settleMs ?? 5000;
  }

  get status(): RefractometerStatus {
    return this.current;
  }

  onStatusChange(listener: (status: RefractometerStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(next: RefractometerStatus): void {
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

  private handleBytes(bytes: Uint8Array): void {
    for (const frame of this.assembler.push(bytes)) this.handleFrame(frame);
  }

  private handleFrame(frame: DifluidFrame): void {
    const test = this.test;
    if (!test) return; // Frames when no test was asked for are not ours to use.
    const progress = test.collector.push(frame);
    if (progress.state === 'done') {
      test.resolve(progress.tdsPercent);
    } else if (progress.state === 'failed') {
      if (progress.reason === 'device-error') {
        test.reject(
          new RefractometerError(
            'failed',
            `${progress.message} Check that there is sample on the prism, then try again.`,
          ),
        );
      } else if (progress.reason === 'invalid-tds') {
        test.reject(new RefractometerError('invalid-reading', progress.message));
      } else {
        test.reject(new RefractometerError('failed', progress.message));
      }
    }
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
    this.test?.reject(new RefractometerError('not-connected', 'The refractometer disconnected.'));
    try {
      await this.transport.disconnect();
    } catch {
      // Already closed.
    }
  }

  async connect(signal?: AbortSignal): Promise<void> {
    if (this.current === 'connected') return;
    this.setStatus('connecting');
    try {
      await this.transport.connect(signal);
      this.stopData = this.transport.onData((bytes) => this.handleBytes(bytes));
      this.stopLost = this.transport.onDisconnect(() => {
        this.stopListening();
        this.test?.reject(
          new RefractometerError('not-connected', 'The refractometer disconnected.'),
        );
        this.setStatus('disconnected');
      });
      this.setStatus('connected');
    } catch (error) {
      await this.closeTransport();
      this.setStatus('disconnected');
      throw toRefractometerError(error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.current === 'disconnected') return;
    await this.closeTransport();
    this.setStatus('disconnected');
  }

  async readTds(signal?: AbortSignal): Promise<RefractometerReading> {
    if (this.current !== 'connected') {
      throw new RefractometerError('not-connected', 'Connect to the refractometer first.');
    }
    if (this.test) {
      throw new RefractometerError('failed', 'A test is already running. Wait for it to finish.');
    }
    if (signal?.aborted) throw new RefractometerError('aborted', 'Cancelled.');
    if (this.now().getTime() < this.busyUntilMs) {
      throw new RefractometerError(
        'failed',
        'The refractometer may still be finishing the last test. Wait a few seconds, then try again.',
      );
    }

    let active!: ActiveTest;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;

    const done = new Promise<number>((resolve, reject) => {
      const settle = () => {
        clearTimeout(timer);
        if (onAbort) signal?.removeEventListener('abort', onAbort);
        if (this.test === active) this.test = null;
      };
      active = {
        collector: new R2SingleTestCollector(),
        resolve: (tdsPercent) => {
          settle();
          resolve(tdsPercent);
        },
        reject: (error) => {
          settle();
          reject(error);
        },
      };
      this.test = active;
      timer = setTimeout(() => {
        this.busyUntilMs = this.now().getTime() + this.settleMs;
        active.reject(
          new RefractometerError(
            'timeout',
            'The refractometer did not finish the test in time. Check that there is sample on the prism, then try again.',
          ),
        );
      }, this.testTimeoutMs);
      onAbort = () => {
        this.busyUntilMs = this.now().getTime() + this.settleMs;
        active.reject(new RefractometerError('aborted', 'Cancelled.'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
    done.catch(() => undefined); // Handled below; avoids an unhandled rejection if the write fails first.

    try {
      await this.transport.write(r2Commands.singleTest());
    } catch (error) {
      const failure = toRefractometerError(error);
      active.reject(failure);
      throw failure;
    }

    const tdsPercent = await done;
    assertValidTds(tdsPercent);
    return { tdsPercent, measuredAt: this.now().toISOString() };
  }
}
