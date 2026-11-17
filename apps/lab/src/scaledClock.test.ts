import { describe, expect, it } from 'vitest';
import { ScaledClock } from './scaledClock';

/** Real time that only moves when the test says so. */
function fakeReal() {
  let ms = 0;
  return { now: () => ms, advance: (n: number) => (ms += n) };
}

describe('ScaledClock', () => {
  it('runs at real speed by default', () => {
    const real = fakeReal();
    const clock = new ScaledClock(1, real.now, 1000);
    real.advance(2500);
    expect(clock.nowMs()).toBe(3500);
  });

  it('runs faster when the speed is higher', () => {
    const real = fakeReal();
    const clock = new ScaledClock(4, real.now, 0);
    real.advance(1000);
    expect(clock.nowMs()).toBe(4000);
  });

  it('keeps time already passed at the old speed when the speed changes', () => {
    const real = fakeReal();
    const clock = new ScaledClock(1, real.now, 0);
    real.advance(1000); // 1000 virtual ms
    clock.setSpeed(4);
    real.advance(1000); // 4000 more
    expect(clock.nowMs()).toBe(5000);
    clock.setSpeed(2);
    real.advance(500); // 1000 more
    expect(clock.nowMs()).toBe(6000);
    expect(clock.speed).toBe(2);
  });

  it('does not jump when read many times without time passing', () => {
    const real = fakeReal();
    const clock = new ScaledClock(2, real.now, 100);
    expect(clock.nowMs()).toBe(100);
    expect(clock.nowMs()).toBe(100);
    real.advance(10);
    expect(clock.nowMs()).toBe(120);
  });

  it('gives a Date in the same scale as Date.now()', () => {
    const real = fakeReal();
    const clock = new ScaledClock(1, real.now, Date.UTC(2026, 10, 16, 12));
    real.advance(60_000);
    expect(clock.now().toISOString()).toBe('2026-11-16T12:01:00.000Z');
  });
});
