import { useState } from 'preact/hooks';
import {
  RATING_ATTRIBUTES,
  RATING_VALUES,
  extractionYield,
  formatDuration,
  parseBrewForm,
  roundTo,
  type Brew,
  type BrewErrors,
  type BrewForm as FormValues,
  type Coffee,
  type Recipe,
  type RecipeVersion,
  type RoastBatch,
} from '@sulong/core';
import { db } from './db';
import { deleteBrew, saveBrew } from './db/brews';
import { todayLocal } from './format';
import { RefractometerPanel } from './RefractometerPanel';

interface Props {
  recipes: Recipe[];
  versions: RecipeVersion[];
  batches: RoastBatch[];
  coffees: Coffee[];
  /** Tags used on earlier brews, offered as quick taps. */
  knownTags: string[];
  /** The brew being edited, or undefined when logging a new one. */
  brew?: Brew;
  /** For a new brew, start from the same recipe version and roast batch as this one. */
  lastBrew?: Brew;
  onDone: () => void;
}

const text = (n: number | null) => (n === null ? '' : String(n));
const value = (e: Event) =>
  (e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;

function initialValues(
  brew: Brew | undefined,
  lastBrew: Brew | undefined,
  versions: RecipeVersion[],
  batches: RoastBatch[],
): FormValues {
  if (brew) {
    return {
      recipeVersionId: brew.recipeVersionId,
      roastBatchId: brew.roastBatchId,
      brewDate: brew.brewDate,
      doseG: String(brew.doseG),
      yieldG: text(brew.yieldG),
      brewTime: brew.brewSeconds === null ? '' : formatDuration(brew.brewSeconds),
      waterTempC: text(brew.waterTempC),
      grindClicks: text(brew.grindClicks),
      tdsPercent: text(brew.tdsPercent),
      // Brews saved before this field existed have no source, which means typed by hand.
      tdsSource: brew.tdsPercent === null ? '' : (brew.tdsSource ?? 'manual'),
      rating: text(brew.rating),
      attributeRatings: Object.fromEntries(
        Object.entries(brew.attributeRatings).map(([k, v]) => [k, String(v)]),
      ),
      tags: brew.tags.join(', '),
      notes: brew.notes,
    };
  }
  const startVersion = versions.find((v) => v.id === lastBrew?.recipeVersionId);
  const startBatch = batches.find((b) => b.id === lastBrew?.roastBatchId) ?? batches[0];
  return {
    recipeVersionId: startVersion?.id ?? '',
    roastBatchId: startBatch?.id ?? '',
    brewDate: todayLocal(),
    doseG: startVersion ? String(startVersion.doseG) : '',
    yieldG: '',
    brewTime: '',
    waterTempC: startVersion ? text(startVersion.waterTempC) : '',
    grindClicks: startVersion ? text(startVersion.grindClicks) : '',
    tdsPercent: '',
    tdsSource: '',
    rating: '',
    attributeRatings: {},
    tags: '',
    notes: '',
  };
}

function ScoreSelect(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label>
      {props.label}
      <select value={props.value} onChange={(e) => props.onChange(value(e))}>
        <option value="">Not rated</option>
        {RATING_VALUES.map((n) => (
          <option key={n} value={String(n)}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

export function BrewForm({
  recipes,
  versions,
  batches,
  coffees,
  knownTags,
  brew,
  lastBrew,
  onDone,
}: Props) {
  const [values, setValues] = useState<FormValues>(() =>
    initialValues(brew, lastBrew, versions, batches),
  );
  const [errors, setErrors] = useState<BrewErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const set = <K extends keyof FormValues>(key: K, v: FormValues[K]) =>
    setValues((f) => ({ ...f, [key]: v }));

  const recipeName = (id: string) => recipes.find((r) => r.id === id)?.name;
  const coffeeName = (b: RoastBatch) =>
    coffees.find((c) => c.id === b.coffeeId)?.name ?? 'Unknown coffee';

  // Versions of live recipes, plus the one this brew already uses (even if its recipe was deleted).
  const versionOptions = versions
    .filter((v) => recipeName(v.recipeId) !== undefined || v.id === brew?.recipeVersionId)
    .sort(
      (a, b) =>
        (recipeName(a.recipeId) ?? '~').localeCompare(recipeName(b.recipeId) ?? '~') ||
        b.versionNumber - a.versionNumber,
    );
  const versionLabel = (v: RecipeVersion) => {
    const recipe = recipes.find((r) => r.id === v.recipeId);
    const name = recipe?.name ?? 'Deleted recipe';
    return `${name} · v${v.versionNumber}${recipe?.currentVersionId === v.id ? ' (current)' : ''}`;
  };

  const batchOptions = batches.filter((b) => !b.deletedAt || b.id === brew?.roastBatchId);

  const onVersionChange = (id: string) => {
    const next = versions.find((v) => v.id === id);
    const prev = versions.find((v) => v.id === values.recipeVersionId);
    setValues((f) => {
      if (!next || brew) return { ...f, recipeVersionId: id };
      // Fill dose, temp and clicks from the recipe, but never overwrite something you typed.
      const keep = (current: string, prevValue: string) => current === '' || current === prevValue;
      return {
        ...f,
        recipeVersionId: id,
        doseG: keep(f.doseG, prev ? String(prev.doseG) : '') ? String(next.doseG) : f.doseG,
        waterTempC: keep(f.waterTempC, prev ? text(prev.waterTempC) : '')
          ? text(next.waterTempC)
          : f.waterTempC,
        grindClicks: keep(f.grindClicks, prev ? text(prev.grindClicks) : '')
          ? text(next.grindClicks)
          : f.grindClicks,
      };
    });
  };

  // Live extraction yield while typing.
  const dose = Number(values.doseG);
  const beverage = Number(values.yieldG);
  const tds = Number(values.tdsPercent);
  const ey =
    values.yieldG.trim() !== '' &&
    values.tdsPercent.trim() !== '' &&
    dose > 0 &&
    beverage > 0 &&
    tds > 0
      ? roundTo(extractionYield(beverage, tds, dose), 1)
      : null;

  const addTag = (tag: string) => {
    const existing = values.tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (!existing.includes(tag)) set('tags', [...existing, tag].join(', '));
  };

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    const result = parseBrewForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await saveBrew(db, result.value, brew);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!brew) return;
    setSaving(true);
    try {
      await deleteBrew(db, brew);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const error = (key: Exclude<keyof FormValues, 'attributeRatings'>) =>
    errors[key] ? <span class="field-error">{errors[key]}</span> : null;

  const noSetup = versionOptions.length === 0 || batchOptions.length === 0;

  return (
    <form class="form" onSubmit={onSubmit} noValidate>
      <h2>{brew ? 'Edit brew' : 'New brew'}</h2>

      {noSetup && !brew && (
        <p class="muted">
          To log a brew you need at least one recipe and one roast batch. Add them on the Recipes
          and Roasts tabs first.
        </p>
      )}

      <label>
        Recipe version
        <select value={values.recipeVersionId} onChange={(e) => onVersionChange(value(e))}>
          <option value="">Choose a recipe version</option>
          {versionOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {versionLabel(v)}
            </option>
          ))}
        </select>
        {error('recipeVersionId')}
      </label>

      <label>
        Roast batch
        <select value={values.roastBatchId} onChange={(e) => set('roastBatchId', value(e))}>
          <option value="">Choose a roast batch</option>
          {batchOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {coffeeName(b)} · roasted {b.roastDate}
            </option>
          ))}
        </select>
        {error('roastBatchId')}
      </label>

      <label>
        Brew date
        <input type="date" value={values.brewDate} onInput={(e) => set('brewDate', value(e))} />
        {error('brewDate')}
      </label>

      <div class="row">
        <label>
          Dose (g)
          <input
            type="text"
            inputMode="decimal"
            value={values.doseG}
            onInput={(e) => set('doseG', value(e))}
          />
          {error('doseG')}
        </label>
        <label>
          Yield in cup (g)
          <input
            type="text"
            inputMode="decimal"
            value={values.yieldG}
            onInput={(e) => set('yieldG', value(e))}
          />
          {error('yieldG')}
        </label>
      </div>

      <div class="row">
        <label>
          Brew time (m:ss)
          <input type="text" value={values.brewTime} onInput={(e) => set('brewTime', value(e))} />
          {error('brewTime')}
        </label>
        <label>
          TDS (%)
          <input
            type="text"
            inputMode="decimal"
            value={values.tdsPercent}
            onInput={(e) => {
              // Typing over a reading means the number is now typed by hand.
              const typed = value(e);
              setValues((f) => ({
                ...f,
                tdsPercent: typed,
                tdsSource: typed.trim() === '' ? '' : 'manual',
              }));
            }}
          />
          {error('tdsPercent')}
        </label>
      </div>

      {values.tdsSource === 'demo' && (
        <p class="demo-note">
          <span class="badge demo">Demo reading</span> This TDS was made up by the demo device, not
          measured.
        </p>
      )}
      {values.tdsSource === 'refractometer' && (
        <p class="data-line">TDS read from the refractometer.</p>
      )}

      <p class="data-line">
        Extraction yield:{' '}
        {ey === null
          ? 'enter yield and TDS'
          : `${ey.toFixed(1)} %${values.tdsSource === 'demo' ? ' (from a demo reading)' : ''}`}
      </p>

      <RefractometerPanel
        onReading={(tdsPercent, source) =>
          setValues((f) => ({ ...f, tdsPercent: String(tdsPercent), tdsSource: source }))
        }
      />

      <div class="row">
        <label>
          Water temp used (C)
          <input
            type="text"
            inputMode="decimal"
            value={values.waterTempC}
            onInput={(e) => set('waterTempC', value(e))}
          />
          {error('waterTempC')}
        </label>
        <label>
          Grinder clicks used
          <input
            type="text"
            inputMode="decimal"
            value={values.grindClicks}
            onInput={(e) => set('grindClicks', value(e))}
          />
          {error('grindClicks')}
        </label>
      </div>

      <ScoreSelect
        label="Overall rating (1 to 5)"
        value={values.rating}
        onChange={(v) => set('rating', v)}
      />
      {error('rating')}

      <details class="cupping">
        <summary>Cupping notes (optional)</summary>
        <div class="cupping-grid">
          {RATING_ATTRIBUTES.map((a) => (
            <ScoreSelect
              key={a.id}
              label={a.label}
              value={values.attributeRatings[a.id] ?? ''}
              onChange={(v) => set('attributeRatings', { ...values.attributeRatings, [a.id]: v })}
            />
          ))}
        </div>
        {errors.attributeRatings && <span class="field-error">{errors.attributeRatings}</span>}
      </details>

      <label>
        Tags (separate with commas)
        <input type="text" value={values.tags} onInput={(e) => set('tags', value(e))} />
      </label>
      {knownTags.length > 0 && (
        <div class="chips" role="group" aria-label="Tags used before">
          {knownTags.map((tag) => (
            <button key={tag} type="button" class="chip" onClick={() => addTag(tag)}>
              {tag}
            </button>
          ))}
        </div>
      )}

      <label>
        Notes
        <textarea rows={3} value={values.notes} onInput={(e) => set('notes', value(e))} />
      </label>

      <div class="row">
        <button type="submit" class="button primary" disabled={saving || (noSetup && !brew)}>
          Save
        </button>
        <button type="button" class="button" onClick={onDone}>
          Cancel
        </button>
      </div>

      {brew &&
        (confirmingDelete ? (
          <div class="danger-zone">
            <p>Delete this brew? It will disappear from the list on all your devices.</p>
            <div class="row">
              <button type="button" class="button danger" disabled={saving} onClick={onDelete}>
                Yes, delete
              </button>
              <button type="button" class="button" onClick={() => setConfirmingDelete(false)}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            class="button danger-outline"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete brew
          </button>
        ))}
    </form>
  );
}
