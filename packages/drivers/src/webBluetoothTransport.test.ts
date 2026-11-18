import { describe, expect, it, vi } from 'vitest';
import { ScaleError } from './scale';
import {
  WebBluetoothTransport,
  mapBluetoothError,
  type BluetoothLike,
} from './webBluetoothTransport';

const SERVICE = '000000dd-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC = '0000aa01-0000-1000-8000-00805f9b34fb';

type Listener = (event: unknown) => void;

/** A stand-in for the browser's Bluetooth, with the pieces the transport touches. */
function makeBluetooth(
  options: {
    properties?: {
      notify?: boolean;
      indicate?: boolean;
      write?: boolean;
      writeWithoutResponse?: boolean;
    };
    requestError?: { name: string; message: string };
    serviceError?: { name: string; message: string };
    characteristicError?: { name: string; message: string };
    connectError?: { name: string; message: string };
    startError?: { name: string; message: string };
    noGatt?: boolean;
  } = {},
) {
  const characteristicListeners = new Map<string, Set<Listener>>();
  const deviceListeners = new Map<string, Set<Listener>>();
  const add = (map: Map<string, Set<Listener>>, type: string, l: Listener) => {
    if (!map.has(type)) map.set(type, new Set());
    map.get(type)?.add(l);
  };
  const remove = (map: Map<string, Set<Listener>>, type: string, l: Listener) =>
    map.get(type)?.delete(l);

  const written: { how: 'with' | 'without'; bytes: number[] }[] = [];
  const characteristic = {
    properties: options.properties ?? { notify: true, write: true },
    startNotifications: vi.fn(async () => {
      if (options.startError)
        throw Object.assign(new Error(options.startError.message), options.startError);
    }),
    stopNotifications: vi.fn(async () => undefined),
    writeValue: vi.fn(async (value: BufferSource) => {
      written.push({ how: 'with', bytes: Array.from(new Uint8Array(value as ArrayBuffer)) });
    }),
    writeValueWithoutResponse: vi.fn(async (value: BufferSource) => {
      written.push({ how: 'without', bytes: Array.from(new Uint8Array(value as ArrayBuffer)) });
    }),
    addEventListener: (t: string, l: Listener) => add(characteristicListeners, t, l),
    removeEventListener: (t: string, l: Listener) => remove(characteristicListeners, t, l),
  };
  const err = (e: { name: string; message: string }) => Object.assign(new Error(e.message), e);
  const gatt = {
    connected: false,
    connect: vi.fn(async () => {
      if (options.connectError) throw err(options.connectError);
      gatt.connected = true;
      return {
        getPrimaryService: async () => {
          if (options.serviceError) throw err(options.serviceError);
          return {
            getCharacteristic: async () => {
              if (options.characteristicError) throw err(options.characteristicError);
              return characteristic;
            },
          };
        },
      };
    }),
    disconnect: vi.fn(() => {
      gatt.connected = false;
    }),
  };
  const device = {
    gatt: options.noGatt ? undefined : gatt,
    addEventListener: (t: string, l: Listener) => add(deviceListeners, t, l),
    removeEventListener: (t: string, l: Listener) => remove(deviceListeners, t, l),
  };
  const bluetooth: BluetoothLike = {
    requestDevice: vi.fn(async () => {
      if (options.requestError) throw err(options.requestError);
      return device;
    }),
  };
  return {
    bluetooth,
    gatt,
    characteristic,
    written,
    /** The device sends bytes to the app. */
    notify(bytes: number[]) {
      const buffer = new Uint8Array([9, ...bytes, 9]).buffer;
      const value = new DataView(buffer, 1, bytes.length); // not at offset 0, on purpose
      for (const l of characteristicListeners.get('characteristicvaluechanged') ?? []) {
        l({ target: { value } });
      }
    },
    /** The device closes the connection by itself. */
    lose() {
      for (const l of deviceListeners.get('gattserverdisconnected') ?? []) l({});
    },
    listenerCount: () =>
      (characteristicListeners.get('characteristicvaluechanged')?.size ?? 0) +
      (deviceListeners.get('gattserverdisconnected')?.size ?? 0),
  };
}

const transportFor = (fake: ReturnType<typeof makeBluetooth>) =>
  new WebBluetoothTransport({
    serviceUuid: SERVICE,
    characteristicUuid: CHARACTERISTIC,
    bluetooth: fake.bluetooth,
  });

describe('WebBluetoothTransport: connecting', () => {
  it('asks for a device that offers the service, opens the channel and starts notifications', async () => {
    const fake = makeBluetooth();
    await transportFor(fake).connect();
    expect(fake.bluetooth.requestDevice).toHaveBeenCalledWith({
      filters: [{ services: [SERVICE] }],
    });
    expect(fake.gatt.connect).toHaveBeenCalledTimes(1);
    expect(fake.characteristic.startNotifications).toHaveBeenCalledTimes(1);
  });

  it('also filters by the device name when a name prefix is given (the R2 and the Ti share a service)', async () => {
    const fake = makeBluetooth();
    const transport = new WebBluetoothTransport({
      serviceUuid: SERVICE,
      characteristicUuid: CHARACTERISTIC,
      namePrefix: 'DiFluid R2',
      bluetooth: fake.bluetooth,
    });
    await transport.connect();
    expect(fake.bluetooth.requestDevice).toHaveBeenCalledWith({
      filters: [{ services: [SERVICE], namePrefix: 'DiFluid R2' }],
    });
  });

  it('does not send a name filter when none is given', async () => {
    const fake = makeBluetooth();
    await transportFor(fake).connect();
    const options = (fake.bluetooth.requestDevice as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(JSON.stringify(options)).not.toContain('namePrefix');
  });

  it('says refractometer, not scale, in its messages when told what the device is', async () => {
    const words = { noun: 'refractometer', model: 'R2 Extract' };
    const noDevice = new WebBluetoothTransport({
      serviceUuid: SERVICE,
      characteristicUuid: CHARACTERISTIC,
      words,
      bluetooth: makeBluetooth({
        requestError: { name: 'NotFoundError', message: 'Bluetooth adapter not available.' },
      }).bluetooth,
    });
    await expect(noDevice.connect()).rejects.toMatchObject({
      message: expect.stringContaining('No refractometer was found'),
    });
    const notConnected = new WebBluetoothTransport({
      serviceUuid: SERVICE,
      characteristicUuid: CHARACTERISTIC,
      words,
      bluetooth: makeBluetooth().bluetooth,
    });
    await expect(notConnected.write(new Uint8Array([1]))).rejects.toMatchObject({
      message: 'The refractometer is not connected.',
    });
    expect(mapBluetoothError({ name: 'NetworkError', message: 'x' }, words).message).toContain(
      'connect to the refractometer',
    );
    expect(
      mapBluetoothError({ name: 'NotFoundError', message: 'No Services matching UUID' }, words)
        .message,
    ).toContain('Is it the R2 Extract?');
  });

  it('connecting again while connected does nothing', async () => {
    const fake = makeBluetooth();
    const transport = transportFor(fake);
    await transport.connect();
    await transport.connect();
    expect(fake.bluetooth.requestDevice).toHaveBeenCalledTimes(1);
  });

  it('accepts a channel that offers indications instead of notifications', async () => {
    const fake = makeBluetooth({ properties: { indicate: true, writeWithoutResponse: true } });
    await expect(transportFor(fake).connect()).resolves.toBeUndefined();
  });

  it('refuses a channel that cannot send readings, and closes the connection', async () => {
    const fake = makeBluetooth({ properties: { write: true } });
    await expect(transportFor(fake).connect()).rejects.toMatchObject({
      code: 'unavailable',
      message: expect.stringContaining('notifications'),
    });
    expect(fake.gatt.disconnect).toHaveBeenCalled();
  });

  it('refuses a channel that cannot take commands, and closes the connection', async () => {
    const fake = makeBluetooth({ properties: { notify: true } });
    await expect(transportFor(fake).connect()).rejects.toMatchObject({
      code: 'unavailable',
      message: expect.stringContaining('written to'),
    });
    expect(fake.gatt.disconnect).toHaveBeenCalled();
  });

  it('says unavailable when the browser has no Bluetooth at all', async () => {
    const transport = new WebBluetoothTransport({
      serviceUuid: SERVICE,
      characteristicUuid: CHARACTERISTIC,
      bluetooth: undefined,
    });
    // In Node there is no navigator.bluetooth either.
    await expect(transport.connect()).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('says unavailable for a device that cannot be connected to', async () => {
    await expect(transportFor(makeBluetooth({ noGatt: true })).connect()).rejects.toMatchObject({
      code: 'unavailable',
    });
  });
});

describe('WebBluetoothTransport: cancelling', () => {
  it('rejects with aborted if cancelled before it starts', async () => {
    const fake = makeBluetooth();
    const controller = new AbortController();
    controller.abort();
    await expect(transportFor(fake).connect(controller.signal)).rejects.toMatchObject({
      code: 'aborted',
    });
    expect(fake.bluetooth.requestDevice).not.toHaveBeenCalled();
  });

  it('rejects with aborted if cancelled while the person is choosing a device', async () => {
    const fake = makeBluetooth();
    const controller = new AbortController();
    const attempt = transportFor(fake).connect(controller.signal);
    controller.abort();
    await expect(attempt).rejects.toMatchObject({ code: 'aborted' });
    expect(fake.characteristic.startNotifications).not.toHaveBeenCalled();
  });

  it('treats the person closing the device chooser as a cancel, not an error', async () => {
    const fake = makeBluetooth({
      requestError: {
        name: 'NotFoundError',
        message: 'User cancelled the requestDevice() chooser.',
      },
    });
    await expect(transportFor(fake).connect()).rejects.toMatchObject({ code: 'aborted' });
  });
});

describe('WebBluetoothTransport: errors in plain English', () => {
  const cases: [string, { name: string; message: string }, string, string][] = [
    [
      'no scale found',
      { name: 'NotFoundError', message: 'Bluetooth adapter not available.' },
      'unavailable',
      'No scale was found',
    ],
    [
      'wrong service',
      { name: 'NotFoundError', message: 'No Services matching UUID 000000dd found in Device.' },
      'unavailable',
      'Microbalance Ti',
    ],
    [
      'no data channel',
      { name: 'NotFoundError', message: 'No Characteristics matching UUID aa01 found in Service.' },
      'unavailable',
      'data channel',
    ],
    ['blocked', { name: 'SecurityError', message: 'Access denied.' }, 'unavailable', 'HTTPS'],
    [
      'needs permission',
      { name: 'NotAllowedError', message: 'Must be handling a user gesture.' },
      'unavailable',
      'permission',
    ],
    [
      'not supported',
      { name: 'NotSupportedError', message: 'x' },
      'unavailable',
      'cannot use Bluetooth',
    ],
    [
      'could not connect',
      { name: 'NetworkError', message: 'GATT Server is disconnected.' },
      'failed',
      'close other apps',
    ],
    ['something else', { name: 'Error', message: 'odd' }, 'failed', 'odd'],
  ];

  it.each(cases)('%s', (_name, error, code, words) => {
    const mapped = mapBluetoothError(error);
    expect(mapped).toBeInstanceOf(ScaleError);
    expect(mapped.code).toBe(code);
    expect(mapped.message).toContain(words);
    expect(mapped.message).not.toContain('—');
  });

  it('passes a ScaleError through unchanged, and maps AbortError to aborted', () => {
    const own = new ScaleError('timeout', 'x');
    expect(mapBluetoothError(own)).toBe(own);
    expect(mapBluetoothError({ name: 'AbortError', message: '' }).code).toBe('aborted');
  });

  it('turns a failure while connecting into a ScaleError and closes the connection', async () => {
    const fake = makeBluetooth({ connectError: { name: 'NetworkError', message: 'x' } });
    await expect(transportFor(fake).connect()).rejects.toMatchObject({ code: 'failed' });
  });

  it('turns a failure when starting notifications into a ScaleError and cleans up', async () => {
    const fake = makeBluetooth({ startError: { name: 'NetworkError', message: 'x' } });
    await expect(transportFor(fake).connect()).rejects.toMatchObject({ code: 'failed' });
    expect(fake.listenerCount()).toBe(0);
  });
});

describe('WebBluetoothTransport: data and commands', () => {
  it('hands the device bytes to listeners, exactly, even when the browser buffer has an offset', async () => {
    const fake = makeBluetooth();
    const transport = transportFor(fake);
    const heard: number[][] = [];
    transport.onData((b) => heard.push(Array.from(b)));
    await transport.connect();
    fake.notify([0xdf, 0xdf, 3, 0, 0, 0xc1]);
    fake.notify([1, 2]);
    expect(heard).toEqual([
      [0xdf, 0xdf, 3, 0, 0, 0xc1],
      [1, 2],
    ]);
  });

  it('a listener that throws does not stop the others', async () => {
    const fake = makeBluetooth();
    const transport = transportFor(fake);
    transport.onData(() => {
      throw new Error('broken');
    });
    const heard: number[][] = [];
    transport.onData((b) => heard.push(Array.from(b)));
    await transport.connect();
    fake.notify([5]);
    expect(heard).toEqual([[5]]);
  });

  it('stops telling a data listener once it unsubscribes', async () => {
    const fake = makeBluetooth();
    const transport = transportFor(fake);
    let heard = 0;
    const stop = transport.onData(() => heard++);
    stop();
    await transport.connect();
    fake.notify([5]);
    expect(heard).toBe(0);
  });

  it('writes without waiting for a response when the channel allows it', async () => {
    const fake = makeBluetooth({
      properties: { notify: true, write: true, writeWithoutResponse: true },
    });
    const transport = transportFor(fake);
    await transport.connect();
    await transport.write(new Uint8Array([0xdf, 0xdf, 3]));
    expect(fake.written).toEqual([{ how: 'without', bytes: [0xdf, 0xdf, 3] }]);
  });

  it('writes with a response when that is all the channel allows', async () => {
    const fake = makeBluetooth({ properties: { notify: true, write: true } });
    const transport = transportFor(fake);
    await transport.connect();
    await transport.write(new Uint8Array([1, 2]));
    expect(fake.written).toEqual([{ how: 'with', bytes: [1, 2] }]);
  });

  it('sends a copy, so the caller can reuse its array', async () => {
    const fake = makeBluetooth();
    const transport = transportFor(fake);
    await transport.connect();
    const bytes = new Uint8Array([1, 2, 3]);
    const sending = transport.write(bytes);
    bytes[0] = 99;
    await sending;
    expect(fake.written[0]?.bytes).toEqual([1, 2, 3]);
  });

  it('refuses to write when not connected', async () => {
    await expect(transportFor(makeBluetooth()).write(new Uint8Array([1]))).rejects.toMatchObject({
      code: 'not-connected',
    });
  });
});

describe('WebBluetoothTransport: closing', () => {
  it('tells listeners when the device closes the connection by itself', async () => {
    const fake = makeBluetooth();
    const transport = transportFor(fake);
    let lost = 0;
    transport.onDisconnect(() => lost++);
    await transport.connect();
    fake.lose();
    expect(lost).toBe(1);
    expect(fake.listenerCount()).toBe(0);
    await expect(transport.write(new Uint8Array([1]))).rejects.toMatchObject({
      code: 'not-connected',
    });
  });

  it('does not tell listeners when we close it ourselves', async () => {
    const fake = makeBluetooth();
    const transport = transportFor(fake);
    let lost = 0;
    transport.onDisconnect(() => lost++);
    await transport.connect();
    await transport.disconnect();
    fake.lose(); // the browser reports the close afterwards
    expect(lost).toBe(0);
    expect(fake.gatt.disconnect).toHaveBeenCalled();
    expect(fake.characteristic.stopNotifications).toHaveBeenCalled();
    expect(fake.listenerCount()).toBe(0);
  });

  it('disconnecting when not connected, or twice, is harmless', async () => {
    const fake = makeBluetooth();
    const transport = transportFor(fake);
    await transport.disconnect();
    await transport.connect();
    await transport.disconnect();
    await transport.disconnect();
    expect(fake.gatt.disconnect).toHaveBeenCalledTimes(1);
  });

  it('can connect again after disconnecting', async () => {
    const fake = makeBluetooth();
    const transport = transportFor(fake);
    await transport.connect();
    await transport.disconnect();
    await transport.connect();
    expect(fake.bluetooth.requestDevice).toHaveBeenCalledTimes(2);
  });
});
