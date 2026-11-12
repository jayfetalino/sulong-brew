import { useState } from 'preact/hooks';
import {
  STEP_KINDS,
  emptyStepForm,
  emptyVersionForm,
  parseRecipeVersionForm,
  versionToForm,
  type Recipe,
  type RecipeVersion,
  type RecipeVersionErrors,
  type RecipeVersionForm,
  type StepForm,
  type StepKind,
  type ValveState,
} from '@sulong/core';
import { db } from './db';
import { createRecipe, saveRecipeEdit } from './db/recipes';
import { STEP_KIND_LABELS } from './format';

interface Props {
  /** The recipe being edited, or undefined when creating a new one. */
  recipe?: Recipe;
  /** The version to start from. Saving always creates a new version. */
  baseVersion?: RecipeVersion;
  onDone: (recipeId?: string) => void;
}

let keyCounter = 0;
const makeKey = () => `step-${++keyCounter}`;

const NO_ERRORS: RecipeVersionErrors = { fields: {}, steps: {} };

const value = (e: Event) =>
  (e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;

export function RecipeEditor({ recipe, baseVersion, onDone }: Props) {
  const [name, setName] = useState(recipe?.name ?? '');
  const [nameError, setNameError] = useState('');
  const [form, setForm] = useState<RecipeVersionForm>(() =>
    baseVersion ? versionToForm(baseVersion, makeKey) : emptyVersionForm(makeKey),
  );
  const [errors, setErrors] = useState<RecipeVersionErrors>(NO_ERRORS);
  const [saving, setSaving] = useState(false);

  const setField = <K extends keyof RecipeVersionForm>(key: K, v: RecipeVersionForm[K]) =>
    setForm((f) => ({ ...f, [key]: v }));

  const setStep = (index: number, patch: Partial<StepForm>) =>
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));

  const addStep = () =>
    setForm((f) => {
      const last = f.steps[f.steps.length - 1];
      return {
        ...f,
        steps: [...f.steps, { ...emptyStepForm(makeKey()), start: last?.start ?? '0:00' }],
      };
    });

  const removeStep = (index: number) =>
    setForm((f) => ({ ...f, steps: f.steps.filter((_, i) => i !== index) }));

  const moveStep = (index: number, direction: -1 | 1) =>
    setForm((f) => {
      const target = index + direction;
      if (target < 0 || target >= f.steps.length) return f;
      const steps = [...f.steps];
      const a = steps[index] as StepForm;
      const b = steps[target] as StepForm;
      steps[index] = b;
      steps[target] = a;
      return { ...f, steps };
    });

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    const trimmed = name.trim();
    const result = parseRecipeVersionForm(form);
    setNameError(trimmed === '' ? 'Give the recipe a name' : '');
    if (!result.ok) setErrors(result.errors);
    else setErrors(NO_ERRORS);
    if (!result.ok || trimmed === '') return;

    setSaving(true);
    try {
      const saved = recipe
        ? await saveRecipeEdit(db, recipe, trimmed, result.value)
        : await createRecipe(db, trimmed, result.value);
      onDone(saved.recipe.id);
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: keyof RecipeVersionErrors['fields']) =>
    errors.fields[key] ? <span class="field-error">{errors.fields[key]}</span> : null;

  return (
    <form class="form" onSubmit={onSubmit} noValidate>
      <h2>
        {!recipe
          ? 'New recipe'
          : baseVersion
            ? `New version of ${recipe.name} (from v${baseVersion.versionNumber})`
            : 'Edit recipe'}
      </h2>
      {recipe && (
        <p class="muted">
          Saving makes a new version. Older versions are never changed, so past brews still point at
          the exact recipe you used.
        </p>
      )}

      <label>
        Recipe name
        <input type="text" value={name} onInput={(e) => setName(value(e))} />
        {nameError && <span class="field-error">{nameError}</span>}
      </label>

      <div class="row">
        <label>
          Dose (g)
          <input
            type="text"
            inputMode="decimal"
            value={form.doseG}
            onInput={(e) => setField('doseG', value(e))}
          />
          {fieldError('doseG')}
        </label>
        <label>
          Water (g)
          <input
            type="text"
            inputMode="decimal"
            value={form.waterG}
            onInput={(e) => setField('waterG', value(e))}
          />
          {fieldError('waterG')}
        </label>
      </div>

      <label>
        Water temperature (C, leave empty if unknown)
        <input
          type="text"
          inputMode="decimal"
          value={form.waterTempC}
          onInput={(e) => setField('waterTempC', value(e))}
        />
        {fieldError('waterTempC')}
      </label>

      <div class="row">
        <label>
          Grinder clicks (private)
          <input
            type="text"
            inputMode="decimal"
            value={form.grindClicks}
            onInput={(e) => setField('grindClicks', value(e))}
          />
          {fieldError('grindClicks')}
        </label>
        <label>
          Grind, in words (public)
          <input
            type="text"
            value={form.grindDescription}
            onInput={(e) => setField('grindDescription', value(e))}
          />
        </label>
      </div>

      <div class="row">
        <label>
          Finish from (m:ss)
          <input
            type="text"
            value={form.finishMin}
            onInput={(e) => setField('finishMin', value(e))}
          />
          {fieldError('finishMin')}
        </label>
        <label>
          Finish by (m:ss)
          <input
            type="text"
            value={form.finishMax}
            onInput={(e) => setField('finishMax', value(e))}
          />
          {fieldError('finishMax')}
        </label>
      </div>

      <label>
        Notes
        <textarea rows={2} value={form.notes} onInput={(e) => setField('notes', value(e))} />
      </label>

      <h2>Steps</h2>
      <p class="muted">
        Time is m:ss from the start. The target is the total scale weight to reach, not the amount
        to add.
      </p>
      {errors.stepsGeneral && <span class="field-error">{errors.stepsGeneral}</span>}

      <ol class="step-list">
        {form.steps.map((step, i) => {
          const stepErrors = errors.steps[i] ?? {};
          return (
            <li key={step.key} class="step-edit">
              <div class="step-head">
                <strong>Step {i + 1}</strong>
                <span class="step-tools">
                  <button
                    type="button"
                    class="icon-button"
                    aria-label={`Move step ${i + 1} up`}
                    disabled={i === 0}
                    onClick={() => moveStep(i, -1)}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    class="icon-button"
                    aria-label={`Move step ${i + 1} down`}
                    disabled={i === form.steps.length - 1}
                    onClick={() => moveStep(i, 1)}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    class="icon-button"
                    aria-label={`Remove step ${i + 1}`}
                    onClick={() => removeStep(i)}
                  >
                    Remove
                  </button>
                </span>
              </div>

              <div class="row">
                <label>
                  Type
                  <select
                    value={step.kind}
                    onChange={(e) => setStep(i, { kind: value(e) as StepKind })}
                  >
                    {STEP_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {STEP_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Start (m:ss)
                  <input
                    type="text"
                    value={step.start}
                    onInput={(e) => setStep(i, { start: value(e) })}
                  />
                  {stepErrors.start && <span class="field-error">{stepErrors.start}</span>}
                </label>
              </div>

              <div class="row">
                <label>
                  Target weight (g)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={step.target}
                    onInput={(e) => setStep(i, { target: value(e) })}
                  />
                  {stepErrors.target && <span class="field-error">{stepErrors.target}</span>}
                </label>
                <label>
                  Temp (C, optional)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={step.temp}
                    onInput={(e) => setStep(i, { temp: value(e) })}
                  />
                  {stepErrors.temp && <span class="field-error">{stepErrors.temp}</span>}
                </label>
              </div>

              <label>
                Switch valve (optional)
                <select
                  value={step.valve}
                  onChange={(e) => setStep(i, { valve: value(e) as ValveState | '' })}
                >
                  <option value="">Not set</option>
                  <option value="closed">Closed</option>
                  <option value="open">Open</option>
                </select>
              </label>

              <label>
                Note
                <input
                  type="text"
                  value={step.note}
                  onInput={(e) => setStep(i, { note: value(e) })}
                />
              </label>
            </li>
          );
        })}
      </ol>

      <button type="button" class="button" onClick={addStep}>
        Add step
      </button>

      <div class="row">
        <button type="submit" class="button primary" disabled={saving}>
          {recipe ? 'Save as new version' : 'Save recipe'}
        </button>
        <button type="button" class="button" onClick={() => onDone(recipe?.id)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
