import type { DisplayClueFact } from '../../../domain/chain/DisplayClue';
import type { LengthPattern } from '../../../domain/chain/LengthPattern';
import type { CellSeparator } from '../../../domain/grid/CellSeparator';

export function renderDisplayClue(fact: DisplayClueFact): string {
  if (fact.kind === 'head') {
    return fact.clue;
  }
  const directionName = fact.headDirection.charAt(0).toUpperCase() + fact.headDirection.slice(1);
  return `See ${fact.headNumber} ${directionName}`;
}

export function renderLengthPatternLabel(pattern: LengthPattern): string {
  return `(${pattern.map(renderToken).join('')})`;
}

function renderToken(token: number | CellSeparator): string {
  if (typeof token === 'number') {
    return String(token);
  }
  switch (token) {
    case 'space':
      return ', ';
    case 'hyphen':
      return '-';
    case 'none':
      // A LengthPattern fact never contains 'none' (boundaries pre-merge into longer runs); handled so this switch is exhaustive.
      return '';
  }
}
