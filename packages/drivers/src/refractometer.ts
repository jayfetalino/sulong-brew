/**
 * What the lab needs from any refractometer, however it is connected.
 * The brew form talks only to this interface, so a simulated device, a Bluetooth
 * device or a future model can be swapped in without touching the screens.
 */

export type RefractometerStatus = 'disconnected' | 'connecting' | 'connected';

export interface RefractometerReading {
  /** Total dissolved solids in percent, for example 1.41. */
  tdsPercent: number;
  /** When the reading was taken, as an ISO 8601 time. */
  measuredAt: string;
}

export type RefractometerErrorCode =
  /** A reading was asked for while not connected. */
  | 'not-connected'
  /** This device or browser cannot be used here (for example no Web Bluetooth). */
  | 'unavailable'
  /** The caller cancelled with an AbortSignal. */
  | 'aborted'
  /** The device did not answer in time. */
  | 'timeout'
  /** The device reported a number that cannot be a TDS value. */
  | 'invalid-reading'
  /** Anything else that went wrong talking to the device. */
  | 'failed';

export class RefractometerError extends Error {
  readonly code: RefractometerErrorCode;

  constructor(code: RefractometerErrorCode, message: string) {
    super(message);
    this.name = 'RefractometerError';
    this.code = code;
  }
}

export interface Refractometer {
  /** Stable name for code, for example "simulated-r2". */
  readonly id: string;
  /** Name shown to a person. */
  readonly label: string;
  /** True for devices that make up numbers. Their readings must always be shown as demo data. */
  readonly isDemo: boolean;
  readonly status: RefractometerStatus;

  /** Connects. Does nothing if already connected. Rejects with code 'aborted' if cancelled. */
  connect(signal?: AbortSignal): Promise<void>;
  /** Disconnects. Does nothing if already disconnected. */
  disconnect(): Promise<void>;
  /** Takes one reading. Rejects with 'not-connected' if called while disconnected. */
  readTds(signal?: AbortSignal): Promise<RefractometerReading>;
  /** Calls the listener whenever the status changes. Returns a function that stops listening. */
  onStatusChange(listener: (status: RefractometerStatus) => void): () => void;
}

/** The same limits the brew form uses: above 0 and no more than 30 percent. */
export const TDS_MIN_EXCLUSIVE = 0;
export const TDS_MAX = 30;

/** Throws a RefractometerError ('invalid-reading') unless the number can be a real TDS. */
export function assertValidTds(tdsPercent: number): void {
  if (!Number.isFinite(tdsPercent) || tdsPercent <= TDS_MIN_EXCLUSIVE || tdsPercent > TDS_MAX) {
    throw new RefractometerError(
      'invalid-reading',
      `A TDS of ${tdsPercent} is outside the possible range (above 0 and at most ${TDS_MAX}).`,
    );
  }
}
