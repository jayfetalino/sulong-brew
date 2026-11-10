import '@fontsource/fraunces/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import './styles.css';
import logoUrl from './assets/sulong-roastery-v3-sticker.svg';
import snapshotJson from './snapshot.json';
import { h } from './dom';
import { nextStepAfter, stepIndexAt } from './timer';
import type { GuideSnapshot, TempUnit, WeightUnit } from './types';
import { formatClock, formatTemp, formatWeight, ratioLabel, stepTitle } from './units';

const snapshot = snapshotJson as GuideSnapshot;
const PREFS_KEY = 'sulong-guide-prefs';

type Tab = 'filter' | 'espresso';
type TimerStatus = 'idle' | 'running' | 'paused';

const state = {
  tab: 'filter' as Tab,
  temp: 'C' as TempUnit,
  weight: 'g' as WeightUnit,
  timer: { status: 'idle' as TimerStatus, accumulatedMs: 0, startedAt: 0 },
};

// ---- Remember unit choices on this device (works without it if storage is blocked) ----

function loadPrefs(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as {
      temp?: string;
      weight?: string;
    };
    if (saved.temp === 'C' || saved.temp === 'F') state.temp = saved.temp;
    if (saved.weight === 'g' || saved.weight === 'oz') state.weight = saved.weight;
  } catch {
    // Storage blocked or unreadable: keep the defaults.
  }
}

function savePrefs(): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ temp: state.temp, weight: state.weight }));
  } catch {
    // Storage blocked: the choice just will not be remembered.
  }
}

// ---- Timer ----

function elapsedSeconds(): number {
  const t = state.timer;
  const running = t.status === 'running' ? Date.now() - t.startedAt : 0;
  return (t.accumulatedMs + running) / 1000;
}

type WakeLockLike = { release(): Promise<void> };
let wakeLock: WakeLockLike | null = null;

async function keepScreenOn(on: boolean): Promise<void> {
  try {
    if (on) wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    else {
      await wakeLock?.release();
      wakeLock = null;
    }
  } catch {
    // Not supported or refused: the timer still works, the screen may just dim.
  }
}

function startTimer(): void {
  state.timer.status = 'running';
  state.timer.startedAt = Date.now();
  void keepScreenOn(true);
  updateTimerView();
}

function pauseTimer(): void {
  state.timer.accumulatedMs += Date.now() - state.timer.startedAt;
  state.timer.status = 'paused';
  void keepScreenOn(false);
  updateTimerView();
}

function resetTimer(): void {
  state.timer = { status: 'idle', accumulatedMs: 0, startedAt: 0 };
  void keepScreenOn(false);
  updateTimerView();
}

document.addEventListener('visibilitychange', () => {
  // Screen locks release the wake lock; take it again when the page comes back.
  if (document.visibilityState === 'visible' && state.timer.status === 'running') {
    void keepScreenOn(true);
  }
});

setInterval(() => {
  if (state.timer.status === 'running') updateTimerView();
}, 200);

// ---- Rendering ----

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

const ROAST_LEVEL_LABELS = { light: 'Light', medium: 'Medium', 'medium-dark': 'Medium-dark' };

function formatRoastDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function segmented<T extends string>(
  label: string,
  options: { value: T; text: string }[],
  current: T,
  onPick: (value: T) => void,
): HTMLElement {
  return h(
    'div',
    { class: 'segmented', attrs: { role: 'group', 'aria-label': label } },
    ...options.map((o) =>
      h('button', {
        text: o.text,
        attrs: { type: 'button', 'aria-pressed': String(o.value === current) },
        on: { click: () => onPick(o.value) },
      }),
    ),
  );
}

function renderMasthead(): HTMLElement {
  const c = snapshot.coffee;
  const coffeeLine = c
    ? [
        c.name,
        `${ROAST_LEVEL_LABELS[c.roastLevel]} roast`,
        c.roastDate ? `Roasted ${formatRoastDate(c.roastDate)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  return h(
    'header',
    { class: 'masthead' },
    h('img', { class: 'logo', attrs: { src: logoUrl, alt: 'Sulong Coffee' } }),
    h(
      'div',
      {},
      h('p', { class: 'eyebrow', text: 'Sulong Coffee brew guide' }),
      h('h1', { text: snapshot.recipeName }),
      coffeeLine ? h('p', { class: 'coffee-line', text: coffeeLine }) : null,
    ),
  );
}

function renderFacts(): HTMLElement {
  const fact = (label: string, value: string) =>
    h('div', { class: 'fact' }, h('dt', { text: label }), h('dd', { text: value }));

  const finish =
    snapshot.finishSecondsMin !== null && snapshot.finishSecondsMax !== null
      ? `${formatClock(snapshot.finishSecondsMin)} to ${formatClock(snapshot.finishSecondsMax)}`
      : null;

  return h(
    'dl',
    { class: 'facts' },
    fact('Coffee', formatWeight(snapshot.doseG, state.weight)),
    fact('Water', formatWeight(snapshot.waterG, state.weight)),
    fact('Ratio', ratioLabel(snapshot.doseG, snapshot.waterG)),
    snapshot.waterTempC === null
      ? null
      : fact('Water temp', formatTemp(snapshot.waterTempC, state.temp)),
    snapshot.grindDescription ? fact('Grind', snapshot.grindDescription) : null,
    finish ? fact('Finish', finish) : null,
  );
}

function renderTimer(): HTMLElement {
  return h(
    'section',
    { class: 'timer', attrs: { 'aria-label': 'Timer' } },
    h('div', { class: 'clock', text: '0:00', attrs: { id: 'clock' } }),
    h('p', { class: 'next-line', attrs: { id: 'next-line' } }),
    h(
      'div',
      { class: 'timer-buttons' },
      h('button', {
        class: 'button primary',
        attrs: { type: 'button', id: 'timer-main' },
        on: {
          click: () => (state.timer.status === 'running' ? pauseTimer() : startTimer()),
        },
      }),
      h('button', {
        class: 'button',
        text: 'Reset',
        attrs: { type: 'button' },
        on: { click: resetTimer },
      }),
    ),
  );
}

function renderSteps(): HTMLElement {
  return h(
    'ol',
    { class: 'steps' },
    ...snapshot.steps.map((step, i) => {
      const meta = [
        step.tempC === null ? null : formatTemp(step.tempC, state.temp),
        step.valve === null ? null : `valve ${step.valve}`,
      ].filter(Boolean);
      return h(
        'li',
        { class: 'step', attrs: { 'data-index': String(i) } },
        h('span', { class: 'step-time', text: formatClock(step.startSeconds) }),
        h(
          'span',
          {},
          h('span', { class: 'step-title', text: stepTitle(step, state.weight) }),
          meta.length > 0
            ? h('span', { class: 'step-meta', text: ` · ${meta.join(' · ')}` })
            : null,
          step.note ? h('span', { class: 'step-note', text: step.note }) : null,
        ),
      );
    }),
  );
}

function renderFilterPanel(): HTMLElement {
  const finish =
    snapshot.finishSecondsMin !== null && snapshot.finishSecondsMax !== null
      ? `Aim to finish between ${formatClock(snapshot.finishSecondsMin)} and ${formatClock(snapshot.finishSecondsMax)}.`
      : null;
  return h(
    'section',
    { attrs: { role: 'tabpanel', id: 'panel-filter' } },
    renderFacts(),
    renderTimer(),
    h('h2', { text: 'Steps' }),
    renderSteps(),
    finish ? h('p', { class: 'finish', text: finish }) : null,
  );
}

function renderEspressoPanel(): HTMLElement {
  return h(
    'section',
    { attrs: { role: 'tabpanel', id: 'panel-espresso' } },
    h('p', {
      class: 'empty',
      text: 'The espresso recipe for this coffee is coming soon.',
    }),
  );
}

function render(): void {
  const tabButton = (tab: Tab, text: string) =>
    h('button', {
      text,
      attrs: {
        type: 'button',
        role: 'tab',
        'aria-selected': String(state.tab === tab),
        'aria-controls': `panel-${tab}`,
      },
      on: {
        click: () => {
          state.tab = tab;
          render();
        },
      },
    });

  const toggles = h(
    'div',
    { class: 'controls' },
    h(
      'div',
      { class: 'units' },
      segmented<TempUnit>(
        'Temperature unit',
        [
          { value: 'C', text: '°C' },
          { value: 'F', text: '°F' },
        ],
        state.temp,
        (value) => {
          state.temp = value;
          savePrefs();
          render();
        },
      ),
      segmented<WeightUnit>(
        'Weight unit',
        [
          { value: 'g', text: 'g' },
          { value: 'oz', text: 'oz' },
        ],
        state.weight,
        (value) => {
          state.weight = value;
          savePrefs();
          render();
        },
      ),
    ),
  );

  root!.replaceChildren(
    h(
      'main',
      { class: 'page' },
      renderMasthead(),
      h(
        'div',
        { class: 'segmented tabs', attrs: { role: 'tablist', 'aria-label': 'Brew method' } },
        tabButton('filter', 'Filter'),
        tabButton('espresso', 'Espresso'),
      ),
      toggles,
      state.tab === 'filter' ? renderFilterPanel() : renderEspressoPanel(),
      h('p', {
        class: 'footer',
        text: `Recipe version ${snapshot.versionNumber}. No account needed.`,
      }),
    ),
  );
  updateTimerView();
}

/** Updates only the parts that change every tick, so the page does not flicker. */
function updateTimerView(): void {
  const clock = document.getElementById('clock');
  const nextLine = document.getElementById('next-line');
  const main = document.getElementById('timer-main');
  if (!clock || !nextLine || !main) return; // Espresso tab has no timer.

  const seconds = elapsedSeconds();
  const status = state.timer.status;
  clock.textContent = formatClock(seconds);
  main.textContent = status === 'running' ? 'Pause' : status === 'paused' ? 'Resume' : 'Start';

  const current = status === 'idle' ? -1 : stepIndexAt(snapshot.steps, seconds);
  document.querySelectorAll<HTMLElement>('.step').forEach((card) => {
    const index = Number(card.dataset.index);
    card.classList.toggle('active', index === current);
    card.classList.toggle('past', current !== -1 && index < current);
  });

  if (status === 'idle') {
    nextLine.textContent = 'Press Start when the first water touches the coffee.';
    return;
  }
  const next = nextStepAfter(snapshot.steps, seconds);
  const nextStep = next ? snapshot.steps[next.index] : undefined;
  nextLine.textContent =
    next && nextStep
      ? `Next in ${formatClock(next.inSeconds)}: ${stepTitle(nextStep, state.weight)}`
      : 'Last step. Let it drain.';
}

loadPrefs();
render();
