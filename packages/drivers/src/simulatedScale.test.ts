import { describe, expect, it } from 'vitest';
import type { WeightReading } from './scale';
import { SimulatedScale } from './simulatedScale';
import { describeScaleContract } from './testing/scaleContract';

// The simulated scale must pass the same contract a real scale will have to pass.
describeScaleContract('SimulatedScale', () => new SimulatedScale({ intervalMs: 5, delayMs: 5 }));

/** A scale whose clock only moves when the test says so, and that sends readings only on emit(). */
function steadyScale(options: { failOn?: 'connect' | 'tare' } = {}) {
  let ms = 1_700_000_000_000;
  const scale = new SimulatedScale({
    autoEmit: false,
    delayMs: 0,
    now: () => new Date(ms),
    ...options,
  });
  const readings: WeightReading[] = [];
  scale.onWeight((r) => readings.push(r));
  return {
    scale,
    readings,
    advance: (milliseconds: number) => (ms += milliseconds),
    shown: () => {
      scale.emit();
      return readings[readings.length - 1]?.weightG;
    },
  };
}

describe('SimulatedScale', () => {
  it('is always marked as demo and says so in its label', () => {
    const scale = new SimulatedScale();
    expect(scale.isDemo).toBe(true);
    expect(scale.label.toLowerCase()).toContain('simulated');
  });

  it('sends nothing until it is connected', async () => {
    const { scale, readings } = steadyScale();
    scale.emit();
    expect(readings).toHaveLength(0);
    await scale.connect();
    scale.emit();
    expect(readings).toHaveLength(1);
  });

  it('shows what is put on it, and stamps readings with the time it was given', async () => {
    const { scale, readings, shown } = steadyScale();
    await scale.connect();
    scale.setWeight(50);
    expect(shown()).toBe(50);
    expect(readings[0]?.measuredAt).toBe('2023-11-14T22:13:20.000Z');
  });

  it('tare makes the current weight read zero, and weight added after it counts from there', async () => {
    const { scale, shown } = steadyScale();
    await scale.connect();
    scale.setWeight(50);
    await scale.tare();
    expect(shown()).toBe(0);
    scale.setWeight(80);
    expect(shown()).toBe(30);
  });

  it('can read slightly negative when something is lifted off after a tare', async () => {
    const { scale, shown } = steadyScale();
    await scale.connect();
    scale.setWeight(50);
    await scale.tare();
    scale.setWeight(0);
    expect(shown()).toBe(-50);
  });

  it('pours smoothly to a target, then holds it', async () => {
    const { scale, shown, advance } = steadyScale();
    await scale.connect();
    scale.pourTo(40, 8000);
    expect(shown()).toBe(0);
    advance(4000);
    expect(shown()).toBe(20);
    advance(4000);
    expect(shown()).toBe(40);
    advance(5000);
    expect(shown()).toBe(40);
  });

  it('a pour target means the weight the scale will show, even after a tare', async () => {
    const { scale, shown, advance } = steadyScale();
    await scale.connect();
    scale.setWeight(5); // an empty server weighing 5 g
    await scale.tare();
    scale.pourTo(100, 1000);
    advance(1000);
    expect(shown()).toBe(100);
  });

  it('a second pour carries on from where the first one had got to', async () => {
    const { scale, shown, advance } = steadyScale();
    await scale.connect();
    scale.pourTo(40, 1000);
    advance(1000);
    scale.pourTo(100, 1000);
    advance(500);
    expect(shown()).toBe(70);
  });

  it('adds weight by hand, counted from the display after a tare', async () => {
    const { scale, shown } = steadyScale();
    await scale.connect();
    scale.setWeight(30);
    await scale.tare();
    scale.addWeight(10);
    expect(shown()).toBe(10);
    scale.addWeight(50);
    expect(shown()).toBe(60);
    scale.addWeight(-20);
    expect(shown()).toBe(40);
  });

  it('adding weight in the middle of a pour stops the pour where it is', async () => {
    const { scale, shown, advance } = steadyScale();
    await scale.connect();
    scale.pourTo(100, 1000);
    advance(500);
    scale.addWeight(10);
    advance(5000);
    expect(shown()).toBe(60);
  });

  it('can be told what to show, even after a tare', async () => {
    const { scale, shown } = steadyScale();
    await scale.connect();
    scale.setWeight(25);
    await scale.tare();
    scale.setShownWeight(0);
    expect(shown()).toBe(0);
    scale.setShownWeight(123.4);
    expect(shown()).toBeCloseTo(123.4, 10);
  });

  it('follows the pour weights of The Sulong Pour: 40, 220, 310', async () => {
    const { scale, shown, advance } = steadyScale();
    await scale.connect();
    const seen: number[] = [];
    for (const [target, ms] of [
      [40, 5000],
      [220, 20000],
      [310, 10000],
    ] as const) {
      scale.pourTo(target, ms);
      advance(ms);
      seen.push(shown() as number);
    }
    expect(seen).toEqual([40, 220, 310]);
  });

  it('never sends a weight that cannot be real', async () => {
    const { scale, readings } = steadyScale();
    await scale.connect();
    scale.setWeight(Number.NaN);
    scale.emit();
    expect(readings).toHaveLength(0);
    expect(scale.lastReading).toBeNull();
  });

  it('forgets the last reading when it reconnects', async () => {
    const { scale, shown } = steadyScale();
    await scale.connect();
    shown();
    expect(scale.lastReading).not.toBeNull();
    await scale.disconnect();
    await scale.connect();
    expect(scale.lastReading).toBeNull();
  });

  it('can be made to fail when connecting, and ends up disconnected', async () => {
    const { scale } = steadyScale({ failOn: 'connect' });
    await expect(scale.connect()).rejects.toMatchObject({ code: 'failed' });
    expect(scale.status).toBe('disconnected');
  });

  it('can be made to fail when taring, and stays connected', async () => {
    const { scale } = steadyScale({ failOn: 'tare' });
    await scale.connect();
    await expect(scale.tare()).rejects.toMatchObject({ code: 'failed' });
    expect(scale.status).toBe('connected');
  });

  it('notices a disconnect that happens while taring', async () => {
    const scale = new SimulatedScale({ autoEmit: false, delayMs: 20 });
    await scale.connect();
    const attempt = scale.tare();
    await scale.disconnect();
    await expect(attempt).rejects.toMatchObject({ code: 'not-connected' });
  });
});
