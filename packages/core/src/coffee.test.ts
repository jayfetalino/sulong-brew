import { describe, expect, it } from 'vitest';
import { parseCoffeeForm } from './coffee';

const good = { name: 'Kenya Kiambu AA', roastLevel: 'light', espressoPrimary: false } as const;

describe('parseCoffeeForm', () => {
  it('accepts a good form and returns the fields', () => {
    expect(parseCoffeeForm(good, [])).toEqual({
      ok: true,
      value: { name: 'Kenya Kiambu AA', roastLevel: 'light', espressoPrimary: false },
    });
  });

  it('keeps the espresso flag', () => {
    const r = parseCoffeeForm({ ...good, espressoPrimary: true }, []);
    expect(r.ok && r.value.espressoPrimary).toBe(true);
  });

  it('trims the name and squeezes inner spaces', () => {
    const r = parseCoffeeForm({ ...good, name: '  Kenya   Kiambu  ' }, []);
    expect(r.ok && r.value.name).toBe('Kenya Kiambu');
  });

  it('needs a name', () => {
    for (const name of ['', '   ']) {
      expect(parseCoffeeForm({ ...good, name }, [])).toEqual({
        ok: false,
        errors: { name: 'Enter a name' },
      });
    }
  });

  it('refuses a name over 100 characters', () => {
    const r = parseCoffeeForm({ ...good, name: 'a'.repeat(101) }, []);
    expect(r).toMatchObject({ ok: false, errors: { name: 'Use 100 characters or fewer' } });
    expect(parseCoffeeForm({ ...good, name: 'a'.repeat(100) }, []).ok).toBe(true);
  });

  it('needs a roast level, and only the three known ones', () => {
    expect(parseCoffeeForm({ ...good, roastLevel: '' }, [])).toMatchObject({
      ok: false,
      errors: { roastLevel: 'Pick a roast level' },
    });
    expect(parseCoffeeForm({ ...good, roastLevel: 'dark' as never }, []).ok).toBe(false);
  });

  it('refuses a name that is already used, ignoring case and spacing', () => {
    const others = [{ name: 'Peru Gesha dry process' }];
    for (const name of ['peru gesha DRY process', ' Peru  Gesha dry process ']) {
      expect(parseCoffeeForm({ ...good, name }, others)).toMatchObject({
        ok: false,
        errors: { name: 'You already have a coffee with this name' },
      });
    }
  });

  it('reports every problem at once', () => {
    const r = parseCoffeeForm({ name: '', roastLevel: '', espressoPrimary: false }, []);
    expect(r.ok === false && Object.keys(r.errors).sort()).toEqual(['name', 'roastLevel']);
  });

  it('uses no em-dashes in its messages', () => {
    const r = parseCoffeeForm({ name: '', roastLevel: '', espressoPrimary: false }, []);
    expect(JSON.stringify(r)).not.toContain(String.fromCharCode(0x2014));
  });
});
