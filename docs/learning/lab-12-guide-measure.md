# LAB-12: "Measure your brew" on the public guide

## What was built

- A new section at the bottom of the Filter tab on every recipe: **Measure your brew**.
- It explains the three numbers (dose, beverage weight, TDS), shows the extraction yield formula, and works one example: 310 g × 1.41 % ÷ 20 g = 21.9 %.
- It says "a refractometer" and names no brand. No Bluetooth, no account, no lab data.

## Key ideas

- **The example is calculated, not typed.** The page works out 21.9 % from the formula each time. A test checks it, so the words and the math can never disagree.
- **Content lives in one file** (`apps/guide/src/measure.ts`), separate from the drawing code, so tests can read every sentence a visitor sees.
- **Tests guard decisions that are not made yet.** One test fails if the section names a brand (the DiFluid R2 waits for your OK) or gives target ranges (those are your data to choose, not mine). When you decide, you change the test and the words together.
- **The guide stays independent.** It has its own copy of the formula and imports nothing from the lab.
- **Grams only.** The example stays in grams even when a visitor picks ounces, because converting would introduce rounding that changes the answer.

## Remember

A public page makes promises for you. Keep it to facts you can check (a formula, a worked example) and leave out claims about what is "ideal".
