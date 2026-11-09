import { useEffect, useState } from 'preact/hooks';
import { Logo } from './Logo';

const TABS = [
  { id: 'roasts', label: 'Roasts', note: 'Roast batches will live here (LAB-4).' },
  { id: 'recipes', label: 'Recipes', note: 'Versioned recipes will live here (LAB-5).' },
  { id: 'brews', label: 'Brews', note: 'The brew log will live here (LAB-6).' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function tabFromHash(): TabId {
  const id = window.location.hash.replace('#/', '');
  return TABS.find((t) => t.id === id)?.id ?? 'roasts';
}

export function App() {
  const [tab, setTab] = useState<TabId>(tabFromHash);

  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const current = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div class="shell">
      <header class="topbar">
        <Logo />
        <span class="topbar-title">Sulong Brew Lab</span>
      </header>
      <main class="content">
        <h1>{current.label}</h1>
        <p class="muted">{current.note}</p>
      </main>
      <nav class="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={`#/${t.id}`}
            class={t.id === tab ? 'tab active' : 'tab'}
            aria-current={t.id === tab ? 'page' : undefined}
          >
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
