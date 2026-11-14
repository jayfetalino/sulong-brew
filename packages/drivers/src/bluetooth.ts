export interface BluetoothSupport {
  supported: boolean;
  /** Plain-English explanation for a person. Empty when supported. */
  reason: string;
}

/** The few browser facts needed to decide. Passed in so it can be tested. */
export interface BrowserFacts {
  /** True if the browser offers navigator.bluetooth. */
  hasWebBluetooth: boolean;
  /** True on HTTPS and on localhost. Web Bluetooth does not work otherwise. */
  isSecureContext: boolean;
  userAgent: string;
}

export function readBrowserFacts(): BrowserFacts {
  return {
    hasWebBluetooth: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
    isSecureContext: typeof window !== 'undefined' && window.isSecureContext === true,
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
  };
}

/**
 * Can this browser talk to a Bluetooth device from a web page?
 * Works in Chrome on a Mac (on HTTPS or localhost) and in the Bluefy app on iPhone.
 * It does not work in Safari.
 */
export function bluetoothSupport(facts: BrowserFacts = readBrowserFacts()): BluetoothSupport {
  if (!facts.hasWebBluetooth) {
    const onApple = /iPhone|iPad|iPod/.test(facts.userAgent);
    return {
      supported: false,
      reason: onApple
        ? 'Safari on iPhone cannot use Bluetooth from a web page. Open this app in the Bluefy browser instead.'
        : 'This browser cannot use Bluetooth from a web page. Use Chrome on a Mac.',
    };
  }
  if (!facts.isSecureContext) {
    return {
      supported: false,
      reason: 'Bluetooth only works on a secure (HTTPS) address.',
    };
  }
  return { supported: true, reason: '' };
}
