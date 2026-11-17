/**
 * A clock that can run faster than real time. The live brew uses one clock for both its timer
 * and the demo scale, so "4x" makes the whole brew, including the demo pour, run four times
 * faster while everything stays in step.
 */
export class ScaledClock {
  private virtualMs: number;
  private lastRealMs: number;
  private currentSpeed: number;

  /**
   * @param speed how many times faster than real time (1 = real time).
   * @param realNow supplies real elapsed milliseconds. Passed in so tests can control it.
   * @param startMs the virtual time to begin at (default: the real time of day).
   */
  constructor(
    speed = 1,
    private readonly realNow: () => number = () => performance.now(),
    startMs: number = Date.now(),
  ) {
    this.currentSpeed = speed;
    this.virtualMs = startMs;
    this.lastRealMs = this.realNow();
  }

  get speed(): number {
    return this.currentSpeed;
  }

  /** The current virtual time in milliseconds, in the same scale as Date.now(). */
  nowMs(): number {
    const real = this.realNow();
    this.virtualMs += (real - this.lastRealMs) * this.currentSpeed;
    this.lastRealMs = real;
    return this.virtualMs;
  }

  /** Changes the speed from now on. Time already passed is kept at the old speed. */
  setSpeed(speed: number): void {
    this.nowMs();
    this.currentSpeed = speed;
  }

  /** The current virtual time as a Date. */
  now(): Date {
    return new Date(this.nowMs());
  }
}
