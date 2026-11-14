import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Refractometer } from '@sulong/drivers';
import type { TdsSource } from '@sulong/core';
import { DEMO_OPTION_ID, listRefractometerOptions, takeReading } from './refractometerFlow';

interface Props {
  /** Called with a good reading. `source` says whether it is a demo number or a real one. */
  onReading: (tdsPercent: number, source: Extract<TdsSource, 'demo' | 'refractometer'>) => void;
}

type Message = { text: string; kind: 'info' | 'error' };

export function RefractometerPanel({ onReading }: Props) {
  const options = useMemo(() => listRefractometerOptions(), []);
  const [optionId, setOptionId] = useState(DEMO_OPTION_ID);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  // One driver per device choice, kept so the connection is reused for the next reading.
  const drivers = useRef(new Map<string, Refractometer>());
  const cancel = useRef<AbortController | null>(null);

  useEffect(() => {
    const open = drivers.current;
    return () => {
      cancel.current?.abort();
      for (const driver of open.values()) void driver.disconnect();
      open.clear();
    };
  }, []);

  const selected = options.find((o) => o.id === optionId) ?? options[0];
  const unavailable = options.filter((o) => !o.available);

  const onRead = async () => {
    if (!selected?.create) return;
    let driver = drivers.current.get(selected.id);
    if (!driver) {
      driver = selected.create();
      drivers.current.set(selected.id, driver);
    }
    const controller = new AbortController();
    cancel.current = controller;
    setWorking(true);
    setMessage({
      text: driver.status === 'connected' ? 'Reading...' : 'Connecting...',
      kind: 'info',
    });

    const outcome = await takeReading(driver, controller.signal);

    cancel.current = null;
    setWorking(false);
    if (outcome.ok) {
      onReading(outcome.tdsPercent, outcome.source);
      setMessage({
        text:
          outcome.source === 'demo'
            ? `Demo reading: ${outcome.tdsPercent} %. This is a made-up number, not a real measurement.`
            : `Reading: ${outcome.tdsPercent} %.`,
        kind: 'info',
      });
    } else {
      setMessage({ text: outcome.message, kind: outcome.cancelled ? 'info' : 'error' });
    }
  };

  return (
    <details class="refractometer">
      <summary>Read TDS from a refractometer</summary>

      <div class="refractometer-body">
        <label>
          Device
          <select
            value={optionId}
            disabled={working}
            onChange={(e) => setOptionId((e.target as HTMLSelectElement).value)}
          >
            {options.map((o) => (
              <option key={o.id} value={o.id} disabled={!o.available}>
                {o.label}
                {o.available ? '' : ' (not available yet)'}
              </option>
            ))}
          </select>
        </label>

        {selected?.isDemo && (
          <p class="demo-note">
            <strong>DEMO.</strong> This device makes up numbers so you can try the app. Brews that
            use them are marked as demo readings.
          </p>
        )}

        {unavailable.map((o) => (
          <p key={o.id} class="muted refractometer-unavailable">
            {o.label}: {o.unavailableReason}
          </p>
        ))}

        <div class="row">
          <button
            type="button"
            class="button primary"
            disabled={working || !selected?.available}
            onClick={onRead}
          >
            Read TDS
          </button>
          {working && (
            <button type="button" class="button" onClick={() => cancel.current?.abort()}>
              Cancel
            </button>
          )}
        </div>

        {message && (
          <p
            class={message.kind === 'error' ? 'field-error' : 'data-line'}
            role={message.kind === 'error' ? 'alert' : 'status'}
          >
            {message.text}
          </p>
        )}
      </div>
    </details>
  );
}
