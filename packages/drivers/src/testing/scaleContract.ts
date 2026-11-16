import { describe, expect, it } from 'vitest';
import type { Scale, ScaleStatus, WeightReading } from '../scale';

/** Resolves with the next reading, or rejects if none arrives in time. */
function nextReading(scale: Scale, timeoutMs = 1000): Promise<WeightReading> {
  return new Promise((resolve, reject) => {
    const stop = scale.onWeight((reading) => {
      clearTimeout(timer);
      stop();
      resolve(reading);
    });
    const timer = setTimeout(() => {
      stop();
      reject(new Error(`No weight reading arrived within ${timeoutMs} ms.`));
    }, timeoutMs);
  });
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Behaviour every scale driver must have, whatever it talks to.
 * Run it against each driver: describeScaleContract('My scale', () => new MyScale()).
 * `create` must return a fresh, disconnected scale each time. The scale must send readings
 * by itself once connected (the contract waits for them).
 */
export function describeScaleContract(name: string, create: () => Scale): void {
  describe(`${name}: scale contract`, () => {
    it('has a name, a label and a demo flag', () => {
      const scale = create();
      expect(scale.id).not.toBe('');
      expect(scale.label).not.toBe('');
      expect(typeof scale.isDemo).toBe('boolean');
    });

    it('starts disconnected, with no reading yet', () => {
      const scale = create();
      expect(scale.status).toBe('disconnected');
      expect(scale.lastReading).toBeNull();
    });

    it('connects, and reports connecting then connected', async () => {
      const scale = create();
      const seen: ScaleStatus[] = [];
      scale.onStatusChange((s) => seen.push(s));
      await scale.connect();
      expect(scale.status).toBe('connected');
      expect(seen).toEqual(['connecting', 'connected']);
      await scale.disconnect();
    });

    it('connecting twice is harmless', async () => {
      const scale = create();
      await scale.connect();
      await scale.connect();
      expect(scale.status).toBe('connected');
      await scale.disconnect();
    });

    it('refuses to tare while disconnected', async () => {
      await expect(create().tare()).rejects.toMatchObject({ code: 'not-connected' });
    });

    it('sends real-looking readings with a valid time once connected', async () => {
      const scale = create();
      await scale.connect();
      const reading = await nextReading(scale);
      expect(Number.isFinite(reading.weightG)).toBe(true);
      expect(Number.isNaN(Date.parse(reading.measuredAt))).toBe(false);
      expect(scale.lastReading).toEqual(reading);
      await scale.disconnect();
    });

    it('keeps sending readings', async () => {
      const scale = create();
      await scale.connect();
      await nextReading(scale);
      await nextReading(scale);
      await nextReading(scale);
      await scale.disconnect();
    });

    it('tares while connected, and keeps sending readings afterwards', async () => {
      const scale = create();
      await scale.connect();
      await scale.tare();
      const reading = await nextReading(scale);
      expect(Number.isFinite(reading.weightG)).toBe(true);
      await scale.disconnect();
    });

    it('stops telling a weight listener once it unsubscribes', async () => {
      const scale = create();
      let count = 0;
      const stop = scale.onWeight(() => count++);
      stop();
      await scale.connect();
      await nextReading(scale);
      await pause(40);
      expect(count).toBe(0);
      await scale.disconnect();
    });

    it('stops sending readings after disconnecting', async () => {
      const scale = create();
      await scale.connect();
      await nextReading(scale);
      await scale.disconnect();
      expect(scale.status).toBe('disconnected');
      let after = 0;
      scale.onWeight(() => after++);
      await pause(60);
      expect(after).toBe(0);
    });

    it('disconnecting when already disconnected is harmless', async () => {
      const scale = create();
      await scale.disconnect();
      expect(scale.status).toBe('disconnected');
    });

    it('can connect again after disconnecting, and readings resume', async () => {
      const scale = create();
      await scale.connect();
      await scale.disconnect();
      await scale.connect();
      expect(scale.status).toBe('connected');
      await nextReading(scale);
      await scale.disconnect();
    });

    it('a listener that throws does not stop other listeners or the stream', async () => {
      const scale = create();
      scale.onWeight(() => {
        throw new Error('broken listener');
      });
      await scale.connect();
      await nextReading(scale);
      await nextReading(scale);
      await scale.disconnect();
    });

    it('rejects with code "aborted" when connecting is cancelled, and ends up disconnected', async () => {
      const scale = create();
      const controller = new AbortController();
      const attempt = scale.connect(controller.signal);
      controller.abort();
      await expect(attempt).rejects.toMatchObject({ code: 'aborted' });
      expect(scale.status).toBe('disconnected');
    });

    it('rejects with code "aborted" when taring is cancelled, and stays connected', async () => {
      const scale = create();
      await scale.connect();
      const controller = new AbortController();
      const attempt = scale.tare(controller.signal);
      controller.abort();
      await expect(attempt).rejects.toMatchObject({ code: 'aborted' });
      expect(scale.status).toBe('connected');
      await scale.disconnect();
    });

    it('stops telling a status listener once it unsubscribes', async () => {
      const scale = create();
      const seen: ScaleStatus[] = [];
      const stop = scale.onStatusChange((s) => seen.push(s));
      stop();
      await scale.connect();
      expect(seen).toEqual([]);
      await scale.disconnect();
    });
  });
}
