import { describe, expect, it } from 'vitest';
import { TDS_MAX, type Refractometer, type RefractometerStatus } from '../refractometer';

/**
 * Behaviour every refractometer driver must have, whatever it talks to.
 * Run it against each driver: describeRefractometerContract('My driver', () => new MyDriver()).
 * `create` must return a fresh, disconnected driver each time.
 */
export function describeRefractometerContract(name: string, create: () => Refractometer): void {
  describe(`${name}: refractometer contract`, () => {
    it('has a name, a label and a demo flag', () => {
      const driver = create();
      expect(driver.id).not.toBe('');
      expect(driver.label).not.toBe('');
      expect(typeof driver.isDemo).toBe('boolean');
    });

    it('starts disconnected', () => {
      expect(create().status).toBe('disconnected');
    });

    it('connects, and reports connecting then connected', async () => {
      const driver = create();
      const seen: RefractometerStatus[] = [];
      driver.onStatusChange((s) => seen.push(s));
      await driver.connect();
      expect(driver.status).toBe('connected');
      expect(seen).toEqual(['connecting', 'connected']);
    });

    it('connecting twice is harmless', async () => {
      const driver = create();
      await driver.connect();
      await driver.connect();
      expect(driver.status).toBe('connected');
    });

    it('refuses to read while disconnected', async () => {
      await expect(create().readTds()).rejects.toMatchObject({ code: 'not-connected' });
    });

    it('returns a believable reading with a valid time once connected', async () => {
      const driver = create();
      await driver.connect();
      const reading = await driver.readTds();
      expect(reading.tdsPercent).toBeGreaterThan(0);
      expect(reading.tdsPercent).toBeLessThanOrEqual(TDS_MAX);
      expect(Number.isNaN(Date.parse(reading.measuredAt))).toBe(false);
    });

    it('can take several readings in a row', async () => {
      const driver = create();
      await driver.connect();
      for (let i = 0; i < 4; i++) {
        const reading = await driver.readTds();
        expect(Number.isFinite(reading.tdsPercent)).toBe(true);
      }
    });

    it('disconnects, and then refuses to read again', async () => {
      const driver = create();
      await driver.connect();
      await driver.disconnect();
      expect(driver.status).toBe('disconnected');
      await expect(driver.readTds()).rejects.toMatchObject({ code: 'not-connected' });
    });

    it('disconnecting when already disconnected is harmless', async () => {
      const driver = create();
      await driver.disconnect();
      expect(driver.status).toBe('disconnected');
    });

    it('can connect again after disconnecting', async () => {
      const driver = create();
      await driver.connect();
      await driver.disconnect();
      await driver.connect();
      expect(driver.status).toBe('connected');
    });

    it('rejects with code "aborted" when connecting is cancelled, and ends up disconnected', async () => {
      const driver = create();
      const controller = new AbortController();
      const attempt = driver.connect(controller.signal);
      controller.abort();
      await expect(attempt).rejects.toMatchObject({ code: 'aborted' });
      expect(driver.status).toBe('disconnected');
    });

    it('rejects with code "aborted" when a reading is cancelled, and stays connected', async () => {
      const driver = create();
      await driver.connect();
      const controller = new AbortController();
      const attempt = driver.readTds(controller.signal);
      controller.abort();
      await expect(attempt).rejects.toMatchObject({ code: 'aborted' });
      expect(driver.status).toBe('connected');
    });

    it('stops telling a listener once it unsubscribes', async () => {
      const driver = create();
      const seen: RefractometerStatus[] = [];
      const stop = driver.onStatusChange((s) => seen.push(s));
      stop();
      await driver.connect();
      expect(seen).toEqual([]);
    });
  });
}
