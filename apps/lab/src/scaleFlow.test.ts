import { describe, expect, it } from 'vitest';
import { ScaleError, SimulatedScale } from '@sulong/drivers';
import {
  DEMO_SCALE_ID,
  connectScale,
  describeScaleError,
  listScaleOptions,
  tareScale,
} from './scaleFlow';

const EM_DASH = String.fromCharCode(0x2014);

describe('listScaleOptions', () => {
  const supported = { supported: true, reason: '' };

  it('offers a demo scale that works, and the DiFluid Microbalance Ti as not available yet', () => {
    const [demo, ti] = listScaleOptions(supported);
    expect(demo).toMatchObject({ id: DEMO_SCALE_ID, isDemo: true, available: true });
    expect(demo?.create?.()).toBeInstanceOf(SimulatedScale);
    expect(ti).toMatchObject({ id: 'difluid-microbalance-ti', available: false, create: null });
    expect(ti?.unavailableReason).toContain('Not available yet');
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

  it('adds the browser reason when Bluetooth is not supported', () => {
    const [, ti] = listScaleOptions({
      supported: false,
      reason: 'This browser cannot use Bluetooth from a web page. Use Chrome on a Mac.',
    });
    expect(ti?.unavailableReason).toContain('Chrome on a Mac');
  });

  it('never marks the real scale as a demo', () => {
    expect(listScaleOptions(supported)[1]?.isDemo).toBe(false);
  });

  it('uses no em-dashes in what a person reads', () => {
    for (const option of listScaleOptions({ supported: false, reason: 'Use Chrome.' })) {
      expect(option.label + option.unavailableReason).not.toContain(EM_DASH);
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
