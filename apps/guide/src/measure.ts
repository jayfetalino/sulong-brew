// Content and math for the "Measure your brew" section.
// Self-contained on purpose: the guide imports nothing from the rest of the repo.

/** Extraction yield in percent: beverage weight x TDS / dose. All weights in grams. */
export function extractionYield(beverageG: number, tdsPercent: number, doseG: number): number {
  return (beverageG * tdsPercent) / doseG;
}

/** Rounds half up even when floats are awkward (21.855 becomes 21.9, not 21.8). */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** The worked example from the project brief. */
export const EXAMPLE = { beverageG: 310, tdsPercent: 1.41, doseG: 20 } as const;

/** "310 g x 1.41 % / 20 g = 21.9 %", worked out from the numbers above. */
export function exampleLine(): string {
  const { beverageG, tdsPercent, doseG } = EXAMPLE;
  const result = roundTo(extractionYield(beverageG, tdsPercent, doseG), 1);
  return `${beverageG} g × ${tdsPercent} % ÷ ${doseG} g = ${result.toFixed(1)} %`;
}

/**
 * The words on the page. Kept here, not inside the drawing code, so tests can check them.
 * It says "a refractometer" and names no brand: naming one waits for Jay's decision.
 */
export const MEASURE = {
  heading: 'Measure your brew',
  intro:
    'Taste tells you how it was. Numbers help you repeat it. Three measurements show how much of the coffee ended up in your cup.',
  items: [
    { term: 'Dose', detail: 'the weight of ground coffee you brewed with, in grams.' },
    { term: 'Beverage weight', detail: 'the weight of the finished drink in the cup, in grams.' },
    {
      term: 'TDS',
      detail:
        'total dissolved solids: the share of the drink that is dissolved coffee, as a percent. A refractometer measures it from a small sample of the brew.',
    },
  ],
  formulaLabel: 'Extraction yield (EY)',
  formula: 'beverage weight (g) × TDS (%) ÷ dose (g)',
  exampleLabel: 'Example',
  note: 'Use grams for both weights. The result is a percent of the dose.',
} as const;

/** Every sentence a visitor reads in this section, joined, for tests. */
export function measureText(): string {
  return [
    MEASURE.heading,
    MEASURE.intro,
    ...MEASURE.items.map((i) => `${i.term} ${i.detail}`),
    MEASURE.formulaLabel,
    MEASURE.formula,
    MEASURE.exampleLabel,
    exampleLine(),
    MEASURE.note,
  ].join(' ');
}
