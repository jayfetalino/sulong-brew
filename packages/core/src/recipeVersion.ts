import type { RecipeStep, RecipeVersion, StepKind, ValveState } from './types';

/** The editable part of a RecipeVersion. Saving these always makes a NEW version. */
export type RecipeVersionFields = Omit<
  RecipeVersion,
  'id' | 'recipeId' | 'versionNumber' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export const STEP_KINDS: StepKind[] = ['pour', 'pause', 'steep', 'drawdown'];

// ---------------------------------------------------------------------------
// Time and ratio helpers
// ---------------------------------------------------------------------------

/** 87 -> "1:27". */
export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "1:27" -> 87. A bare number is read as seconds ("87" -> 87). Returns null if unreadable. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(t);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  if (/^\d{1,4}$/.test(t)) return Number(t);
  return null;
}

/** Water to coffee ratio as text: 20 g and 310 g -> "1:15.5", 20 g and 320 g -> "1:16". */
export function ratioLabel(doseG: number, waterG: number): string {
  if (!(doseG > 0)) return '';
  const ratio = Math.round((waterG / doseG) * 10) / 10;
  return `1:${Number.isInteger(ratio) ? ratio : ratio.toFixed(1)}`;
}

// ---------------------------------------------------------------------------
// Form types (everything is text, as typed)
// ---------------------------------------------------------------------------

export interface StepForm {
  /** Stable key for the screen only. Never saved. */
  key: string;
  kind: StepKind;
  start: string;
  target: string;
  temp: string;
  valve: ValveState | '';
  note: string;
}

export interface RecipeVersionForm {
  doseG: string;
  waterG: string;
  waterTempC: string;
  grindClicks: string;
  grindDescription: string;
  finishMin: string;
  finishMax: string;
  notes: string;
  steps: StepForm[];
}

type FieldKey = Exclude<keyof RecipeVersionForm, 'steps'>;
type StepFieldKey = 'start' | 'target' | 'temp';

export interface RecipeVersionErrors {
  fields: Partial<Record<FieldKey, string>>;
  /** Keyed by step position (0 = first). */
  steps: Record<number, Partial<Record<StepFieldKey, string>>>;
  stepsGeneral?: string;
}

export type RecipeVersionParseResult =
  { ok: true; value: RecipeVersionFields } | { ok: false; errors: RecipeVersionErrors };

export function emptyStepForm(key: string): StepForm {
  return { key, kind: 'pour', start: '0:00', target: '', temp: '', valve: '', note: '' };
}

export function emptyVersionForm(makeKey: () => string): RecipeVersionForm {
  return {
    doseG: '',
    waterG: '',
    waterTempC: '',
    grindClicks: '',
    grindDescription: '',
    finishMin: '',
    finishMax: '',
    notes: '',
    steps: [emptyStepForm(makeKey())],
  };
}

const text = (n: number | null): string => (n === null ? '' : String(n));

export function versionToForm(v: RecipeVersionFields, makeKey: () => string): RecipeVersionForm {
  return {
    doseG: String(v.doseG),
    waterG: String(v.waterG),
    waterTempC: text(v.waterTempC),
    grindClicks: text(v.grindClicks),
    grindDescription: v.grindDescription,
    finishMin: v.finishSecondsMin === null ? '' : formatDuration(v.finishSecondsMin),
    finishMax: v.finishSecondsMax === null ? '' : formatDuration(v.finishSecondsMax),
    notes: v.notes,
    steps: v.steps.map((s) => ({
      key: makeKey(),
      kind: s.kind,
      start: formatDuration(s.startSeconds),
      target: text(s.targetWeightG),
      temp: text(s.tempC),
      valve: s.valve ?? '',
      note: s.note,
    })),
  };
}

// ---------------------------------------------------------------------------
// Parsing and validation
// ---------------------------------------------------------------------------

function parseNumber(value: string): number | null {
  const t = value.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Checks the form. Anything left empty that is allowed to be empty is saved as null (unknown). */
export function parseRecipeVersionForm(form: RecipeVersionForm): RecipeVersionParseResult {
  const errors: RecipeVersionErrors = { fields: {}, steps: {} };

  const dose = parseNumber(form.doseG);
  if (dose === null || Number.isNaN(dose) || dose <= 0)
    errors.fields.doseG = 'Enter a dose above 0';
  const water = parseNumber(form.waterG);
  if (water === null || Number.isNaN(water) || water <= 0) {
    errors.fields.waterG = 'Enter a water weight above 0';
  }

  const waterTemp = parseNumber(form.waterTempC);
  if (waterTemp !== null && (Number.isNaN(waterTemp) || waterTemp <= 0 || waterTemp > 100)) {
    errors.fields.waterTempC = 'Enter a temperature between 1 and 100 C, or leave empty';
  }

  const clicks = parseNumber(form.grindClicks);
  if (clicks !== null && (Number.isNaN(clicks) || clicks < 0)) {
    errors.fields.grindClicks = 'Enter clicks of 0 or more, or leave empty';
  }

  let finishMin: number | null = null;
  if (form.finishMin.trim() !== '') {
    finishMin = parseDuration(form.finishMin);
    if (finishMin === null) errors.fields.finishMin = 'Use m:ss, like 3:00';
  }
  let finishMax: number | null = null;
  if (form.finishMax.trim() !== '') {
    finishMax = parseDuration(form.finishMax);
    if (finishMax === null) errors.fields.finishMax = 'Use m:ss, like 3:20';
  }
  if (finishMin !== null && finishMax !== null && finishMin > finishMax) {
    errors.fields.finishMax = 'Latest finish cannot be before the earliest';
  }

  if (form.steps.length === 0) errors.stepsGeneral = 'Add at least one step';

  const steps: RecipeStep[] = [];
  let prevStart = 0;
  let prevTarget = 0;
  form.steps.forEach((s, i) => {
    const stepErrors: Partial<Record<StepFieldKey, string>> = {};

    const start = parseDuration(s.start);
    if (start === null) stepErrors.start = 'Use m:ss, like 1:27';
    else if (i > 0 && start < prevStart) stepErrors.start = 'Cannot be before the previous step';

    const targetNum = parseNumber(s.target);
    if (targetNum === null) {
      if (s.kind === 'pour') stepErrors.target = 'A pour needs a target weight';
    } else if (Number.isNaN(targetNum) || targetNum <= 0) {
      stepErrors.target = 'Enter a weight above 0';
    } else if (water !== null && !Number.isNaN(water) && targetNum > water) {
      stepErrors.target = 'Cannot be more than the water weight';
    } else if (targetNum < prevTarget) {
      stepErrors.target = 'Cannot be less than the previous target';
    }

    const temp = parseNumber(s.temp);
    if (temp !== null && (Number.isNaN(temp) || temp <= 0 || temp > 100)) {
      stepErrors.temp = 'Enter 1 to 100 C, or leave empty';
    }

    if (Object.keys(stepErrors).length > 0) errors.steps[i] = stepErrors;

    if (start !== null) prevStart = start;
    if (targetNum !== null && !Number.isNaN(targetNum)) prevTarget = targetNum;

    steps.push({
      kind: s.kind,
      startSeconds: start ?? 0,
      targetWeightG: targetNum === null || Number.isNaN(targetNum) ? null : targetNum,
      tempC: temp === null || Number.isNaN(temp) ? null : temp,
      valve: s.valve === '' ? null : s.valve,
      note: s.note.trim(),
    });
  });

  const hasErrors =
    Object.keys(errors.fields).length > 0 ||
    Object.keys(errors.steps).length > 0 ||
    errors.stepsGeneral !== undefined;
  if (hasErrors) return { ok: false, errors };

  return {
    ok: true,
    value: {
      doseG: dose as number,
      waterG: water as number,
      waterTempC: waterTemp,
      grindClicks: clicks,
      grindDescription: form.grindDescription.trim(),
      finishSecondsMin: finishMin,
      finishSecondsMax: finishMax,
      notes: form.notes.trim(),
      steps,
    },
  };
}

// ---------------------------------------------------------------------------
// Comparing versions
// ---------------------------------------------------------------------------

/** A fixed-order text form of the content, so two versions can be compared. */
function contentKey(v: RecipeVersionFields): string {
  return JSON.stringify([
    v.doseG,
    v.waterG,
    v.waterTempC,
    v.grindClicks,
    v.grindDescription,
    v.finishSecondsMin,
    v.finishSecondsMax,
    v.notes,
    v.steps.map((s) => [s.kind, s.startSeconds, s.targetWeightG, s.tempC, s.valve, s.note]),
  ]);
}

/** True if two versions say exactly the same thing. Used to avoid saving empty "new versions". */
export function versionContentEqual(a: RecipeVersionFields, b: RecipeVersionFields): boolean {
  return contentKey(a) === contentKey(b);
}
