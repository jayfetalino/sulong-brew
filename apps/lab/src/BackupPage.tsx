import { useState } from 'preact/hooks';
import {
  BACKUP_TABLES,
  parseBackup,
  type BackupFile,
  type BackupMerge,
  type BackupTableName,
} from '@sulong/core';
import { db } from './db';
import { applyImport, exportBackup, previewImport } from './db/backup';
import { todayLocal } from './format';
import { useLive } from './useLive';

const TABLE_LABELS: Record<BackupTableName, string> = {
  coffees: 'Coffees',
  roastBatches: 'Roast batches',
  recipes: 'Recipes',
  recipeVersions: 'Recipe versions',
  brews: 'Brews',
};

type ImportState =
  | { step: 'idle' }
  | { step: 'preview'; backup: BackupFile; merge: BackupMerge; fileName: string }
  | { step: 'done'; merge: BackupMerge }
  | { step: 'error'; message: string };

function describeChange(merge: BackupMerge, table: BackupTableName): string | null {
  const s = merge.summary[table];
  const parts = [
    s.added > 0 ? `${s.added} new` : null,
    s.updated > 0 ? `${s.updated} newer` : null,
    s.kept > 0 ? `${s.kept} unchanged` : null,
  ].filter(Boolean);
  return parts.length === 0 ? null : `${TABLE_LABELS[table]}: ${parts.join(', ')}`;
}

function backupFileName(): string {
  return `sulong-lab-backup-${todayLocal()}.json`;
}

export function BackupPage() {
  const counts = useLive(async () => ({
    roastBatches: (await db.roastBatches.toArray()).filter((r) => !r.deletedAt).length,
    recipes: (await db.recipes.toArray()).filter((r) => !r.deletedAt).length,
    brews: (await db.brews.toArray()).filter((r) => !r.deletedAt).length,
  }));
  const [state, setState] = useState<ImportState>({ step: 'idle' });
  const [exportMessage, setExportMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const makeFile = async (): Promise<File> => {
    const backup = await exportBackup(db);
    return new File([JSON.stringify(backup, null, 2)], backupFileName(), {
      type: 'application/json',
    });
  };

  const onDownload = async () => {
    const file = await makeFile();
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setExportMessage(`Saved ${file.name}. Check your Downloads folder.`);
  };

  const onShare = async () => {
    const file = await makeFile();
    try {
      await navigator.share({ files: [file], title: 'Sulong Brew Lab backup' });
      setExportMessage('Shared.');
    } catch {
      setExportMessage('Sharing was cancelled.');
    }
  };

  const canShare = (() => {
    try {
      const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
      return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
    } catch {
      return false;
    }
  })();

  const onFileChosen = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // Lets you pick the same file again later.
    if (!file) return;
    setBusy(true);
    try {
      const parsed = parseBackup(await file.text());
      if (!parsed.ok) {
        setState({ step: 'error', message: parsed.error });
        return;
      }
      const merge = await previewImport(db, parsed.backup.tables);
      setState({ step: 'preview', backup: parsed.backup, merge, fileName: file.name });
    } catch {
      setState({ step: 'error', message: 'Could not read that file.' });
    } finally {
      setBusy(false);
    }
  };

  const onConfirmImport = async () => {
    if (state.step !== 'preview') return;
    setBusy(true);
    try {
      const merge = await applyImport(db, state.backup.tables);
      setState({ step: 'done', merge });
    } catch {
      setState({ step: 'error', message: 'The import failed and nothing was changed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Backup</h1>
      <p class="muted">
        Your data lives only in this browser. Safari, the home-screen app and Bluefy each keep their
        own copy. Export from one and import into another to bring them together.
      </p>
      {counts && (
        <p class="data-line">
          On this device: {counts.roastBatches} roast batches, {counts.recipes} recipes,{' '}
          {counts.brews} brews
        </p>
      )}

      <h2>Export</h2>
      <p class="muted">Saves everything as one JSON file.</p>
      <div class="stack">
        <button type="button" class="button primary" onClick={onDownload}>
          Download backup file
        </button>
        {canShare && (
          <button type="button" class="button" onClick={onShare}>
            Share backup file
          </button>
        )}
      </div>
      {exportMessage && <p class="data-line">{exportMessage}</p>}

      <h2>Import</h2>
      <p class="muted">
        Choose a backup file. You will see what would change before anything is saved. Newer records
        win. Nothing on this device is ever replaced by an older copy.
      </p>
      <label class="file-pick">
        <span class="button">Choose backup file</span>
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={onFileChosen}
          aria-label="Choose backup file"
        />
      </label>

      {state.step === 'error' && (
        <div class="danger-zone" role="alert">
          <p>{state.message}</p>
          <button type="button" class="button" onClick={() => setState({ step: 'idle' })}>
            OK
          </button>
        </div>
      )}

      {state.step === 'preview' && (
        <div class="preview">
          <h2>Ready to import</h2>
          <p class="muted">
            {state.fileName}
            {state.backup.exportedAt
              ? `, made ${new Date(state.backup.exportedAt).toLocaleString()}`
              : ''}
          </p>
          {state.merge.totals.added + state.merge.totals.updated === 0 ? (
            <p class="data-line">
              Nothing to import. This device already has everything in this file.
            </p>
          ) : (
            <ul class="preview-list">
              {BACKUP_TABLES.map((table) => {
                const line = describeChange(state.merge, table);
                return line ? <li key={table}>{line}</li> : null;
              })}
            </ul>
          )}
          <div class="row">
            {state.merge.totals.added + state.merge.totals.updated > 0 && (
              <button
                type="button"
                class="button primary"
                disabled={busy}
                onClick={onConfirmImport}
              >
                Import {state.merge.totals.added + state.merge.totals.updated} changes
              </button>
            )}
            <button type="button" class="button" onClick={() => setState({ step: 'idle' })}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.step === 'done' && (
        <div class="preview" role="status">
          <h2>Import finished</h2>
          <p class="data-line">
            {state.merge.totals.added} new, {state.merge.totals.updated} updated,{' '}
            {state.merge.totals.kept} unchanged.
          </p>
          <button type="button" class="button" onClick={() => setState({ step: 'idle' })}>
            OK
          </button>
        </div>
      )}
    </>
  );
}
