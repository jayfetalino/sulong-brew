import { useState } from 'preact/hooks';
import {
  formatDuration,
  isDeleted,
  ratioLabel,
  type Recipe,
  type RecipeVersion,
} from '@sulong/core';
import { db } from './db';
import { deleteRecipe } from './db/recipes';
import { describeStep } from './format';
import { RecipeEditor } from './RecipeEditor';
import { useLive } from './useLive';

type View =
  | { mode: 'list' }
  | { mode: 'detail'; recipeId: string }
  | { mode: 'edit'; recipeId: string | null };

function summaryLine(v: RecipeVersion): string {
  const temp = v.waterTempC === null ? 'temp not set' : `${v.waterTempC} C`;
  return `${v.doseG} g : ${v.waterG} g · ${ratioLabel(v.doseG, v.waterG)} · ${temp}`;
}

export function RecipesPage() {
  const recipes = useLive(() =>
    db.recipes
      .orderBy('name')
      .filter((r) => !isDeleted(r))
      .toArray(),
  );
  const versions = useLive(() => db.recipeVersions.toArray());
  const [view, setView] = useState<View>({ mode: 'list' });
  // Which version the detail view is showing. Empty means "the current one".
  const [shownVersionId, setShownVersionId] = useState('');
  const [baseVersionId, setBaseVersionId] = useState('');

  if (!recipes || !versions) return <p class="muted">Loading</p>;

  const recipeById = (id: string | null) => recipes.find((r) => r.id === id);
  const versionsOf = (recipeId: string) =>
    versions
      .filter((v) => v.recipeId === recipeId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  const goDetail = (recipeId: string) => {
    setShownVersionId('');
    setView({ mode: 'detail', recipeId });
  };

  // ---- Editor ----
  if (view.mode === 'edit') {
    const recipe = recipeById(view.recipeId);
    const base = recipe
      ? versions.find((v) => v.id === (baseVersionId || recipe.currentVersionId))
      : undefined;
    return (
      <RecipeEditor
        recipe={recipe}
        baseVersion={base}
        onDone={(id) => (id ? goDetail(id) : setView({ mode: 'list' }))}
      />
    );
  }

  // ---- Detail ----
  // If the recipe has just been deleted, this falls through to the list below.
  const detailRecipe = view.mode === 'detail' ? recipeById(view.recipeId) : undefined;
  if (detailRecipe) {
    return (
      <RecipeDetail
        recipe={detailRecipe}
        versions={versionsOf(detailRecipe.id)}
        shownVersionId={shownVersionId}
        onShowVersion={setShownVersionId}
        onBack={() => setView({ mode: 'list' })}
        onEdit={(fromVersionId) => {
          setBaseVersionId(fromVersionId);
          setView({ mode: 'edit', recipeId: detailRecipe.id });
        }}
        onDeleted={() => setView({ mode: 'list' })}
      />
    );
  }

  // ---- List ----
  return (
    <>
      <div class="page-head">
        <h1>Recipes</h1>
        <button
          type="button"
          class="button primary"
          onClick={() => {
            setBaseVersionId('');
            setView({ mode: 'edit', recipeId: null });
          }}
        >
          New recipe
        </button>
      </div>

      {recipes.length === 0 ? (
        <p class="muted">No recipes yet. Tap New recipe to add one.</p>
      ) : (
        <ul class="cards">
          {recipes.map((recipe) => {
            const current = versions.find((v) => v.id === recipe.currentVersionId);
            return (
              <li key={recipe.id} class="card">
                <button type="button" class="card-button" onClick={() => goDetail(recipe.id)}>
                  <span class="card-title">{recipe.name}</span>
                  {current ? (
                    <span class="card-sub">
                      v{current.versionNumber} · {summaryLine(current)}
                    </span>
                  ) : (
                    <span class="card-sub">No version yet</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

interface DetailProps {
  recipe: Recipe;
  versions: RecipeVersion[];
  shownVersionId: string;
  onShowVersion: (id: string) => void;
  onBack: () => void;
  onEdit: (fromVersionId: string) => void;
  onDeleted: () => void;
}

function RecipeDetail({
  recipe,
  versions,
  shownVersionId,
  onShowVersion,
  onBack,
  onEdit,
  onDeleted,
}: DetailProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const shown =
    versions.find((v) => v.id === (shownVersionId || recipe.currentVersionId)) ?? versions[0];

  const onDelete = async () => {
    await deleteRecipe(db, recipe);
    onDeleted();
  };

  return (
    <>
      <div class="page-head">
        <button type="button" class="button" onClick={onBack}>
          Back
        </button>
      </div>
      <h1>{recipe.name}</h1>

      {!shown ? (
        <p class="muted">This recipe has no versions.</p>
      ) : (
        <>
          <div class="chips" role="group" aria-label="Versions">
            {versions.map((v) => (
              <button
                key={v.id}
                type="button"
                class={v.id === shown.id ? 'chip active' : 'chip'}
                onClick={() => onShowVersion(v.id)}
              >
                v{v.versionNumber}
                {v.id === recipe.currentVersionId ? ' (current)' : ''}
              </button>
            ))}
          </div>

          <div class="stats detail-stats">
            <span>
              <span class="stat-label">Dose</span>
              <span class="stat-value">{shown.doseG} g</span>
            </span>
            <span>
              <span class="stat-label">Water</span>
              <span class="stat-value">{shown.waterG} g</span>
            </span>
            <span>
              <span class="stat-label">Ratio</span>
              <span class="stat-value">{ratioLabel(shown.doseG, shown.waterG)}</span>
            </span>
            <span>
              <span class="stat-label">Water temp</span>
              <span class="stat-value">
                {shown.waterTempC === null ? 'Not set' : `${shown.waterTempC} C`}
              </span>
            </span>
            <span>
              <span class="stat-label">Grind (clicks)</span>
              <span class="stat-value">{shown.grindClicks ?? 'Not set'}</span>
            </span>
            <span>
              <span class="stat-label">Grind (words)</span>
              <span class="stat-value">{shown.grindDescription || 'Not set'}</span>
            </span>
            <span>
              <span class="stat-label">Finish</span>
              <span class="stat-value">
                {shown.finishSecondsMin === null && shown.finishSecondsMax === null
                  ? 'Not set'
                  : `${shown.finishSecondsMin === null ? '?' : formatDuration(shown.finishSecondsMin)} to ${shown.finishSecondsMax === null ? '?' : formatDuration(shown.finishSecondsMax)}`}
              </span>
            </span>
          </div>

          {shown.notes && <p class="muted">{shown.notes}</p>}

          <h2>Steps</h2>
          <ol class="step-list">
            {shown.steps.map((s, i) => (
              <li key={i} class="step-view">
                <span class="step-time">{formatDuration(s.startSeconds)}</span>
                <span>
                  <span class="step-title">{describeStep(s)}</span>
                  {s.tempC !== null && <span class="step-meta"> · {s.tempC} C</span>}
                  {s.valve !== null && (
                    <span class="step-meta"> · valve {s.valve === 'open' ? 'open' : 'closed'}</span>
                  )}
                  {s.note && <span class="step-note">{s.note}</span>}
                </span>
              </li>
            ))}
          </ol>

          <div class="stack">
            <button type="button" class="button primary" onClick={() => onEdit(shown.id)}>
              Edit as new version
            </button>

            {confirmingDelete ? (
              <div class="danger-zone">
                <p>
                  Delete this recipe? It disappears from the list on all your devices. Past brews
                  keep their copy of the recipe version.
                </p>
                <div class="row">
                  <button type="button" class="button danger" onClick={onDelete}>
                    Yes, delete
                  </button>
                  <button type="button" class="button" onClick={() => setConfirmingDelete(false)}>
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                class="button danger-outline"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete recipe
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
