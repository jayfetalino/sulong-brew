// The shape of the frozen snapshot this page is built from.
// This file is deliberately self-contained: the guide imports nothing from the rest of the repo.

export type StepKind = 'pour' | 'pause' | 'steep' | 'drawdown';

export interface GuideStep {
  kind: StepKind;
  startSeconds: number;
  targetWeightG: number | null;
  tempC: number | null;
  valve: 'open' | 'closed' | null;
  note: string;
}

export interface GuideCoffee {
  name: string;
  roastLevel: 'light' | 'medium' | 'medium-dark';
  roastDate: string | null;
}

export interface GuideSnapshot {
  schemaVersion: 1;
  publishedAt: string;
  recipeName: string;
  versionNumber: number;
  doseG: number;
  waterG: number;
  waterTempC: number | null;
  grindDescription: string;
  finishSecondsMin: number | null;
  finishSecondsMax: number | null;
  steps: GuideStep[];
  coffee: GuideCoffee | null;
  espresso: null;
}

export type TempUnit = 'C' | 'F';
export type WeightUnit = 'g' | 'oz';
