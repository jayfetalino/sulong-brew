import { describe, expect, it } from 'vitest';
import {
  emptyVersionForm,
  formatDuration,
  parseDuration,
  parseRecipeVersionForm,
  ratioLabel,
  versionContentEqual,
  versionToForm,
  type RecipeVersionFields,
} from './recipeVersion';

let counter = 0;
const key = () => `k${++counter}`;

const sample: RecipeVersionFields = {
  doseG: 20,
  waterG: 310,
  waterTempC: 91,
  grindClicks: null,
  grindDescription: 'Medium-fine',
  finishSecondsMin: 180,
  finishSecondsMax: 200,
  notes: 'Ratio 1:15.5.',
  steps: [
    { kind: 'pour', startSeconds: 0, targetWeightG: 40, tempC: null, valve: null, note: 'Bloom' },
    { kind: 'pour', startSeconds: 40, targetWeightG: 220, tempC: null, valve: null, note: '' },
    { kind: 'pause', startSeconds: 80, targetWeightG: 220, tempC: null, valve: null, note: '' },
    { kind: 'pour', startSeconds: 87, targetWeightG: 310, tempC: null, valve: null, note: '' },
    {
      kind: 'drawdown',
      startSeconds: 115,
      targetWeightG: null,
      tempC: null,
      valve: 'open',
      note: '',
    },
  ],
};

describe('formatDuration / parseDuration', () => {
  it('formats seconds as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(87)).toBe('1:27');
    expect(formatDuration(200)).toBe('3:20');
  });

  it('reads m:ss and bare seconds', () => {
    expect(parseDuration('1:27')).toBe(87);
    expect(parseDuration(' 0:00 ')).toBe(0);
    expect(parseDuration('87')).toBe(87);
  });

  it('rejects anything else', () => {
    for (const bad of ['', 'abc', '1:5', '1:60', '-3', '1.5', '1:27:00']) {
      expect(parseDuration(bad)).toBeNull();
    }
  });

  it('round trips', () => {
    for (const s of [0, 5, 59, 60, 87, 195, 600]) expect(parseDuration(formatDuration(s))).toBe(s);
  });
});

describe('ratioLabel', () => {
  it('shows whole and half ratios from the brief', () => {
    expect(ratioLabel(20, 310)).toBe('1:15.5');
    expect(ratioLabel(20, 320)).toBe('1:16');
    expect(ratioLabel(15, 240)).toBe('1:16');
  });

  it('is empty for a dose of 0', () => {
    expect(ratioLabel(0, 300)).toBe('');
  });
});

describe('parseRecipeVersionForm', () => {
  it('turns a version into a form and back without changing it', () => {
    const result = parseRecipeVersionForm(versionToForm(sample, key));
    expect(result).toEqual({ ok: true, value: sample });
  });

  it('keeps unknown optional values as null, never guesses', () => {
    const form = versionToForm(sample, key);
    form.waterTempC = '';
    form.grindClicks = '';
    form.finishMin = '';
    form.finishMax = '';
    const result = parseRecipeVersionForm(form);
    expect(result.ok && result.value.waterTempC).toBeNull();
    expect(result.ok && result.value.grindClicks).toBeNull();
    expect(result.ok && result.value.finishSecondsMin).toBeNull();
    expect(result.ok && result.value.finishSecondsMax).toBeNull();
  });

  it('requires dose and water', () => {
    const result = parseRecipeVersionForm(emptyVersionForm(key));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.fields.doseG).toBeDefined();
      expect(result.errors.fields.waterG).toBeDefined();
      expect(result.errors.steps[0]?.target).toMatch(/needs a target/);
    }
  });

  it('requires at least one step', () => {
    const form = versionToForm(sample, key);
    form.steps = [];
    const result = parseRecipeVersionForm(form);
    expect(!result.ok && result.errors.stepsGeneral).toBeTruthy();
  });

  it('rejects steps out of time order', () => {
    const form = versionToForm(sample, key);
    form.steps[2]!.start = '0:10';
    const result = parseRecipeVersionForm(form);
    expect(!result.ok && result.errors.steps[2]?.start).toMatch(/previous/);
  });

  it('rejects targets that go down or exceed the water weight', () => {
    const down = versionToForm(sample, key);
    down.steps[3]!.target = '100';
    const r1 = parseRecipeVersionForm(down);
    expect(!r1.ok && r1.errors.steps[3]?.target).toMatch(/previous target/);

    const tooMuch = versionToForm(sample, key);
    tooMuch.steps[3]!.target = '400';
    const r2 = parseRecipeVersionForm(tooMuch);
    expect(!r2.ok && r2.errors.steps[3]?.target).toMatch(/water weight/);
  });

  it('rejects a bad temperature and a finish window the wrong way round', () => {
    const form = versionToForm(sample, key);
    form.waterTempC = '150';
    form.finishMin = '3:30';
    form.finishMax = '3:00';
    const result = parseRecipeVersionForm(form);
    expect(!result.ok && result.errors.fields.waterTempC).toBeDefined();
    expect(!result.ok && result.errors.fields.finishMax).toBeDefined();
  });

  it('allows a per-step temperature and valve state', () => {
    const form = versionToForm(sample, key);
    form.steps[0]!.temp = '94';
    form.steps[0]!.valve = 'closed';
    const result = parseRecipeVersionForm(form);
    expect(result.ok && result.value.steps[0]).toMatchObject({ tempC: 94, valve: 'closed' });
  });
});

describe('versionContentEqual', () => {
  it('is true for the same content, even from a different object', () => {
    expect(versionContentEqual(sample, JSON.parse(JSON.stringify(sample)))).toBe(true);
  });

  it('is false when anything changes, including a step note', () => {
    expect(versionContentEqual(sample, { ...sample, doseG: 21 })).toBe(false);
    const steps = sample.steps.map((s, i) => (i === 1 ? { ...s, note: 'changed' } : s));
    expect(versionContentEqual(sample, { ...sample, steps })).toBe(false);
  });
});
