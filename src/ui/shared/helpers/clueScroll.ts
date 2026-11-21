export function scrollRowIntoView(
  panelEl: HTMLElement | null,
  liRefs: Record<string, HTMLElement>,
  id: string,
): void {
  if (panelEl === null) return;
  const el = liRefs[id];
  if (el === undefined) return;
  const panelTop = panelEl.getBoundingClientRect().top;
  const row = el.getBoundingClientRect();
  if (row.top < panelTop) {
    panelEl.scrollTop += row.top - panelTop;
  } else {
    const panelBottom = panelTop + panelEl.clientHeight;
    if (row.bottom > panelBottom) panelEl.scrollTop += row.bottom - panelBottom;
  }
}
