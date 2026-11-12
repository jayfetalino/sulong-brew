import logoUrl from '@sulong/design-tokens/logo.svg';

/** Shows the Sulong logo exactly as supplied. Never edit or redraw the SVG file. */
export function Logo() {
  return <img class="logo" src={logoUrl} alt="Sulong Coffee" />;
}
