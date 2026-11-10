import { useEffect, useState } from 'preact/hooks';
import { BrewsPage } from './BrewsPage';
import { Logo } from './Logo';
import { RecipesPage } from './RecipesPage';
import { RoastsPage } from './RoastsPage';

const TABS = [
  { id: 'roasts', label: 'Roasts' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'brews', label: 'Brews' },
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

  return (
    <div class="shell">
      <header class="topbar">
        <Logo />
        <span class="topbar-title">Sulong Brew Lab</span>
      </header>
      <main class="content">
        {tab === 'roasts' ? <RoastsPage /> : tab === 'recipes' ? <RecipesPage /> : <BrewsPage />}
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
