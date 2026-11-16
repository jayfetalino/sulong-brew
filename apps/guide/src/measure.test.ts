import { describe, expect, it } from 'vitest';
import { EXAMPLE, exampleLine, extractionYield, measureText, roundTo } from './measure';

describe('extractionYield', () => {
  it('matches the brief example: 310 g, 1.41 %, 20 g gives 21.9 %', () => {
    const { beverageG, tdsPercent, doseG } = EXAMPLE;
    expect(roundTo(extractionYield(beverageG, tdsPercent, doseG), 1)).toBe(21.9);
  });

  it('is 0 when TDS is 0', () => {
    expect(extractionYield(310, 0, 20)).toBe(0);
  });
});

describe('roundTo', () => {
  it('rounds half up even when floats are awkward', () => {
    expect(roundTo(21.855, 1)).toBe(21.9);
    expect(roundTo(1.005, 2)).toBe(1.01);
  });
});

describe('exampleLine', () => {
  it('is worked out from the formula, so the text and the math cannot disagree', () => {
    expect(exampleLine()).toBe('310 g × 1.41 % ÷ 20 g = 21.9 %');
  });
});

describe('measure section text', () => {
  const text = measureText();

  it('has no em-dashes', () => {
    expect(text).not.toContain('—');
  });

  it('names no product or brand. Naming the DiFluid R2 waits for Jay to confirm', () => {
    expect(text.toLowerCase()).not.toMatch(
      /difluid|\br2\b|bookoo|timemore|eureka|hario|kaffelogic/,
    );
  });

  it('gives no target ranges or quality promises, because those are not Jay’s data yet', () => {
    expect(text).not.toMatch(/\b(ideal|perfect|best|optimal|sweet spot|target|aim for|should)\b/i);
    // A range of percentages such as "18 to 22 %" or "18-22 %".
    expect(text).not.toMatch(/\d+(\.\d+)?\s*(-|to)\s*\d+(\.\d+)?\s*%/);
  });

  it('explains the three numbers and the formula', () => {
    expect(text).toContain('Dose');
    expect(text).toContain('Beverage weight');
    expect(text).toContain('TDS');
    expect(text).toContain('beverage weight (g) × TDS (%) ÷ dose (g)');
  });
});
