import { describe, it, expect } from 'vitest';
import { parseGridSizeDraft } from '../../../src/ui/builder/gridSizeInput';

describe('parseGridSizeDraft', () => {
  it('parseGridSizeDraft returns the number as typed', () => {
    expect(parseGridSizeDraft(20)).toBe(20);
    expect(parseGridSizeDraft('20')).toBe(20);
  });

  it('parseGridSizeDraft returns null for an empty draft', () => {
    expect(parseGridSizeDraft('')).toBeNull();
    expect(parseGridSizeDraft(null)).toBeNull();
    expect(parseGridSizeDraft(undefined)).toBeNull();
  });

  it('parseGridSizeDraft does not round a fractional value', () => {
    expect(parseGridSizeDraft(12.7)).toBe(12.7);
    expect(parseGridSizeDraft('12.7')).toBe(12.7);
  });

  it('parseGridSizeDraft does not clamp to a range', () => {
    expect(parseGridSizeDraft(99)).toBe(99);
    expect(parseGridSizeDraft('99')).toBe(99);
  });
});
