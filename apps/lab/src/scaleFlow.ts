import {
  DifluidTiScale,
  ScaleError,
  SimulatedScale,
  TI_CHARACTERISTIC_UUID,
  TI_SERVICE_UUID,
  WebBluetoothTransport,
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
   * A warning shown whenever this option is chosen, for connections that have not been proven
   * on a real device yet. Null when there is nothing to warn about.
   */
  experimentalNote: string | null;
  /**
   * Makes a fresh scale. `now` lets the live brew give a demo scale the same (possibly faster)
   * clock as its timer. A real scale ignores it. Null when the option is not available.
   */
  create: ((now?: () => Date) => Scale) | null;
}

export const DEMO_SCALE_ID = 'demo-scale';
export const TI_SCALE_ID = 'difluid-microbalance-ti';

/** Shown for as long as the Ti connection is unproven. Remove it after testing with a real Ti. */
export const TI_EXPERIMENTAL_NOTE =
  "EXPERIMENTAL. This connection was written from DiFluid's documents and has not been tried with a real scale yet. Weights may be wrong or missing, so check them against the scale's own screen.";

/**
 * The scales the live brew can offer.
 * The DiFluid Microbalance Ti works through Web Bluetooth (Chrome on a Mac, or Bluefy on iPhone),
 * and is marked experimental until it has been tested with a real scale (see docs/protocols/).
 */
export function listScaleOptions(support: BluetoothSupport = bluetoothSupport()): ScaleOption[] {
  return [
    {
      id: DEMO_SCALE_ID,
      label: 'Demo scale (simulated)',
      isDemo: true,
      available: true,
      unavailableReason: '',
      experimentalNote: null,
      create: (now) => new SimulatedScale({ now }),
    },
    {
      id: TI_SCALE_ID,
      label: 'DiFluid Microbalance Ti (experimental)',
      isDemo: false,
      available: support.supported,
      unavailableReason: support.supported ? '' : support.reason,
      experimentalNote: TI_EXPERIMENTAL_NOTE,
      create: support.supported
        ? () =>
            new DifluidTiScale(
              new WebBluetoothTransport({
                serviceUuid: TI_SERVICE_UUID,
                characteristicUuid: TI_CHARACTERISTIC_UUID,
              }),
            )
        : null,
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
