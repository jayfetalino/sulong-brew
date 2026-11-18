import type { BluetoothTransport } from './bluetoothTransport';
import { ScaleError } from './scale';

// The parts of the browser's Web Bluetooth that this file uses, written out here so no extra
// package is needed. The real objects have more; only these are touched. Web Bluetooth works in
// Chrome on a Mac (on HTTPS or localhost) and in Bluefy on iPhone, not in Safari.

interface CharacteristicLike {
  properties: {
    notify?: boolean;
    indicate?: boolean;
    write?: boolean;
    writeWithoutResponse?: boolean;
  };
  startNotifications(): Promise<unknown>;
  stopNotifications?(): Promise<unknown>;
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
}

interface ServiceLike {
  getCharacteristic(uuid: string): Promise<CharacteristicLike>;
}

interface GattServerLike {
  getPrimaryService(uuid: string): Promise<ServiceLike>;
}

interface GattLike {
  connected?: boolean;
  connect(): Promise<GattServerLike>;
  disconnect(): void;
}

interface DeviceLike {
  gatt?: GattLike;
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
}

export interface BluetoothLike {
  requestDevice(options: { filters: { services: string[] }[] }): Promise<DeviceLike>;
}

export interface WebBluetoothTransportOptions {
  /** The Bluetooth service the device advertises, used to find it. */
  serviceUuid: string;
  /** The characteristic that carries the messages. */
  characteristicUuid: string;
  /** For tests: a stand-in for navigator.bluetooth. */
  bluetooth?: BluetoothLike;
}

const aborted = () => new ScaleError('aborted', 'Cancelled.');

/** Turns a browser Bluetooth error into a ScaleError with a message a person can act on. */
export function mapBluetoothError(error: unknown): ScaleError {
  if (error instanceof ScaleError) return error;
  const name = (error as { name?: string } | null)?.name ?? '';
  const message = (error as { message?: string } | null)?.message ?? '';
  switch (name) {
    case 'AbortError':
      return aborted();
    case 'NotFoundError':
      if (/cancel/i.test(message)) return aborted();
      if (/characteristic/i.test(message)) {
        return new ScaleError(
          'unavailable',
          "The scale's data channel was not found on that device.",
        );
      }
      if (/service/i.test(message)) {
        return new ScaleError(
          'unavailable',
          'That device does not offer the DiFluid scale service. Is it a Microbalance Ti?',
        );
      }
      return new ScaleError(
        'unavailable',
        'No scale was found. Make sure the Microbalance Ti is on and close by, then try again.',
      );
    case 'SecurityError':
      return new ScaleError(
        'unavailable',
        'Bluetooth is blocked here. It needs a secure (HTTPS) page and permission.',
      );
    case 'NotAllowedError':
      return new ScaleError(
        'unavailable',
        'Bluetooth needs your permission. Tap Connect again and allow it.',
      );
    case 'NotSupportedError':
      return new ScaleError('unavailable', 'This browser cannot use Bluetooth for that.');
    case 'NetworkError':
      return new ScaleError(
        'failed',
        'Could not connect to the scale. Make sure it is on and close by, and close other apps that may be connected to it.',
      );
    default:
      return new ScaleError(
        'failed',
        message ? `Bluetooth problem: ${message}` : 'Bluetooth problem.',
      );
  }
}

/** A Bluetooth connection in the browser (Web Bluetooth). */
export class WebBluetoothTransport implements BluetoothTransport {
  private device: DeviceLike | null = null;
  private characteristic: CharacteristicLike | null = null;
  private closing = false;
  private dataListeners = new Set<(bytes: Uint8Array) => void>();
  private disconnectListeners = new Set<() => void>();

  constructor(private readonly options: WebBluetoothTransportOptions) {}

  private readonly onValueChanged = (event: unknown): void => {
    const view = (event as { target?: { value?: DataView } | null }).target?.value;
    if (!view) return;
    // Copy the bytes: the browser may reuse the buffer.
    const bytes = new Uint8Array(
      view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength),
    );
    for (const listener of [...this.dataListeners]) {
      try {
        listener(bytes);
      } catch {
        // A broken listener must not stop the others.
      }
    }
  };

  private readonly onGattDisconnected = (): void => {
    const wasClosing = this.closing;
    this.release();
    if (wasClosing) return; // We closed it ourselves, nobody needs telling.
    for (const listener of [...this.disconnectListeners]) {
      try {
        listener();
      } catch {
        // A broken listener must not stop the others.
      }
    }
  };

  /** Forgets the connection and stops listening to it. */
  private release(): void {
    this.characteristic?.removeEventListener('characteristicvaluechanged', this.onValueChanged);
    this.device?.removeEventListener('gattserverdisconnected', this.onGattDisconnected);
    this.characteristic = null;
    this.device = null;
  }

  async connect(signal?: AbortSignal): Promise<void> {
    if (this.characteristic) return;
    if (signal?.aborted) throw aborted();

    const bluetooth =
      this.options.bluetooth ??
      (globalThis as { navigator?: { bluetooth?: BluetoothLike } }).navigator?.bluetooth;
    if (!bluetooth) {
      throw new ScaleError('unavailable', 'This browser cannot use Bluetooth from a web page.');
    }

    let device: DeviceLike;
    try {
      device = await bluetooth.requestDevice({
        filters: [{ services: [this.options.serviceUuid] }],
      });
    } catch (error) {
      throw mapBluetoothError(error);
    }
    if (signal?.aborted) throw aborted();

    try {
      const gatt = device.gatt;
      if (!gatt) throw new ScaleError('unavailable', 'That device cannot be connected to.');
      const server = await gatt.connect();
      if (signal?.aborted) {
        gatt.disconnect();
        throw aborted();
      }
      const service = await server.getPrimaryService(this.options.serviceUuid);
      const characteristic = await service.getCharacteristic(this.options.characteristicUuid);

      // DiFluid's document does not say which operations the characteristic offers, so check.
      const p = characteristic.properties;
      if (!p.notify && !p.indicate) {
        gatt.disconnect();
        throw new ScaleError(
          'unavailable',
          "The scale's data channel cannot send readings to this app (it offers no notifications).",
        );
      }
      if (!p.write && !p.writeWithoutResponse) {
        gatt.disconnect();
        throw new ScaleError(
          'unavailable',
          "The scale's data channel cannot receive commands from this app (it cannot be written to).",
        );
      }

      characteristic.addEventListener('characteristicvaluechanged', this.onValueChanged);
      device.addEventListener('gattserverdisconnected', this.onGattDisconnected);
      this.device = device;
      this.characteristic = characteristic;
      this.closing = false;
      await characteristic.startNotifications();
      if (signal?.aborted) {
        await this.disconnect();
        throw aborted();
      }
    } catch (error) {
      if (this.characteristic) await this.disconnect();
      else device.gatt?.disconnect();
      throw mapBluetoothError(error);
    }
  }

  async disconnect(): Promise<void> {
    const characteristic = this.characteristic;
    const device = this.device;
    if (!characteristic || !device) return;
    this.closing = true;
    try {
      await characteristic.stopNotifications?.();
    } catch {
      // The device may already be gone.
    }
    this.release();
    try {
      device.gatt?.disconnect();
    } catch {
      // Already closed.
    }
    this.closing = false;
  }

  async write(bytes: Uint8Array): Promise<void> {
    const characteristic = this.characteristic;
    if (!characteristic) throw new ScaleError('not-connected', 'The scale is not connected.');
    // A fresh copy: the browser takes a plain buffer, and the caller may reuse its array.
    const payload = new Uint8Array(bytes);
    try {
      if (
        characteristic.properties.writeWithoutResponse &&
        characteristic.writeValueWithoutResponse
      ) {
        await characteristic.writeValueWithoutResponse(payload);
      } else {
        await characteristic.writeValue(payload);
      }
    } catch (error) {
      throw mapBluetoothError(error);
    }
  }

  onData(listener: (bytes: Uint8Array) => void): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onDisconnect(listener: () => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }
}
