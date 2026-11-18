import { describe, expect, it } from 'vitest';
import {
  DifluidR2Refractometer,
  RefractometerError,
  SimulatedRefractometer,
} from '@sulong/drivers';
import {
  DEMO_OPTION_ID,
  R2_EXPERIMENTAL_NOTE,
  R2_OPTION_ID,
  describeRefractometerError,
  listRefractometerOptions,
  takeReading,
} from './refractometerFlow';

const EM_DASH = String.fromCharCode(0x2014);

describe('listRefractometerOptions', () => {
  const supported = { supported: true, reason: '' };

  it('offers a demo device that works, and the DiFluid R2 as experimental', () => {
    const [demo, r2] = listRefractometerOptions(supported);
    expect(demo).toMatchObject({
      id: DEMO_OPTION_ID,
      isDemo: true,
      available: true,
      experimentalNote: null,
    });
    expect(demo?.create?.()).toBeInstanceOf(SimulatedRefractometer);
    expect(r2).toMatchObject({ id: R2_OPTION_ID, available: true, isDemo: false });
    expect(r2?.label).toContain('experimental');
    expect(r2?.experimentalNote).toBe(R2_EXPERIMENTAL_NOTE);
    expect(r2?.create?.()).toBeInstanceOf(DifluidR2Refractometer);
  });

  it('the experimental note says the R2 has not been tried on a real device', () => {
    expect(R2_EXPERIMENTAL_NOTE).toContain('has not been tried with a real R2');
  });

  it('makes the R2 not available, with the browser reason, when Bluetooth is not supported', () => {
    const [, r2] = listRefractometerOptions({
      supported: false,
      reason:
        'Safari on iPhone cannot use Bluetooth from a web page. Open this app in the Bluefy browser instead.',
    });
    expect(r2).toMatchObject({ available: false, create: null });
    expect(r2?.unavailableReason).toContain('Bluefy');
  });

  it('never marks the DiFluid R2 as a demo device', () => {
    expect(listRefractometerOptions(supported)[1]?.isDemo).toBe(false);
  });

  it('uses no em-dashes in what a person reads', () => {
    for (const option of listRefractometerOptions({ supported: false, reason: 'Use Chrome.' })) {
      expect(
        option.label + option.unavailableReason + (option.experimentalNote ?? ''),
      ).not.toContain(EM_DASH);
    }
  });
});

describe('takeReading', () => {
  it('connects, reads, and marks a simulated reading as demo', async () => {
    const driver = new SimulatedRefractometer({ delayMs: 0 });
    const outcome = await takeReading(driver);
    expect(outcome).toEqual({ ok: true, tdsPercent: 1.41, source: 'demo' });
    expect(driver.status).toBe('connected');
  });

  it('reuses the connection and gives the next reading', async () => {
    const driver = new SimulatedRefractometer({ delayMs: 0 });
    await takeReading(driver);
    const second = await takeReading(driver);
    expect(second.ok && second.tdsPercent).toBe(1.38);
  });

  it('turns a failure into a message instead of throwing', async () => {
    const driver = new SimulatedRefractometer({ delayMs: 0, failOn: 'read' });
    const outcome = await takeReading(driver);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.cancelled).toBe(false);
      expect(outcome.message).not.toBe('');
    }
  });

  it('reports an impossible number without filling anything in', async () => {
    const driver = new SimulatedRefractometer({ readings: [45], delayMs: 0 });
    const outcome = await takeReading(driver);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toContain('cannot be a TDS');
  });

  it('reports a cancel as cancelled', async () => {
    const driver = new SimulatedRefractometer({ delayMs: 50 });
    const controller = new AbortController();
    const attempt = takeReading(driver, controller.signal);
    controller.abort();
    expect(await attempt).toEqual({ ok: false, message: 'Cancelled.', cancelled: true });
  });
});

describe('describeRefractometerError', () => {
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
      const { message } = describeRefractometerError(new RefractometerError(code, 'Detail.'));
      expect(message).not.toBe('');
      expect(message).not.toContain(EM_DASH);
    }
  });

  it('handles an error it has never seen', () => {
    expect(describeRefractometerError(new Error('boom'))).toEqual({
      message: 'Something went wrong reading from the refractometer. Try again.',
      cancelled: false,
    });
  });
});
