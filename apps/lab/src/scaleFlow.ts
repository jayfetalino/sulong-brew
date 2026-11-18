import {
  ScaleError,
  SimulatedScale,
  bluetoothSupport,
  type BluetoothSupport,
  type Scale,
} from '@sulong/drivers';

/** One choice in the scale list of the live brew. */
export interface ScaleOption {
  id: string;
  label: string;
  isDemo: boolean;
  available: boolean;
  /** Plain-English reason, shown when the option is not available. */
  unavailableReason: string;
  /**
   * Makes a fresh scale. `now` lets the live brew give a demo scale the same (possibly faster)
   * clock as its timer. Null when the option is not available.
   */
  create: ((now?: () => Date) => Scale) | null;
}

export const DEMO_SCALE_ID = 'demo-scale';

/**
 * The scales the live brew can offer.
 * The DiFluid Microbalance Ti is listed so it is visible, but it is not usable until its
 * Bluetooth connection has been built and tested with a real scale (see docs/protocols/).
 */
export function listScaleOptions(support: BluetoothSupport = bluetoothSupport()): ScaleOption[] {
  return [
    {
      id: DEMO_SCALE_ID,
      label: 'Demo scale (simulated)',
      isDemo: true,
      available: true,
      unavailableReason: '',
      create: (now) => new SimulatedScale({ now }),
    },
    {
      id: 'difluid-microbalance-ti',
      label: 'DiFluid Microbalance Ti',
      isDemo: false,
      available: false,
      unavailableReason: [
        'Not available yet. The connection has not been built into the app, and it needs testing with a real scale.',
        support.supported ? '' : support.reason,
      ]
        .filter(Boolean)
        .join(' '),
      create: null,
    },
  ];
}

export type ScaleStepResult = { ok: true } | { ok: false; message: string; cancelled: boolean };

/** Turns anything that can go wrong into a message a person can act on. */
export function describeScaleError(error: unknown): { message: string; cancelled: boolean } {
  if (error instanceof ScaleError) {
    switch (error.code) {
      case 'aborted':
        return { message: 'Cancelled.', cancelled: true };
      case 'not-connected':
        return {
          message: 'The scale is not connected. Connect it and try again.',
          cancelled: false,
        };
      case 'timeout':
        return {
          message:
            'The scale did not answer in time. Check that it is on and close by, then try again.',
          cancelled: false,
        };
      case 'invalid-reading':
        return {
          message: 'The scale sent a weight that cannot be real, so it was ignored.',
          cancelled: false,
        };
      case 'unavailable':
      case 'failed':
        return { message: error.message, cancelled: false };
    }
  }
  return { message: 'Something went wrong with the scale. Try again.', cancelled: false };
}

/** Connects. Never throws: the screen gets either success or a message to show. */
export async function connectScale(scale: Scale, signal?: AbortSignal): Promise<ScaleStepResult> {
  try {
    await scale.connect(signal);
    return { ok: true };
  } catch (error) {
    return { ok: false, ...describeScaleError(error) };
  }
}

/** Zeroes the scale. Never throws. */
export async function tareScale(scale: Scale, signal?: AbortSignal): Promise<ScaleStepResult> {
  try {
    await scale.tare(signal);
    return { ok: true };
  } catch (error) {
    return { ok: false, ...describeScaleError(error) };
  }
}
