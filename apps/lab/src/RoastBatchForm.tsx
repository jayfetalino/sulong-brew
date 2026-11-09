import { useState } from 'preact/hooks';
import {
  parseRoastBatchForm,
  type Coffee,
  type RoastBatch,
  type RoastBatchErrors,
  type RoastBatchForm as FormValues,
  type RoastLevel,
} from '@sulong/core';
import { db } from './db';
import { deleteRoastBatch, saveRoastBatch } from './db/roastBatches';
import { ROAST_LEVEL_LABELS, todayLocal } from './format';

interface Props {
  coffees: Coffee[];
  /** The batch being edited, or undefined when creating a new one. */
  batch?: RoastBatch;
  onDone: () => void;
}

function initialValues(batch: RoastBatch | undefined): FormValues {
  if (!batch) {
    return {
      coffeeId: '',
      roastDate: todayLocal(),
      profileName: '',
      roastLevel: '',
      greenWeightG: '',
      roastedWeightG: '',
      notes: '',
    };
  }
  return {
    coffeeId: batch.coffeeId,
    roastDate: batch.roastDate,
    profileName: batch.profileName ?? '',
    roastLevel: batch.roastLevel,
    greenWeightG: batch.greenWeightG === null ? '' : String(batch.greenWeightG),
    roastedWeightG: batch.roastedWeightG === null ? '' : String(batch.roastedWeightG),
    notes: batch.notes,
  };
}

export function RoastBatchForm({ coffees, batch, onDone }: Props) {
  const [values, setValues] = useState<FormValues>(() => initialValues(batch));
  const [errors, setErrors] = useState<RoastBatchErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const onDelete = async () => {
    if (!batch) return;
    setSaving(true);
    try {
      await deleteRoastBatch(db, batch);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const onCoffeeChange = (coffeeId: string) => {
    const coffee = coffees.find((c) => c.id === coffeeId);
    setValues((v) => ({
      ...v,
      coffeeId,
      // Suggest the coffee's usual roast level, but only if none is chosen yet.
      roastLevel: v.roastLevel === '' && coffee ? coffee.roastLevel : v.roastLevel,
    }));
  };

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    const result = parseRoastBatchForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await saveRoastBatch(db, result.value, batch);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const error = (key: keyof FormValues) =>
    errors[key] ? <span class="field-error">{errors[key]}</span> : null;

  return (
    <form class="form" onSubmit={onSubmit} noValidate>
      <h2>{batch ? 'Edit roast batch' : 'New roast batch'}</h2>

      <label>
        Coffee
        <select
          value={values.coffeeId}
          onChange={(e) => onCoffeeChange((e.target as HTMLSelectElement).value)}
        >
          <option value="">Choose a coffee</option>
          {coffees.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {error('coffeeId')}
      </label>

      <label>
        Roast date
        <input
          type="date"
          value={values.roastDate}
          onInput={(e) => set('roastDate', (e.target as HTMLInputElement).value)}
        />
        {error('roastDate')}
      </label>

      <label>
        Roast level
        <select
          value={values.roastLevel}
          onChange={(e) => set('roastLevel', (e.target as HTMLSelectElement).value as RoastLevel)}
        >
          <option value="">Choose a level</option>
          {(Object.keys(ROAST_LEVEL_LABELS) as RoastLevel[]).map((level) => (
            <option key={level} value={level}>
              {ROAST_LEVEL_LABELS[level]}
            </option>
          ))}
        </select>
        {error('roastLevel')}
      </label>

      <label>
        Kaffelogic profile (optional)
        <input
          type="text"
          value={values.profileName}
          onInput={(e) => set('profileName', (e.target as HTMLInputElement).value)}
        />
      </label>

      <div class="row">
        <label>
          Green weight (g)
          <input
            type="text"
            inputMode="decimal"
            value={values.greenWeightG}
            onInput={(e) => set('greenWeightG', (e.target as HTMLInputElement).value)}
          />
          {error('greenWeightG')}
        </label>
        <label>
          Roasted weight (g)
          <input
            type="text"
            inputMode="decimal"
            value={values.roastedWeightG}
            onInput={(e) => set('roastedWeightG', (e.target as HTMLInputElement).value)}
          />
          {error('roastedWeightG')}
        </label>
      </div>

      <label>
        Notes
        <textarea
          rows={3}
          value={values.notes}
          onInput={(e) => set('notes', (e.target as HTMLTextAreaElement).value)}
        />
      </label>

      <div class="row">
        <button type="submit" class="button primary" disabled={saving}>
          Save
        </button>
        <button type="button" class="button" onClick={onDone}>
          Cancel
        </button>
      </div>

      {batch &&
        (confirmingDelete ? (
          <div class="danger-zone">
            <p>Delete this roast batch? It will disappear from the list on all your devices.</p>
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
            Delete batch
          </button>
        ))}
    </form>
  );
}
