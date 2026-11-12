import { render } from 'preact';
import '@fontsource/fraunces/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@sulong/design-tokens/tokens.css';
import './styles.css';
import { App } from './App';
import { initDb } from './db';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

// Load the starter coffees and recipes before the first screen appears.
initDb().then(() => render(<App />, root));
