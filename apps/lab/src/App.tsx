import { useEffect, useState } from 'preact/hooks';
import { BackupPage } from './BackupPage';
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
/** The three tabs, plus the Backup screen that opens from the header. */
type Route = TabId | 'backup';

function routeFromHash(): Route {
  const id = window.location.hash.replace('#/', '');
  if (id === 'backup') return 'backup';
  return TABS.find((t) => t.id === id)?.id ?? 'roasts';
}

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div class="shell">
      <header class="topbar">
        <Logo />
        <span class="topbar-title">Sulong Brew Lab</span>
        <a
          href="#/backup"
          class={route === 'backup' ? 'topbar-link active' : 'topbar-link'}
          aria-current={route === 'backup' ? 'page' : undefined}
        >
          Backup
        </a>
      </header>
      <main class="content">
        {route === 'roasts' ? (
          <RoastsPage />
        ) : route === 'recipes' ? (
          <RecipesPage />
        ) : route === 'brews' ? (
          <BrewsPage />
        ) : (
          <BackupPage />
        )}
      </main>
      <nav class="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={`#/${t.id}`}
            class={t.id === route ? 'tab active' : 'tab'}
            aria-current={t.id === route ? 'page' : undefined}
          >
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
