import { describe, expect, it } from 'vitest';
import { ScaleError, type ScaleStatus, type WeightReading } from '../scale';
import { FakeTiDevice, type FakeTiDeviceOptions } from '../testing/fakeTiDevice';
import { describeScaleContract } from '../testing/scaleContract';
import { toHex } from './hex';
import { DifluidTiScale } from './tiScale';

// The Ti driver must pass the same contract every scale must pass, here against a fake device
// that behaves the way DiFluid's document says the real one does. The real device is untested.
describeScaleContract(
  'DifluidTiScale (fake device)',
  () => new DifluidTiScale(new FakeTiDevice(), { replyTimeoutMs: 500 }),
);

function setup(deviceOptions: FakeTiDeviceOptions = {}, replyTimeoutMs = 200) {
  const device = new FakeTiDevice(deviceOptions);
  const scale = new DifluidTiScale(device, { replyTimeoutMs });
  return { device, scale };
}

const nextWeight = (scale: DifluidTiScale, timeoutMs = 1000) =>
  new Promise<WeightReading>((resolve, reject) => {
    const stop = scale.onWeight((reading) => {
      clearTimeout(timer);
      stop();
      resolve(reading);
    });
    const timer = setTimeout(() => {
      stop();
      reject(new Error('No weight arrived in time.'));
    }, timeoutMs);
  });

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('DifluidTiScale', () => {
  it('is not a demo scale, and has the name and label DiFluid uses', () => {
    const { scale } = setup();
    expect(scale.isDemo).toBe(false);
    expect(scale.id).toBe('difluid-microbalance-ti');
    expect(scale.label).toBe('DiFluid Microbalance Ti');
  });

  it('switches weight sending on when it connects, and sends nothing else', async () => {
    const { scale, device } = setup();
    await scale.connect();
    expect(device.received.map((b) => toHex(b))).toEqual(['DF DF 01 00 01 01 C1']);
    await scale.disconnect();
  });

  it('reads weights in grams', async () => {
    const { scale, device } = setup();
    device.place(76);
    await scale.connect();
    const reading = await nextWeight(scale);
    expect(reading.weightG).toBe(76);
    await scale.disconnect();
  });

  it('tares: the display goes to zero, and weight added afterwards counts from there', async () => {
    const { scale, device } = setup();
    device.place(50);
    await scale.connect();
    await scale.tare();
    expect((await nextWeight(scale)).weightG).toBe(0);
    device.place(80);
    await pause(30);
    expect(scale.lastReading?.weightG).toBe(30);
    expect(device.received.map((b) => toHex(b))).toContain('DF DF 03 02 01 01 C5');
    await scale.disconnect();
  });

  it('converts a scale that is set to ounces into grams, without changing that setting', async () => {
    const { scale, device } = setup({ unitCode: 1 });
    device.place(100);
    await scale.connect();
    const reading = await nextWeight(scale);
    expect(reading.weightG).toBeCloseTo(100, 1);
    // No frame was sent that changes the weight unit (Func 1, Cmd 4).
    expect(device.received.some((b) => b[2] === 1 && b[3] === 4)).toBe(false);
    await scale.disconnect();
  });

  it('never changes the scale settings except weight sending', async () => {
    const { scale, device } = setup();
    await scale.connect();
    await scale.tare();
    await scale.disconnect();
    for (const bytes of device.received) {
      const [func, cmd] = [bytes[2], bytes[3]];
      expect([`${func}/${cmd}`]).toEqual([expect.stringMatching(/^(1\/0|3\/2)$/)]);
    }
  });

  it('puts frames back together when a notification is split, and skips stray bytes', async () => {
    const { scale, device } = setup({ chunkSize: 3, noise: true });
    device.place(12.3);
    await scale.connect();
    for (let i = 0; i < 3; i++) expect((await nextWeight(scale)).weightG).toBeCloseTo(12.3, 5);
    await scale.disconnect();
  });

  it('stamps readings with the time it was given', async () => {
    const device = new FakeTiDevice();
    const scale = new DifluidTiScale(device, { now: () => new Date('2026-11-17T10:00:00Z') });
    await scale.connect();
    expect((await nextWeight(scale)).measuredAt).toBe('2026-11-17T10:00:00.000Z');
    await scale.disconnect();
  });

  it('reports the battery when asked', async () => {
    const { scale } = setup();
    await scale.connect();
    expect(scale.batteryStatus).toBeNull();
    expect(await scale.readBattery()).toEqual({ percent: 100, charging: true });
    expect(scale.batteryStatus).toEqual({ percent: 100, charging: true });
    await scale.disconnect();
  });

  it('refuses to read the battery or tare when it is not connected', async () => {
    const { scale } = setup();
    await expect(scale.readBattery()).rejects.toMatchObject({ code: 'not-connected' });
    await expect(scale.tare()).rejects.toMatchObject({ code: 'not-connected' });
  });
});

describe('DifluidTiScale: what DiFluid does not state', () => {
  it('ignores weights with the top bit set, and says why, because the sign is not documented', async () => {
    const { scale, device } = setup({ topBitWeights: true });
    const problems: (string | null)[] = [];
    scale.onProblem((p) => problems.push(p));
    const readings: WeightReading[] = [];
    scale.onWeight((r) => readings.push(r));
    device.place(1);
    await scale.connect().catch(() => undefined);
    await pause(40);
    expect(readings).toHaveLength(0);
    expect(scale.lastReading).toBeNull();
    expect(problems.some((p) => p?.includes('top bit'))).toBe(true);
  });

  it('tells a problem once, not at every weight, and clears it when weights are good again', async () => {
    const { scale, device } = setup({ topBitWeights: true }, 400);
    const problems: (string | null)[] = [];
    scale.onProblem((p) => problems.push(p));
    // The scale answers the auto-send command with an echo, so connecting works even though
    // its weights are unusable.
    await scale.connect();
    await pause(40);
    expect(problems.filter((p) => p !== null)).toHaveLength(1);

    device.topBitWeights = false;
    await nextWeight(scale);
    expect(problems[problems.length - 1]).toBeNull();
    await scale.disconnect();
  });

  it('asks the person to set the scale to grams when it is set to the unsupported unit', async () => {
    const { scale } = setup({ unitCode: 2 }, 400);
    const problems: (string | null)[] = [];
    scale.onProblem((p) => problems.push(p));
    await scale.connect();
    await pause(30);
    expect(problems.find((p) => p !== null)).toContain('grams');
    await scale.disconnect();
  });

  it('stops telling a problem listener once it unsubscribes', async () => {
    const { scale } = setup({ topBitWeights: true }, 400);
    let heard = 0;
    const stop = scale.onProblem(() => heard++);
    stop();
    await scale.connect();
    await pause(30);
    expect(heard).toBe(0);
    await scale.disconnect();
  });
});

describe('DifluidTiScale: when things go wrong', () => {
  it('times out when the scale never answers the command that switches weights on', async () => {
    const { scale, device } = setup({ ignoreAutoSend: true }, 40);
    const statuses: ScaleStatus[] = [];
    scale.onStatusChange((s) => statuses.push(s));
    await expect(scale.connect()).rejects.toMatchObject({ code: 'timeout' });
    expect(scale.status).toBe('disconnected');
    expect(statuses).toEqual(['connecting', 'disconnected']);
    // It closed the connection rather than leaving it open.
    await expect(device.write(new Uint8Array([0xdf]))).rejects.toMatchObject({
      code: 'not-connected',
    });
  });

  it('times out on a tare the scale never confirms, and stays connected', async () => {
    const { scale } = setup({ ignoreTare: true }, 40);
    await scale.connect();
    await expect(scale.tare()).rejects.toMatchObject({ code: 'timeout' });
    expect(scale.status).toBe('connected');
    await scale.disconnect();
  });

  it('passes on a transport failure, and ends up disconnected', async () => {
    const { scale } = setup({ failConnect: 'unavailable' });
    await expect(scale.connect()).rejects.toMatchObject({ code: 'unavailable' });
    expect(scale.status).toBe('disconnected');
  });

  it('notices when the connection is lost, and then refuses commands', async () => {
    const { scale, device } = setup();
    const statuses: ScaleStatus[] = [];
    scale.onStatusChange((s) => statuses.push(s));
    await scale.connect();
    device.dropConnection();
    expect(scale.status).toBe('disconnected');
    expect(statuses).toEqual(['connecting', 'connected', 'disconnected']);
    await expect(scale.tare()).rejects.toMatchObject({ code: 'not-connected' });
  });

  it('a tare waiting for an answer fails with not-connected if the link drops', async () => {
    const { scale, device } = setup({ ignoreTare: true }, 500);
    await scale.connect();
    const attempt = scale.tare();
    await pause(10);
    device.dropConnection();
    await expect(attempt).rejects.toBeInstanceOf(ScaleError);
    await expect(attempt).rejects.toMatchObject({ code: 'not-connected' });
  });

  it('leaves weight sending switched off when it disconnects', async () => {
    const { scale, device } = setup();
    await scale.connect();
    await scale.disconnect();
    expect(device.received.map((b) => toHex(b)).pop()).toBe('DF DF 01 00 01 00 C0');
  });

  it('can connect again after the connection was lost', async () => {
    const { scale, device } = setup();
    await scale.connect();
    device.dropConnection();
    await scale.connect();
    expect(scale.status).toBe('connected');
    expect((await nextWeight(scale)).weightG).toBe(0);
    await scale.disconnect();
  });

  it('uses no em-dashes in its messages', async () => {
    const { scale } = setup({ unitCode: 2 }, 400);
    const problems: (string | null)[] = [];
    scale.onProblem((p) => problems.push(p));
    await scale.connect();
    await pause(20);
    await scale.disconnect();
    expect(problems.join(' ')).not.toContain(String.fromCharCode(0x2014));
  });
});
