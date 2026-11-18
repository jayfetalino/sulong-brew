import { describe, expect, it } from 'vitest';
import { DifluidTiScale, ScaleError, SimulatedScale } from '@sulong/drivers';
import {
  DEMO_SCALE_ID,
  TI_EXPERIMENTAL_NOTE,
  TI_SCALE_ID,
  connectScale,
  describeScaleError,
  listScaleOptions,
  tareScale,
} from './scaleFlow';

const EM_DASH = String.fromCharCode(0x2014);

describe('listScaleOptions', () => {
  const supported = { supported: true, reason: '' };

  it('offers a demo scale, and the DiFluid Microbalance Ti when Bluetooth works', () => {
    const [demo, ti] = listScaleOptions(supported);
    expect(demo).toMatchObject({
      id: DEMO_SCALE_ID,
      isDemo: true,
      available: true,
      experimentalNote: null,
    });
    expect(demo?.create?.()).toBeInstanceOf(SimulatedScale);
    expect(ti).toMatchObject({ id: TI_SCALE_ID, isDemo: false, available: true });
    expect(ti?.create?.()).toBeInstanceOf(DifluidTiScale);
  });

  it('marks the Ti experimental, and says plainly that it has not been tried on a real scale', () => {
    const ti = listScaleOptions(supported)[1];
    expect(ti?.label).toContain('experimental');
    expect(ti?.experimentalNote).toBe(TI_EXPERIMENTAL_NOTE);
    expect(TI_EXPERIMENTAL_NOTE).toContain('not been tried with a real scale');
    expect(TI_EXPERIMENTAL_NOTE).toContain("scale's own screen");
  });

  it('makes a fresh Ti scale each time, which is a real (not demo) scale', () => {
    const ti = listScaleOptions(supported)[1];
    const a = ti?.create?.();
    const b = ti?.create?.();
    expect(a).not.toBe(b);
    expect(a?.isDemo).toBe(false);
    expect(a?.status).toBe('disconnected');
  });

  it('turns the Ti off, with the reason, when Bluetooth is not supported', () => {
    const [, ti] = listScaleOptions({
      supported: false,
      reason: 'This browser cannot use Bluetooth from a web page. Use Chrome on a Mac.',
    });
    expect(ti).toMatchObject({ available: false, create: null });
    expect(ti?.unavailableReason).toContain('Chrome on a Mac');
  });

  it('gives a demo scale the clock it is handed', async () => {
    const fixed = new Date('2026-11-16T10:00:00Z');
    const scale = listScaleOptions(supported)[0]?.create?.(() => fixed) as SimulatedScale;
    expect(scale).toBeInstanceOf(SimulatedScale);
    const seen: string[] = [];
    scale.onWeight((r) => seen.push(r.measuredAt));
    await scale.connect();
    scale.emit();
    await scale.disconnect();
    expect(seen).toEqual(['2026-11-16T10:00:00.000Z']);
  });

  it('uses no em-dashes in what a person reads', () => {
    for (const option of [
      ...listScaleOptions({ supported: false, reason: 'Use Chrome.' }),
      ...listScaleOptions(supported),
    ]) {
      expect(
        option.label + option.unavailableReason + (option.experimentalNote ?? ''),
      ).not.toContain(EM_DASH);
    }
  });
});

describe('connectScale and tareScale', () => {
  it('connect and tare succeed on the demo scale', async () => {
    const scale = new SimulatedScale({ delayMs: 0, autoEmit: false });
    expect(await connectScale(scale)).toEqual({ ok: true });
    expect(await tareScale(scale)).toEqual({ ok: true });
    await scale.disconnect();
  });

  it('turn a failure into a message instead of throwing', async () => {
    const connectFail = new SimulatedScale({ delayMs: 0, failOn: 'connect' });
    const connect = await connectScale(connectFail);
    expect(connect.ok).toBe(false);

    const tareFail = new SimulatedScale({ delayMs: 0, autoEmit: false, failOn: 'tare' });
    await tareFail.connect();
    const tare = await tareScale(tareFail);
    expect(tare.ok).toBe(false);
    await tareFail.disconnect();
  });

  it('taring while disconnected is a plain message, not a crash', async () => {
    const outcome = await tareScale(new SimulatedScale({ delayMs: 0 }));
    expect(outcome).toMatchObject({ ok: false, cancelled: false });
    if (!outcome.ok) expect(outcome.message).toContain('not connected');
  });

  it('reports a cancel as cancelled', async () => {
    const scale = new SimulatedScale({ delayMs: 50 });
    const controller = new AbortController();
    const attempt = connectScale(scale, controller.signal);
    controller.abort();
    expect(await attempt).toEqual({ ok: false, message: 'Cancelled.', cancelled: true });
  });
});

describe('describeScaleError', () => {
  it('gives every error code a plain-English message with no em-dash', () => {
    const codes = [
      'not-connected',
      'unavailable',
      'aborted',
      'timeout',
      'invalid-reading',
      'failed',
    ] as const;
    for (const code of codes) {
      const { message } = describeScaleError(new ScaleError(code, 'Detail.'));
      expect(message).not.toBe('');
      expect(message).not.toContain(EM_DASH);
    }
  });

  it('handles an error it has never seen', () => {
    expect(describeScaleError(new Error('boom'))).toEqual({
      message: 'Something went wrong with the scale. Try again.',
      cancelled: false,
    });
  });
});
