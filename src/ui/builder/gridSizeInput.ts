export function parseGridSizeDraft(draft: number | string | null | undefined): number | null {
  if (draft === '' || draft === null || draft === undefined) {
    return null;
  }
  const n = Number(draft);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}
