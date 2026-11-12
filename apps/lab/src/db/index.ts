import { LabDb } from './db';
import { seedIfFirstRun } from './seed';

export { LabDb } from './db';
export { seedIfFirstRun } from './seed';

/** The one database the whole app shares. */
export const db = new LabDb();

export async function initDb(): Promise<void> {
  await seedIfFirstRun(db);
}
