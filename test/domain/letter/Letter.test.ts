import { Letter } from '../../../src/domain/letter/Letter';
import type { Letter as LetterType } from '../../../src/domain/letter/Letter';

describe('Letter', () => {
  it('Letter.try accepts uppercase A–Z and returns the same char', () => {
    expect(Letter.try('A')).toBe('A');
    expect(Letter.try('B')).toBe('B');
    expect(Letter.try('Z')).toBe('Z');
  });

  it('Letter.try accepts lowercase a–z and returns the uppercase form', () => {
    expect(Letter.try('a')).toBe('A');
    expect(Letter.try('m')).toBe('M');
    expect(Letter.try('z')).toBe('Z');
  });

  it('Letter.try rejects non-letter characters (returns null)', () => {
    expect(Letter.try('1')).toBeNull();
    expect(Letter.try('!')).toBeNull();
    expect(Letter.try(' ')).toBeNull();
    expect(Letter.try('😀')).toBeNull();
  });

  it('Letter.try rejects empty string and multi-character strings (returns null)', () => {
    expect(Letter.try('')).toBeNull();
    expect(Letter.try('AB')).toBeNull();
    expect(Letter.try('abc')).toBeNull();
  });

  it('Letter.from filters non-letters, uppercases valid letters, preserves order', () => {
    expect(Letter.from('Héllo!')).toEqual(['H', 'L', 'L', 'O']);
    expect(Letter.from('aBc123')).toEqual(['A', 'B', 'C']);
  });

  it('Letter.from returns empty array for a string with no valid letters', () => {
    expect(Letter.from('123!@# 😀')).toEqual([]);
    expect(Letter.from('')).toEqual([]);
  });

  it('Letter.from skips surrogate pairs (emoji)', () => {
    expect(Letter.from('A😀B')).toEqual(['A', 'B']);
    expect(Letter.from('🎉Party🎊')).toEqual(['P', 'A', 'R', 'T', 'Y']);
  });

  it('Letter.equals returns true for the same letter, false for different letters', () => {
    const a = Letter.try('a') as LetterType;
    const b = Letter.try('b') as LetterType;
    const a2 = Letter.try('A') as LetterType;

    expect(Letter.equals(a, a2)).toBe(true);
    expect(Letter.equals(a, b)).toBe(false);
  });

  it('Letter brand is not a plain string at the type level', () => {
    function _check(l: LetterType): LetterType {
      return l;
    }

    const x: string = 'A';
    // @ts-expect-error Letter is not assignable from plain string
    _check(x);
  });
});
