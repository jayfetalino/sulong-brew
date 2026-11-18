/**
 * The small part of a Bluetooth connection that a device driver needs: open it, send bytes,
 * receive bytes, and hear about it closing. Drivers are written against this, so they can be
 * tested with a fake device. WebBluetoothTransport is the real thing, for Chrome and Bluefy.
 */
export interface BluetoothTransport {
  /**
   * Opens the connection. In a browser this asks the person to pick a device, so it must be
   * called from a tap or click. Rejects with a ScaleError (code 'aborted' if cancelled).
   */
  connect(signal?: AbortSignal): Promise<void>;
  /** Closes the connection. Does nothing if it is already closed. */
  disconnect(): Promise<void>;
  /** Sends bytes to the device. */
  write(bytes: Uint8Array): Promise<void>;
  /** Calls the listener with each chunk of bytes from the device. Returns a stop function. */
  onData(listener: (bytes: Uint8Array) => void): () => void;
  /** Calls the listener if the connection closes, whoever closed it. Returns a stop function. */
  onDisconnect(listener: () => void): () => void;
}
