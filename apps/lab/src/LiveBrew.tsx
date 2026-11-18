import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SimulatedScale, type Scale } from '@sulong/drivers';
import {
  buildBrewDraft,
  distanceToTarget,
  formatDistance,
  formatDuration,
  nextStepAfter,
  planDemoPour,
  ratioLabel,
  stepIndexAt,
  stepProgress,
  type BrewDraft,
  type Recipe,
  type RecipeVersion,
} from '@sulong/core';
import { describeStep } from './format';
import { ScaledClock } from './scaledClock';
import { DEMO_SCALE_ID, connectScale, listScaleOptions, tareScale } from './scaleFlow';

interface Props {
  recipe: Recipe;
  version: RecipeVersion;
  /** Leave without saving anything. */
  onCancel: () => void;
  /** The brew is over: hand the measurements on to the brew form. */
  onFinish: (draft: BrewDraft) => void;
}

type Phase = 'setup' | 'connecting' | 'ready' | 'taring' | 'running';
type Message = { text: string; kind: 'info' | 'error' };

const SPEEDS = [1, 2, 4] as const;

type WakeLockLike = { release(): Promise<void> };

export function LiveBrew({ recipe, version, onCancel, onFinish }: Props) {
  const options = useMemo(() => listScaleOptions(), []);
  const plan = useMemo(() => planDemoPour(version.steps), [version]);
  // One clock for the timer and for the demo scale, so a faster speed keeps them in step.
  const clock = useMemo(() => new ScaledClock(1), []);

  const [optionId, setOptionId] = useState(DEMO_SCALE_ID);
  const [phase, setPhase] = useState<Phase>('setup');
  const [weight, setWeight] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [autoDemo, setAutoDemo] = useState(true);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [, setTick] = useState(0);

  const scaleRef = useRef<Scale | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startMsRef = useRef(0);
  const triggeredRef = useRef(new Set<number>());
  const wakeLockRef = useRef<WakeLockLike | null>(null);

  const selected = options.find((o) => o.id === optionId) ?? options[0];
  const scale = scaleRef.current;
  const demoScale = scale instanceof SimulatedScale ? scale : null;
  const unavailable = options.filter((o) => !o.available);

  const keepScreenOn = async (on: boolean) => {
    try {
      if (on) {
        wakeLockRef.current = (await navigator.wakeLock?.request('screen')) ?? null;
      } else {
        await wakeLockRef.current?.release();
        wakeLockRef.current = null;
      }
    } catch {
      // Not supported or refused: the guide still works, the screen may just dim.
    }
  };

  // Redraw ten times a second while a scale is connected, so the timer and weight stay fresh.
  useEffect(() => {
    if (phase !== 'ready' && phase !== 'taring' && phase !== 'running') return;
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, [phase]);

  // The demo pour: when a step's time arrives, the demo scale pours up to that step's target.
  useEffect(() => {
    if (phase !== 'running' || !autoDemo || !demoScale) return;
    const id = setInterval(() => {
      const elapsed = (clock.nowMs() - startMsRef.current) / 1000;
      plan.forEach((entry, i) => {
        if (entry.atSeconds <= elapsed && !triggeredRef.current.has(i)) {
          triggeredRef.current.add(i);
          demoScale.pourTo(entry.targetG, entry.durationSeconds * 1000);
        }
      });
    }, 100);
    return () => clearInterval(id);
  }, [phase, autoDemo, demoScale, plan, clock]);

  // Leaving the screen: stop listening, disconnect, and release the screen lock.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      unsubscribeRef.current?.();
      void scaleRef.current?.disconnect();
      void wakeLockRef.current?.release().catch(() => undefined);
    },
    [],
  );

  const onConnect = async () => {
    if (!selected?.create) return;
    const created = selected.create(() => clock.now());
    scaleRef.current = created;
    unsubscribeRef.current?.();
    const stopWeights = created.onWeight((reading) => setWeight(reading.weightG));
    const stopStatus = created.onStatusChange((status) => {
      if (status === 'disconnected' && scaleRef.current === created) {
        setMessage({ text: 'The scale disconnected.', kind: 'error' });
      }
    });
    unsubscribeRef.current = () => {
      stopWeights();
      stopStatus();
    };

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('connecting');
    setMessage({ text: 'Connecting...', kind: 'info' });
    const result = await connectScale(created, controller.signal);
    abortRef.current = null;
    if (result.ok) {
      setPhase('ready');
      setMessage(null);
    } else {
      setPhase('setup');
      setMessage({ text: result.message, kind: result.cancelled ? 'info' : 'error' });
    }
  };

  const onTareAndStart = async () => {
    if (!scale) return;
    setPhase('taring');
    setMessage({ text: 'Taring...', kind: 'info' });
    const result = await tareScale(scale);
    if (!result.ok) {
      setPhase('ready');
      setMessage({ text: result.message, kind: 'error' });
      return;
    }
    triggeredRef.current = new Set();
    startMsRef.current = clock.nowMs();
    setMessage(null);
    setPhase('running');
    void keepScreenOn(true);
  };

  const onDone = () => {
    const elapsed = (clock.nowMs() - startMsRef.current) / 1000;
    const source = scale?.isDemo ? 'demo' : 'scale';
    const draft = buildBrewDraft(version, weight, elapsed, source);
    onFinish(draft);
  };

  const onSpeed = (next: (typeof SPEEDS)[number]) => {
    clock.setSpeed(next);
    setSpeed(next);
  };

  // ---- Live numbers ----
  const running = phase === 'running';
  const elapsed = running ? Math.max(0, (clock.nowMs() - startMsRef.current) / 1000) : 0;
  const stepIndex = running ? stepIndexAt(version.steps, elapsed) : -1;
  const step = version.steps[stepIndex];
  const target = step?.targetWeightG ?? null;
  const distance =
    weight !== null && target !== null ? formatDistance(distanceToTarget(weight, target)) : null;
  const progress = weight !== null && step ? stepProgress(version.steps, stepIndex, weight) : null;
  const next = running ? nextStepAfter(version.steps, elapsed) : null;
  const nextStep = next ? version.steps[next.index] : undefined;

  const temp = version.waterTempC === null ? 'temp not set' : `${version.waterTempC} C`;
  const connected = phase === 'ready' || phase === 'taring' || phase === 'running';

  return (
    <div class="live">
      <div class="page-head">
        {confirmingCancel ? (
          <div class="danger-zone">
            <p>Stop this brew? Nothing has been saved yet, so nothing will be kept.</p>
            <div class="row">
              <button type="button" class="button danger" onClick={onCancel}>
                Yes, stop
              </button>
              <button type="button" class="button" onClick={() => setConfirmingCancel(false)}>
                Keep brewing
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            class="button"
            onClick={() => (running ? setConfirmingCancel(true) : onCancel())}
          >
            {running ? 'Cancel brew' : 'Back'}
          </button>
        )}
      </div>

      <h1>{recipe.name}</h1>
      <p class="muted">
        Version {version.versionNumber} · {version.doseG} g : {version.waterG} g ·{' '}
        {ratioLabel(version.doseG, version.waterG)} · {temp}
      </p>

      {scale?.isDemo && (
        <p class="demo-note">
          <strong>DEMO.</strong> The weights come from a pretend scale. Nothing here is a real
          measurement, and the brew you save will be marked as a demo reading.
        </p>
      )}

      {!connected && (
        <section class="live-panel">
          <h2>Scale</h2>
          <label class="form-label">
            Device
            <select
              value={optionId}
              disabled={phase === 'connecting'}
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
          {unavailable.map((o) => (
            <p key={o.id} class="muted refractometer-unavailable">
              {o.label}: {o.unavailableReason}
            </p>
          ))}
          <div class="row">
            <button
              type="button"
              class="button primary"
              disabled={phase === 'connecting' || !selected?.available}
              onClick={onConnect}
            >
              Connect
            </button>
            {phase === 'connecting' && (
              <button type="button" class="button" onClick={() => abortRef.current?.abort()}>
                Cancel
              </button>
            )}
          </div>
        </section>
      )}

      {message && (
        <p
          class={message.kind === 'error' ? 'field-error' : 'data-line'}
          role={message.kind === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}

      {connected && (
        <>
          <div class="live-readout" aria-label="Live weight and time">
            <div>
              <span class="stat-label">Weight</span>
              <span class="live-weight" data-testid="weight">
                {weight === null ? 'Waiting' : weight.toFixed(1)}
                {weight !== null && <span class="live-unit"> g</span>}
              </span>
            </div>
            <div>
              <span class="stat-label">Time</span>
              <span class="live-weight" data-testid="clock">
                {formatDuration(elapsed)}
              </span>
            </div>
          </div>

          {phase !== 'running' && (
            <section class="live-panel">
              <p class="muted">
                Put your empty server, with the dripper and the coffee in it, on the scale. Then
                press Tare and start, and begin pouring.
              </p>
              <button
                type="button"
                class="button primary"
                disabled={phase === 'taring'}
                onClick={onTareAndStart}
              >
                Tare and start
              </button>
            </section>
          )}

          {running && (
            <section class="live-panel live-current" aria-label="Current step">
              {step ? (
                <>
                  <span class="card-title" data-testid="step-title">
                    {describeStep(step)}
                  </span>
                  {step.note && <span class="card-sub">{step.note}</span>}
                  {distance && (
                    <span class={`live-distance ${distance.kind}`} data-testid="distance">
                      {distance.text}
                    </span>
                  )}
                  {progress !== null && (
                    <div
                      class="progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress * 100)}
                      aria-label="Progress of this pour"
                    >
                      <div class="progress-fill" style={{ width: `${progress * 100}%` }} />
                    </div>
                  )}
                </>
              ) : (
                <span class="card-title">Starting</span>
              )}
              <span class="muted" data-testid="next-line">
                {nextStep && next
                  ? `Next in ${formatDuration(next.inSeconds)}: ${describeStep(nextStep)}`
                  : 'Last step. Let it drain, then press Done.'}
              </span>
              <button type="button" class="button primary" onClick={onDone}>
                Done
              </button>
            </section>
          )}

          {demoScale && (
            <details class="refractometer" open>
              <summary>Demo controls</summary>
              <div class="refractometer-body">
                <div>
                  <span class="stat-label">Speed</span>
                  <div class="segmented" role="group" aria-label="Demo speed">
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={s === speed}
                        onClick={() => onSpeed(s)}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
                <label class="check">
                  <input
                    type="checkbox"
                    checked={autoDemo}
                    onChange={(e) => setAutoDemo((e.target as HTMLInputElement).checked)}
                  />
                  Pour automatically, following the recipe
                </label>
                <div class="row">
                  <button type="button" class="button" onClick={() => demoScale.addWeight(10)}>
                    Add 10 g
                  </button>
                  <button type="button" class="button" onClick={() => demoScale.addWeight(50)}>
                    Add 50 g
                  </button>
                  <button type="button" class="button" onClick={() => demoScale.setShownWeight(0)}>
                    Empty
                  </button>
                </div>
              </div>
            </details>
          )}

          <h2>Steps</h2>
          <ol class="step-list">
            {version.steps.map((s, i) => (
              <li
                key={i}
                class={
                  running && i === stepIndex
                    ? 'step-view active'
                    : running && i < stepIndex
                      ? 'step-view past'
                      : 'step-view'
                }
              >
                <span class="step-time">{formatDuration(s.startSeconds)}</span>
                <span>
                  <span class="step-title">{describeStep(s)}</span>
                  {s.note && <span class="step-note">{s.note}</span>}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
