import { render } from 'preact';
import '@fontsource/fraunces/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@sulong/design-tokens/tokens.css';
import './styles.css';
import { App } from './App';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
render(<App />, root);
