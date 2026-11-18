import { describe, expect, it } from 'vitest';
import { RefractometerError, type RefractometerStatus } from '../refractometer';
import { describeRefractometerContract } from '../testing/contract';
import { FakeR2Device, type FakeR2DeviceOptions } from '../testing/fakeR2Device';
import { toHex } from './hex';
import { DifluidR2Refractometer } from './r2Refractometer';

// The R2 driver must pass the same contract every refractometer must pass, here against a fake
// device that answers the way DiFluid's document shows. The real device is untested.
describeRefractometerContract(
  'DifluidR2Refractometer (fake device)',
  () => new DifluidR2Refractometer(new FakeR2Device(), { testTimeoutMs: 1000, settleMs: 0 }),
);

function setup(
  deviceOptions: FakeR2DeviceOptions = {},
  driverOptions: { testTimeoutMs?: number; settleMs?: number } = {},
) {
  const device = new FakeR2Device(deviceOptions);
  const r2 = new DifluidR2Refractometer(device, {
    testTimeoutMs: 200,
    settleMs: 0,
    ...driverOptions,
  });
  return { device, r2 };
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('DifluidR2Refractometer', () => {
  it('is not a demo device, and has the name DiFluid uses', () => {
    const { r2 } = setup();
    expect(r2.isDemo).toBe(false);
    expect(r2.id).toBe('difluid-r2');
    expect(r2.label).toBe('DiFluid R2 Extract');
  });

  it('sends nothing when it connects', async () => {
    const { r2, device } = setup();
    await r2.connect();
    expect(device.received).toEqual([]);
    await r2.disconnect();
  });

  it('starts a test with the documented single-test command, and returns the TDS', async () => {
    const { r2, device } = setup();
    await r2.connect();
    const reading = await r2.readTds();
    expect(reading.tdsPercent).toBe(1.41);
    expect(device.received.map((b) => toHex(b))).toEqual(['DF DF 03 00 00 C1']);
    await r2.disconnect();
  });

  it('gives successive tests their own values over one connection', async () => {
    const { r2, device } = setup();
    await r2.connect();
    const values = [];
    for (let i = 0; i < 4; i++) values.push((await r2.readTds()).tdsPercent);
    expect(values).toEqual([1.41, 1.38, 1.45, 1.41]);
    expect(device.received).toHaveLength(4);
    await r2.disconnect();
  });

  it('stamps readings with the time it was given', async () => {
    const device = new FakeR2Device();
    const r2 = new DifluidR2Refractometer(device, {
      now: () => new Date('2026-11-18T10:00:00Z'),
      settleMs: 0,
    });
    await r2.connect();
    expect((await r2.readTds()).measuredAt).toBe('2026-11-18T10:00:00.000Z');
    await r2.disconnect();
  });

  it('puts frames back together when notifications are split, and skips stray bytes', async () => {
    const { r2 } = setup({ chunkSize: 3, noise: true });
    await r2.connect();
    expect((await r2.readTds()).tdsPercent).toBe(1.41);
    await r2.disconnect();
  });

  it('ignores frames that arrive when no test was asked for', async () => {
    const { r2, device } = setup();
    await r2.connect();
    // Something arrives on its own, then a proper test still works.
    device.write(new Uint8Array([0])).catch(() => undefined);
    expect((await r2.readTds()).tdsPercent).toBe(1.41);
    await r2.disconnect();
  });

  it('refuses to start a second test while one is running', async () => {
    const { r2 } = setup({ delayMs: 20 });
    await r2.connect();
    const first = r2.readTds();
    await expect(r2.readTds()).rejects.toMatchObject({ code: 'failed' });
    expect((await first).tdsPercent).toBe(1.41);
    await r2.disconnect();
  });

  it('refuses to read when not connected', async () => {
    const { r2 } = setup();
    await expect(r2.readTds()).rejects.toMatchObject({ code: 'not-connected' });
  });
});

describe('DifluidR2Refractometer: when the R2 reports a problem', () => {
  it('turns an R2 error into a plain message that tells the person what to check, and stays connected', async () => {
    const { r2 } = setup({ mode: 'error' });
    await r2.connect();
    const failure = await r2.readTds().catch((e) => e);
    expect(failure).toBeInstanceOf(RefractometerError);
    expect(failure.code).toBe('failed');
    expect(failure.message).toContain('The R2 reported an error (02 03)');
    expect(failure.message).toContain('sample on the prism');
    expect(r2.status).toBe('connected');
    await r2.disconnect();
  });

  it('can test again after an error', async () => {
    const { r2, device } = setup({ mode: 'error' });
    await r2.connect();
    await expect(r2.readTds()).rejects.toMatchObject({ code: 'failed' });
    device.mode = 'normal';
    expect((await r2.readTds()).tdsPercent).toBe(1.41);
    await r2.disconnect();
  });

  it('rejects a TDS of zero as an invalid reading', async () => {
    const { r2 } = setup({ mode: 'zero' });
    await r2.connect();
    await expect(r2.readTds()).rejects.toMatchObject({ code: 'invalid-reading' });
    await r2.disconnect();
  });

  it('refuses a result whose number has its top bit set, because DiFluid does not say how negatives are sent', async () => {
    const { r2 } = setup({ mode: 'top-bit' });
    await r2.connect();
    const failure = await r2.readTds().catch((e) => e);
    expect(failure.code).toBe('failed');
    expect(failure.message).toContain('top bit');
    await r2.disconnect();
  });

  it('times out when the R2 starts a test but never finishes it, and stays connected', async () => {
    const { r2 } = setup({ mode: 'unfinished' }, { testTimeoutMs: 40 });
    await r2.connect();
    const failure = await r2.readTds().catch((e) => e);
    expect(failure.code).toBe('timeout');
    expect(failure.message).toContain('sample on the prism');
    expect(r2.status).toBe('connected');
    await r2.disconnect();
  });

  it('times out when the R2 never answers at all', async () => {
    const { r2 } = setup({ mode: 'silent' }, { testTimeoutMs: 40 });
    await r2.connect();
    await expect(r2.readTds()).rejects.toMatchObject({ code: 'timeout' });
    await r2.disconnect();
  });

  it('passes on a failure to connect, and ends up disconnected', async () => {
    const { r2 } = setup({ failConnect: 'unavailable' });
    const statuses: RefractometerStatus[] = [];
    r2.onStatusChange((s) => statuses.push(s));
    await expect(r2.connect()).rejects.toBeInstanceOf(RefractometerError);
    expect(r2.status).toBe('disconnected');
    expect(statuses).toEqual(['connecting', 'disconnected']);
  });

  it('notices when the connection is lost, in the middle of a test and afterwards', async () => {
    const { r2, device } = setup({ delayMs: 30 });
    const statuses: RefractometerStatus[] = [];
    r2.onStatusChange((s) => statuses.push(s));
    await r2.connect();
    const attempt = r2.readTds();
    await pause(10);
    device.dropConnection();
    await expect(attempt).rejects.toMatchObject({ code: 'not-connected' });
    expect(r2.status).toBe('disconnected');
    expect(statuses).toEqual(['connecting', 'connected', 'disconnected']);
    await expect(r2.readTds()).rejects.toMatchObject({ code: 'not-connected' });
  });

  it('can connect again after the connection was lost', async () => {
    const { r2, device } = setup();
    await r2.connect();
    device.dropConnection();
    await r2.connect();
    expect((await r2.readTds()).tdsPercent).toBe(1.41);
    await r2.disconnect();
  });
});

describe('DifluidR2Refractometer: cancelling', () => {
  it('rejects with aborted, and a late result of the cancelled test is not used for the next test', async () => {
    const { r2 } = setup({ delayMs: 5 }, { settleMs: 80 });
    await r2.connect();
    const controller = new AbortController();
    const first = r2.readTds(controller.signal);
    controller.abort();
    await expect(first).rejects.toMatchObject({ code: 'aborted' });

    // Starting again straight away is refused, so the first test's late frames cannot be mixed in.
    await expect(r2.readTds()).rejects.toMatchObject({
      code: 'failed',
      message: expect.stringContaining('still be finishing'),
    });

    // After the settling time, the late frames have been ignored and the next test is its own.
    await pause(120);
    expect((await r2.readTds()).tdsPercent).toBe(1.38);
    await r2.disconnect();
  });

  it('also waits after a timeout before allowing another test', async () => {
    const { r2 } = setup({ mode: 'unfinished' }, { testTimeoutMs: 30, settleMs: 60 });
    await r2.connect();
    await expect(r2.readTds()).rejects.toMatchObject({ code: 'timeout' });
    await expect(r2.readTds()).rejects.toMatchObject({ code: 'failed' });
    await pause(80);
    await expect(r2.readTds()).rejects.toMatchObject({ code: 'timeout' }); // ran a real test again
    await r2.disconnect();
  });

  it('refuses a test when it is already cancelled before it starts', async () => {
    const { r2, device } = setup();
    await r2.connect();
    const controller = new AbortController();
    controller.abort();
    await expect(r2.readTds(controller.signal)).rejects.toMatchObject({ code: 'aborted' });
    expect(device.received).toHaveLength(0);
    await r2.disconnect();
  });
});

describe('DifluidR2Refractometer: messages', () => {
  it('uses no em-dashes in what a person reads', async () => {
    const messages: string[] = [];
    for (const mode of ['error', 'zero', 'top-bit', 'unfinished'] as const) {
      const { r2 } = setup({ mode }, { testTimeoutMs: 30 });
      await r2.connect();
      const failure = await r2.readTds().catch((e) => e);
      messages.push(failure.message);
      await r2.disconnect();
    }
    expect(messages.join(' ')).not.toContain(String.fromCharCode(0x2014));
  });
});
