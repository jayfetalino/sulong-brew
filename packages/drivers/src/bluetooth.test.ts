import { describe, expect, it } from 'vitest';
import { bluetoothSupport } from './bluetooth';
import { assertValidTds } from './refractometer';

const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

describe('bluetoothSupport', () => {
  it('is supported with Web Bluetooth on a secure address', () => {
    expect(
      bluetoothSupport({ hasWebBluetooth: true, isSecureContext: true, userAgent: MAC_CHROME }),
    ).toEqual({ supported: true, reason: '' });
  });

  it('tells iPhone Safari users to use Bluefy', () => {
    const result = bluetoothSupport({
      hasWebBluetooth: false,
      isSecureContext: true,
      userAgent: IPHONE_SAFARI,
    });
    expect(result.supported).toBe(false);
    expect(result.reason).toContain('Bluefy');
  });

  it('tells other browsers to use Chrome on a Mac', () => {
    const result = bluetoothSupport({
      hasWebBluetooth: false,
      isSecureContext: true,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0',
    });
    expect(result.supported).toBe(false);
    expect(result.reason).toContain('Chrome on a Mac');
  });

  it('needs a secure address', () => {
    const result = bluetoothSupport({
      hasWebBluetooth: true,
      isSecureContext: false,
      userAgent: MAC_CHROME,
    });
    expect(result.supported).toBe(false);
    expect(result.reason).toContain('HTTPS');
  });

  it('never uses an em-dash in what a person reads', () => {
    for (const hasWebBluetooth of [true, false]) {
      for (const isSecureContext of [true, false]) {
        for (const userAgent of [MAC_CHROME, IPHONE_SAFARI]) {
          const { reason } = bluetoothSupport({ hasWebBluetooth, isSecureContext, userAgent });
          expect(reason).not.toContain(String.fromCharCode(0x2014));
        }
      }
    }
  });
});

describe('assertValidTds', () => {
  it('accepts values above 0 up to 30', () => {
    expect(() => assertValidTds(1.41)).not.toThrow();
    expect(() => assertValidTds(30)).not.toThrow();
    expect(() => assertValidTds(0.01)).not.toThrow();
  });

  it('rejects 0, negatives, too large, and not-a-number', () => {
    for (const bad of [0, -0.5, 30.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => assertValidTds(bad)).toThrow(/outside the possible range/);
    }
  });
});
