import {
  DifluidR2Refractometer,
  R2_CHARACTERISTIC_UUID,
  R2_NAME_PREFIX,
  R2_SERVICE_UUID,
  RefractometerError,
  SimulatedRefractometer,
  WebBluetoothTransport,
  bluetoothSupport,
  type BluetoothSupport,
  type Refractometer,
} from '@sulong/drivers';
import type { TdsSource } from '@sulong/core';

/** One choice in the "Read from refractometer" device list. */
export interface RefractometerOption {
  id: string;
  label: string;
  isDemo: boolean;
  available: boolean;
  /** Plain-English reason, shown when the option is not available. */
  unavailableReason: string;
  /**
   * A warning shown whenever this option is chosen, for connections that have not been proven
   * on a real device yet. Null when there is nothing to warn about.
   */
  experimentalNote: string | null;
  /** Makes a fresh driver. Null when the option is not available. */
  create: (() => Refractometer) | null;
}

export const DEMO_OPTION_ID = 'demo';
export const R2_OPTION_ID = 'difluid-r2';

/** Shown for as long as the R2 connection is unproven. Remove it after testing with a real R2. */
export const R2_EXPERIMENTAL_NOTE =
  "EXPERIMENTAL. This connection was written from DiFluid's documents and an email from DiFluid support, and has not been tried with a real R2 yet. TDS values may be wrong or missing, so check them against the R2's own screen. Put your sample on the prism before you tap Read TDS.";

/**
 * The devices the brew form can offer.
 * The DiFluid R2 Extract works through Web Bluetooth (Chrome on a Mac, or Bluefy on iPhone), and
 * is marked experimental until it has been tested with a real R2 (see docs/protocols/difluid-r2.md).
 */
export function listRefractometerOptions(
  support: BluetoothSupport = bluetoothSupport(),
): RefractometerOption[] {
  return [
    {
      id: DEMO_OPTION_ID,
      label: 'Demo refractometer (simulated)',
      isDemo: true,
      available: true,
      unavailableReason: '',
      experimentalNote: null,
      create: () => new SimulatedRefractometer(),
    },
    {
      id: R2_OPTION_ID,
      label: 'DiFluid R2 Extract (experimental)',
      isDemo: false,
      available: support.supported,
      unavailableReason: support.supported ? '' : support.reason,
      experimentalNote: R2_EXPERIMENTAL_NOTE,
      create: support.supported
        ? () =>
            new DifluidR2Refractometer(
              new WebBluetoothTransport({
                serviceUuid: R2_SERVICE_UUID,
                characteristicUuid: R2_CHARACTERISTIC_UUID,
                // The R2 shares its service with the Microbalance Ti, so the name tells them apart.
                namePrefix: R2_NAME_PREFIX,
                words: { noun: 'refractometer', model: 'R2 Extract' },
              }),
            )
        : null,
    },
  ];
}

export type ReadOutcome =
  | { ok: true; tdsPercent: number; source: Extract<TdsSource, 'demo' | 'refractometer'> }
  | { ok: false; message: string; cancelled: boolean };

/** Turns anything that can go wrong into a message a person can act on. */
export function describeRefractometerError(error: unknown): {
  message: string;
  cancelled: boolean;
} {
  if (error instanceof RefractometerError) {
    switch (error.code) {
      case 'aborted':
        return { message: 'Cancelled.', cancelled: true };
      case 'not-connected':
        return { message: 'Not connected to the refractometer. Try again.', cancelled: false };
      case 'timeout':
        return {
          message:
            'The refractometer did not answer in time. Check that it is on and close by, then try again.',
          cancelled: false,
        };
      case 'invalid-reading':
        return {
          message:
            'The refractometer gave a number that cannot be a TDS. Nothing was filled in. Try again.',
          cancelled: false,
        };
      case 'unavailable':
      case 'failed':
        return { message: error.message, cancelled: false };
    }
  }
  return {
    message: 'Something went wrong reading from the refractometer. Try again.',
    cancelled: false,
  };
}

/**
 * Connects if needed and takes one reading. Never throws: the screen gets either a number
 * (with whether it is a demo number) or a message to show.
 */
export async function takeReading(
  driver: Refractometer,
  signal?: AbortSignal,
): Promise<ReadOutcome> {
  try {
    if (driver.status !== 'connected') await driver.connect(signal);
    const reading = await driver.readTds(signal);
    return {
      ok: true,
      tdsPercent: reading.tdsPercent,
      source: driver.isDemo ? 'demo' : 'refractometer',
    };
  } catch (error) {
    return { ok: false, ...describeRefractometerError(error) };
  }
}
