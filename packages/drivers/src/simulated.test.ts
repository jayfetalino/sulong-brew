import { describe, expect, it } from 'vitest';
import { RefractometerError } from './refractometer';
import { SimulatedRefractometer } from './simulated';
import { describeRefractometerContract } from './testing/contract';

// The simulated device must pass the same contract a real device will have to pass.
describeRefractometerContract(
  'SimulatedRefractometer',
  () => new SimulatedRefractometer({ delayMs: 5 }),
);

describe('SimulatedRefractometer', () => {
  it('is always marked as demo and says so in its label', () => {
    const driver = new SimulatedRefractometer();
    expect(driver.isDemo).toBe(true);
    expect(driver.label.toLowerCase()).toContain('simulated');
  });

  it('hands out its readings in order, then starts again', async () => {
    const driver = new SimulatedRefractometer({ readings: [1.2, 1.3], delayMs: 0 });
    await driver.connect();
    const values = [];
    for (let i = 0; i < 5; i++) values.push((await driver.readTds()).tdsPercent);
    expect(values).toEqual([1.2, 1.3, 1.2, 1.3, 1.2]);
  });

  it('starts with 1.41, the example from the brief', async () => {
    const driver = new SimulatedRefractometer({ delayMs: 0 });
    await driver.connect();
    expect((await driver.readTds()).tdsPercent).toBe(1.41);
  });

  it('stamps readings with the time it was given', async () => {
    const driver = new SimulatedRefractometer({
      delayMs: 0,
      now: () => new Date('2026-11-12T10:00:00Z'),
    });
    await driver.connect();
    expect((await driver.readTds()).measuredAt).toBe('2026-11-12T10:00:00.000Z');
  });

  it('can be made to fail when connecting, and ends up disconnected', async () => {
    const driver = new SimulatedRefractometer({ delayMs: 0, failOn: 'connect' });
    await expect(driver.connect()).rejects.toMatchObject({ code: 'failed' });
    expect(driver.status).toBe('disconnected');
  });

  it('can be made to fail when reading, and stays connected', async () => {
    const driver = new SimulatedRefractometer({ delayMs: 0, failOn: 'read' });
    await driver.connect();
    await expect(driver.readTds()).rejects.toMatchObject({ code: 'failed' });
    expect(driver.status).toBe('connected');
  });

  it('refuses an impossible reading', async () => {
    for (const bad of [0, -1, 31, Number.NaN]) {
      const driver = new SimulatedRefractometer({ readings: [bad], delayMs: 0 });
      await driver.connect();
      const attempt = driver.readTds();
      await expect(attempt).rejects.toBeInstanceOf(RefractometerError);
      await expect(attempt).rejects.toMatchObject({ code: 'invalid-reading' });
    }
  });

  it('notices a disconnect that happens while a reading is in progress', async () => {
    const driver = new SimulatedRefractometer({ delayMs: 20 });
    await driver.connect();
    const attempt = driver.readTds();
    await driver.disconnect();
    await expect(attempt).rejects.toMatchObject({ code: 'not-connected' });
  });
});
