import {
  RefractometerError,
  SimulatedRefractometer,
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
  /** Makes a fresh driver. Null when the option is not available. */
  create: (() => Refractometer) | null;
}

export const DEMO_OPTION_ID = 'demo';

/**
 * The devices the brew form can offer.
 * The DiFluid R2 is listed so it is visible, but it is not usable until DiFluid supplies
 * its Bluetooth protocol and the driver is built from it (see docs/protocols/difluid-r2.md).
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
      create: () => new SimulatedRefractometer(),
    },
    {
      id: 'difluid-r2',
      label: 'DiFluid R2 Extract',
      isDemo: false,
      available: false,
      unavailableReason: [
        "Not available yet. Waiting for DiFluid's Bluetooth details.",
        support.supported ? '' : support.reason,
      ]
        .filter(Boolean)
        .join(' '),
      create: null,
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
