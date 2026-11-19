import { useState } from 'preact/hooks';
import { buildComparison, onlyDifferences, type CompareItem } from './compareFlow';

interface Props {
  /** The brews to compare, in the order they were ticked. */
  items: CompareItem[];
  onBack: () => void;
  /** Opens one brew for editing. */
  onOpen: (brewId: string) => void;
}

export function CompareView({ items, onBack, onOpen }: Props) {
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const comparison = buildComparison(items);
  const groups = differencesOnly ? onlyDifferences(comparison.groups) : comparison.groups;
  const columnsStyle = { '--cols': String(comparison.columns.length) };

  return (
    <div class="compare">
      <div class="page-head">
        <h1>Compare brews</h1>
        <button type="button" class="button" onClick={onBack}>
          Back
        </button>
      </div>

      <div class="compare-columns compare-heads" style={columnsStyle}>
        {comparison.columns.map((c) => (
          <div key={c.brewId} class="compare-head">
            <span class="compare-head-title">{c.coffeeName}</span>
            <span class="compare-head-sub">{c.brewDate}</span>
            <button type="button" class="link-button" onClick={() => onOpen(c.brewId)}>
              Open
            </button>
          </div>
        ))}
      </div>

      <label class="check compare-toggle">
        <input
          type="checkbox"
          checked={differencesOnly}
          onChange={(e) => setDifferencesOnly((e.target as HTMLInputElement).checked)}
        />
        Show only differences
      </label>

      {groups.length === 0 && (
        <p class="muted" data-testid="compare-same">
          These brews match on everything shown.
        </p>
      )}

      {groups.map((group) => (
        <section key={group.id} class="compare-group">
          <h2>{group.title}</h2>
          {group.rows.map((row) => (
            <div
              key={row.id}
              class={row.differs ? 'compare-row differs' : 'compare-row'}
              data-testid={`row-${row.id}`}
            >
              <div class="compare-label">
                {row.label}
                {row.differs && <span class="differs-tag">differs</span>}
              </div>
              <div class="compare-columns" style={columnsStyle}>
                {row.cells.map((text, i) => (
                  <div key={comparison.columns[i]?.brewId ?? i} class="compare-cell">
                    {text}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
