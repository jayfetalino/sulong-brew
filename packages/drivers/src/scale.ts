/**
 * What the lab needs from any scale, however it is connected.
 * The live pour guide talks only to this interface, so a simulated scale, a Bluetooth scale
 * or a different brand can be swapped in without touching the screens.
 * It carries only what is certain: a weight in grams and the time it was read.
 */

export type ScaleStatus = 'disconnected' | 'connecting' | 'connected';

export interface WeightReading {
  /** Weight in grams, after any tare. Can be slightly negative if something is lifted off. */
  weightG: number;
  /** When the reading was taken, as an ISO 8601 time. */
  measuredAt: string;
}

export type ScaleErrorCode =
  /** An action needing a connection was asked for while not connected. */
  | 'not-connected'
  /** This device or browser cannot be used here (for example no Web Bluetooth). */
  | 'unavailable'
  /** The caller cancelled with an AbortSignal. */
  | 'aborted'
  /** The device did not answer in time. */
  | 'timeout'
  /** The device reported a number that cannot be a weight. */
  | 'invalid-reading'
  /** Anything else that went wrong talking to the device. */
  | 'failed';

export class ScaleError extends Error {
  readonly code: ScaleErrorCode;

  constructor(code: ScaleErrorCode, message: string) {
    super(message);
    this.name = 'ScaleError';
    this.code = code;
  }
}

export interface Scale {
  /** Stable name for code, for example "simulated-scale". */
  readonly id: string;
  /** Name shown to a person. */
  readonly label: string;
  /** True for scales that make up weights. Anything they produce must be shown as demo data. */
  readonly isDemo: boolean;
  readonly status: ScaleStatus;
  /** The most recent reading since connecting, or null if none has arrived yet. */
  readonly lastReading: WeightReading | null;

  /** Connects. Does nothing if already connected. Rejects with code 'aborted' if cancelled. */
  connect(signal?: AbortSignal): Promise<void>;
  /** Disconnects, and stops all readings. Does nothing if already disconnected. */
  disconnect(): Promise<void>;
  /** Sets the scale to zero. Rejects with 'not-connected' if called while disconnected. */
  tare(signal?: AbortSignal): Promise<void>;
  /**
   * Calls the listener with each new weight while connected. A listener that throws must not
   * stop other listeners or the stream. Returns a function that stops listening.
   */
  onWeight(listener: (reading: WeightReading) => void): () => void;
  /** Calls the listener whenever the status changes. Returns a function that stops listening. */
  onStatusChange(listener: (status: ScaleStatus) => void): () => void;
}

/** Throws a ScaleError ('invalid-reading') unless the number can be a weight. */
export function assertValidWeight(weightG: number): void {
  if (!Number.isFinite(weightG)) {
    throw new ScaleError('invalid-reading', `A weight of ${weightG} is not a real number.`);
  }
}
