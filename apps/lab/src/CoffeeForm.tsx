import { useState } from 'preact/hooks';
import {
  parseCoffeeForm,
  type Coffee,
  type CoffeeErrors,
  type CoffeeForm as FormValues,
  type RoastLevel,
} from '@sulong/core';
import { db } from './db';
import { deleteCoffee, saveCoffee } from './db/coffees';
import { ROAST_LEVEL_LABELS } from './format';

interface Props {
  /** The coffee being edited, or undefined when adding a new one. */
  coffee?: Coffee;
  /** The other coffees that exist (not deleted, not this one), to stop a name being used twice. */
  others: Coffee[];
  /** Called when the form closes. `saved` is the coffee that was saved, if any. */
  onDone: (saved?: Coffee, deleted?: boolean) => void;
}

export function CoffeeForm({ coffee, others, onDone }: Props) {
  const [values, setValues] = useState<FormValues>({
    name: coffee?.name ?? '',
    roastLevel: coffee?.roastLevel ?? '',
    espressoPrimary: coffee?.espressoPrimary ?? false,
  });
  const [errors, setErrors] = useState<CoffeeErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteProblem, setDeleteProblem] = useState<string | null>(null);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    const result = parseCoffeeForm(values, others);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      onDone(await saveCoffee(db, result.value, coffee));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!coffee) return;
    setSaving(true);
    try {
      const result = await deleteCoffee(db, coffee);
      if (result.ok) {
        onDone(undefined, true);
      } else {
        setConfirmingDelete(false);
        setDeleteProblem(
          result.batchCount === 1
            ? '1 roast batch still uses this coffee. Delete that batch first, or give it another coffee.'
            : `${result.batchCount} roast batches still use this coffee. Delete those batches first, or give them another coffee.`,
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form class="form" onSubmit={onSubmit} noValidate>
      <h2>{coffee ? 'Edit coffee' : 'New coffee'}</h2>

      <label>
        Name
        <input
          type="text"
          value={values.name}
          placeholder="For example: Kenya Kiambu washed"
          onInput={(e) => set('name', (e.target as HTMLInputElement).value)}
        />
        {errors.name && <span class="field-error">{errors.name}</span>}
      </label>

      <label>
        Usual roast level
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
        {errors.roastLevel && <span class="field-error">{errors.roastLevel}</span>}
      </label>

      <label class="check">
        <input
          type="checkbox"
          checked={values.espressoPrimary}
          onChange={(e) => set('espressoPrimary', (e.target as HTMLInputElement).checked)}
        />
        Mainly for espresso
      </label>

      <div class="row">
        <button type="submit" class="button primary" disabled={saving}>
          Save coffee
        </button>
        <button type="button" class="button" onClick={() => onDone()}>
          Cancel
        </button>
      </div>

      {coffee &&
        (confirmingDelete ? (
          <div class="danger-zone">
            <p>Delete this coffee? It will disappear from the list on all your devices.</p>
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
          <>
            {deleteProblem && (
              <p class="field-error" role="alert">
                {deleteProblem}
              </p>
            )}
            <button
              type="button"
              class="button danger-outline"
              onClick={() => {
                setDeleteProblem(null);
                setConfirmingDelete(true);
              }}
            >
              Delete coffee
            </button>
          </>
        ))}
    </form>
  );
}
