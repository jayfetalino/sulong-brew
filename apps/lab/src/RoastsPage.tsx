import { useState } from 'preact/hooks';
import { summarizeRoastBatch, type RoastBatch } from '@sulong/core';
import { db } from './db';
import { formatGrams, formatPercent, ROAST_LEVEL_LABELS, todayLocal } from './format';
import { RoastBatchForm } from './RoastBatchForm';
import { useLive } from './useLive';

export function RoastsPage() {
  const coffees = useLive(() => db.coffees.orderBy('name').toArray());
  const batches = useLive(() => db.roastBatches.orderBy('roastDate').reverse().toArray());
  // 'new' = creating, a batch = editing it, null = showing the list.
  const [editing, setEditing] = useState<'new' | RoastBatch | null>(null);

  if (!coffees || !batches) return <p class="muted">Loading</p>;

  if (editing) {
    return (
      <RoastBatchForm
        coffees={coffees}
        batch={editing === 'new' ? undefined : editing}
        onDone={() => setEditing(null)}
      />
    );
  }

  const today = todayLocal();
  const coffeeName = (id: string) => coffees.find((c) => c.id === id)?.name ?? 'Unknown coffee';

  return (
    <>
      <div class="page-head">
        <h1>Roasts</h1>
        <button type="button" class="button primary" onClick={() => setEditing('new')}>
          New batch
        </button>
      </div>

      {batches.length === 0 ? (
        <p class="muted">No roast batches yet. Tap New batch to add your first one.</p>
      ) : (
        <ul class="cards">
          {batches.map((batch) => {
            const summary = summarizeRoastBatch(batch, today);
            return (
              <li key={batch.id} class="card">
                <button type="button" class="card-button" onClick={() => setEditing(batch)}>
                  <span class="card-title">{coffeeName(batch.coffeeId)}</span>
                  <span class="card-sub">
                    {batch.roastDate} · {ROAST_LEVEL_LABELS[batch.roastLevel]}
                    {batch.profileName ? ` · ${batch.profileName}` : ''}
                  </span>
                  <span class="stats">
                    <span>
                      <span class="stat-label">Days off roast</span>
                      <span class="stat-value">{summary.daysOffRoast}</span>
                    </span>
                    <span>
                      <span class="stat-label">Weight loss</span>
                      <span class="stat-value">{formatPercent(summary.weightLossPercent)}</span>
                    </span>
                    <span>
                      <span class="stat-label">Green</span>
                      <span class="stat-value">{formatGrams(batch.greenWeightG)}</span>
                    </span>
                    <span>
                      <span class="stat-label">Roasted</span>
                      <span class="stat-value">{formatGrams(batch.roastedWeightG)}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
