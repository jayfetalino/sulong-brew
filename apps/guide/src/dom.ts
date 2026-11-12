/** A tiny helper for building elements. Text is always set as text, never as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: {
    class?: string;
    text?: string;
    attrs?: Record<string, string>;
    on?: Partial<Record<'click', () => void>>;
  } = {},
  ...children: (Node | null)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.class) element.className = props.class;
  if (props.text !== undefined) element.textContent = props.text;
  for (const [name, value] of Object.entries(props.attrs ?? {})) element.setAttribute(name, value);
  if (props.on?.click) element.addEventListener('click', props.on.click);
  for (const child of children) if (child) element.append(child);
  return element;
}
