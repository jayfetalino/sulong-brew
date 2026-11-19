import { useState } from 'preact/hooks';
import { formatDuration, isDeleted, summarizeBrew, type Brew, type BrewDraft } from '@sulong/core';
import { BrewForm } from './BrewForm';
import { CompareView } from './CompareView';
import { MAX_COMPARE, toggleSelection, type CompareItem } from './compareFlow';
import { db } from './db';
import { takeBrewDraft } from './draftStore';
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
  // A live brew may have left measurements for a new brew. They are taken once, here.
  const [startDraft] = useState<BrewDraft | null>(takeBrewDraft);
  const [draft, setDraft] = useState<BrewDraft | null>(startDraft);
  // 'new' = logging, a brew = editing it, null = showing the list.
  const [editing, setEditing] = useState<'new' | Brew | null>(startDraft ? 'new' : null);
  // Compare mode: tick up to three brews, then open them side by side.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

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
        draft={editing === 'new' && draft ? draft : undefined}
        onDone={() => {
          setEditing(null);
          setDraft(null);
        }}
      />
    );
  }

  const itemFor = (brew: Brew): CompareItem => {
    const version = versions.find((v) => v.id === brew.recipeVersionId);
    const batch = batches.find((b) => b.id === brew.roastBatchId);
    return {
      brew,
      version,
      recipeName: recipes.find((r) => r.id === version?.recipeId)?.name,
      batch,
      coffee: coffees.find((c) => c.id === batch?.coffeeId),
    };
  };

  // Ticked brews that still exist (one may have been deleted since), in the order ticked.
  const pickedBrews = selected
    .map((id) => brews.find((b) => b.id === id))
    .filter((b): b is Brew => b !== undefined);

  if (comparing && pickedBrews.length >= 2) {
    return (
      <CompareView
        items={pickedBrews.map(itemFor)}
        onBack={() => setComparing(false)}
        onOpen={(id) => {
          const brew = brews.find((b) => b.id === id);
          setComparing(false);
          if (brew) setEditing(brew);
        }}
      />
    );
  }

  const stopSelecting = () => {
    setSelecting(false);
    setSelected([]);
    setLimitMessage(null);
  };

  const onPick = (brew: Brew) => {
    const result = toggleSelection(selected, brew.id);
    setSelected(result.ids);
    setLimitMessage(
      result.refused ? `You can compare up to ${MAX_COMPARE} brews. Untick one first.` : null,
    );
  };

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
        <div class="row">
          {brews.length >= 2 && !selecting && (
            <button type="button" class="button" onClick={() => setSelecting(true)}>
              Compare
            </button>
          )}
          <button type="button" class="button primary" onClick={() => setEditing('new')}>
            New brew
          </button>
        </div>
      </div>

      {selecting && (
        <p class="muted" role="status">
          Tick 2 or {MAX_COMPARE} brews to compare.
        </p>
      )}

      {brews.length === 0 ? (
        <p class="muted">No brews yet. Tap New brew to log your first one.</p>
      ) : (
        <ul class={selecting ? 'cards selecting' : 'cards'}>
          {brews.map((brew) => {
            const d = describe(brew);
            return (
              <li
                key={brew.id}
                class={selecting && selected.includes(brew.id) ? 'card picked' : 'card'}
              >
                <button
                  type="button"
                  class="card-button"
                  role={selecting ? 'checkbox' : undefined}
                  aria-checked={selecting ? selected.includes(brew.id) : undefined}
                  onClick={() => (selecting ? onPick(brew) : setEditing(brew))}
                >
                  {selecting && (
                    <span class="pick-mark" aria-hidden="true">
                      {selected.includes(brew.id) ? '✓' : ''}
                    </span>
                  )}
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
                        {brew.yieldSource === 'demo' && brew.yieldG !== null ? ' (demo)' : ''}
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
                        {(brew.tdsSource === 'demo' || brew.yieldSource === 'demo') &&
                        d.summary.extractionYield !== null
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

      {selecting && (
        <div class="compare-bar">
          {limitMessage && (
            <p class="field-error" role="alert">
              {limitMessage}
            </p>
          )}
          <div class="row">
            <button
              type="button"
              class="button primary"
              disabled={selected.length < 2}
              onClick={() => setComparing(true)}
            >
              Compare ({selected.length} of {MAX_COMPARE})
            </button>
            <button type="button" class="button" onClick={stopSelecting}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
