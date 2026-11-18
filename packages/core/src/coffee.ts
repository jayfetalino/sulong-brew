import type { Coffee, RoastLevel } from './types';

/** What the coffee form holds: the name is text as typed. */
export interface CoffeeForm {
  name: string;
  roastLevel: RoastLevel | '';
  espressoPrimary: boolean;
}

/** The editable part of a Coffee (everything except id and timestamps). */
export type CoffeeFields = Pick<Coffee, 'name' | 'roastLevel' | 'espressoPrimary'>;

export type CoffeeErrors = Partial<Record<keyof CoffeeForm, string>>;

export type ParseCoffeeResult =
  { ok: true; value: CoffeeFields } | { ok: false; errors: CoffeeErrors };

const LEVELS: RoastLevel[] = ['light', 'medium', 'medium-dark'];

/** Lower case, trimmed, single spaces: so "Peru  gesha" and "peru gesha" count as the same name. */
function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Checks the coffee form. `others` are the coffees that already exist (not deleted), without the
 * one being edited, so a name cannot be used twice.
 */
export function parseCoffeeForm(
  form: CoffeeForm,
  others: readonly Pick<Coffee, 'name'>[],
): ParseCoffeeResult {
  const errors: CoffeeErrors = {};
  const name = form.name.trim().replace(/\s+/g, ' ');

  if (name === '') errors.name = 'Enter a name';
  else if (name.length > 100) errors.name = 'Use 100 characters or fewer';
  else if (others.some((c) => nameKey(c.name) === nameKey(name))) {
    errors.name = 'You already have a coffee with this name';
  }

  if (!LEVELS.includes(form.roastLevel as RoastLevel)) errors.roastLevel = 'Pick a roast level';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      roastLevel: form.roastLevel as RoastLevel,
      espressoPrimary: form.espressoPrimary,
    },
  };
}
