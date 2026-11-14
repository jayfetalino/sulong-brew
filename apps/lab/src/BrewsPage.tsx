import { useState } from 'preact/hooks';
import { formatDuration, isDeleted, summarizeBrew, type Brew } from '@sulong/core';
import { BrewForm } from './BrewForm';
import { db } from './db';
import { formatGrams, formatPercent } from './format';
import { useLive } from './useLive';

export function BrewsPage() {
  const brews = useLive(async () =>
    (await db.brews.toArray())
      .filter((b) => !isDeleted(b))
      .sort(
        (a, b) => b.brewDate.localeCompare(a.brewDate) || b.createdAt.localeCompare(a.createdAt),
      ),
  );
  const recipes = useLive(() => db.recipes.toArray());
  const versions = useLive(() => db.recipeVersions.toArray());
  const batches = useLive(() => db.roastBatches.orderBy('roastDate').reverse().toArray());
  const coffees = useLive(() => db.coffees.toArray());
  // 'new' = logging, a brew = editing it, null = showing the list.
  const [editing, setEditing] = useState<'new' | Brew | null>(null);

  if (!brews || !recipes || !versions || !batches || !coffees) {
    return <p class="muted">Loading</p>;
  }

  const liveRecipes = recipes.filter((r) => !isDeleted(r));
  const liveBatches = batches.filter((b) => !isDeleted(b));

  if (editing) {
    const knownTags = [...new Set(brews.flatMap((b) => b.tags))].sort();
    return (
      <BrewForm
        recipes={liveRecipes}
        versions={versions}
        batches={editing === 'new' ? liveBatches : batches}
        coffees={coffees}
        knownTags={knownTags}
        brew={editing === 'new' ? undefined : editing}
        lastBrew={editing === 'new' ? brews[0] : undefined}
        onDone={() => setEditing(null)}
      />
    );
  }

  const describe = (brew: Brew) => {
    const version = versions.find((v) => v.id === brew.recipeVersionId);
    const recipe = recipes.find((r) => r.id === version?.recipeId);
    const batch = batches.find((b) => b.id === brew.roastBatchId);
    const coffee = coffees.find((c) => c.id === batch?.coffeeId);
    return {
      coffeeName: coffee?.name ?? 'Unknown coffee',
      recipeLabel: version
        ? `${recipe?.name ?? 'Deleted recipe'} v${version.versionNumber}`
        : 'Unknown recipe',
      summary: summarizeBrew(brew, batch?.roastDate ?? null),
    };
  };

  return (
    <>
      <div class="page-head">
        <h1>Brews</h1>
        <button type="button" class="button primary" onClick={() => setEditing('new')}>
          New brew
        </button>
      </div>

      {brews.length === 0 ? (
        <p class="muted">No brews yet. Tap New brew to log your first one.</p>
      ) : (
        <ul class="cards">
          {brews.map((brew) => {
            const d = describe(brew);
            return (
              <li key={brew.id} class="card">
                <button type="button" class="card-button" onClick={() => setEditing(brew)}>
                  <span class="card-title">{d.coffeeName}</span>
                  <span class="card-sub">
                    {brew.brewDate} · {d.recipeLabel}
                    {d.summary.daysOffRoast !== null
                      ? ` · day ${d.summary.daysOffRoast} off roast`
                      : ''}
                  </span>
                  <span class="stats">
                    <span>
                      <span class="stat-label">Dose / yield</span>
                      <span class="stat-value">
                        {formatGrams(brew.doseG)} / {formatGrams(brew.yieldG)}
                      </span>
                    </span>
                    <span>
                      <span class="stat-label">Time</span>
                      <span class="stat-value">
                        {brew.brewSeconds === null ? 'Not set' : formatDuration(brew.brewSeconds)}
                      </span>
                    </span>
                    <span>
                      <span class="stat-label">TDS</span>
                      <span class="stat-value">
                        {brew.tdsPercent === null ? 'Not set' : `${brew.tdsPercent} %`}
                        {brew.tdsSource === 'demo' && brew.tdsPercent !== null ? ' (demo)' : ''}
                      </span>
                    </span>
                    <span>
                      <span class="stat-label">Extraction yield</span>
                      <span class="stat-value">
                        {formatPercent(d.summary.extractionYield)}
                        {brew.tdsSource === 'demo' && d.summary.extractionYield !== null
                          ? ' (demo)'
                          : ''}
                      </span>
                    </span>
                    <span>
                      <span class="stat-label">Rating</span>
                      <span class="stat-value">
                        {brew.rating === null ? 'Not rated' : `${brew.rating} / 5`}
                      </span>
                    </span>
                  </span>
                  {brew.tags.length > 0 && <span class="tag-line">{brew.tags.join(' · ')}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
