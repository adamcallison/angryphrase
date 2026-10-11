import type { WordKey } from '../../domain/word/WordKey';

export function canonicalWordKeyId(wordKey: WordKey): string {
  return `${wordKey.startRow}_${wordKey.startCol}_${wordKey.direction}`;
}

export function scrollRowIntoView(
  panelEl: HTMLElement | null,
  liRefs: Record<string, HTMLElement>,
  id: string,
): void {
  if (panelEl === null) return;
  const el = liRefs[id];
  if (el === undefined) return;
  panelEl.scrollTop += el.getBoundingClientRect().top - panelEl.getBoundingClientRect().top;
}
