# Bug: chain-head enumeration ignores separators in non-head members

## Summary
`LengthPattern.forWord` computes the enumeration for a chain head by joining each
chain member's whole-word `length`, ignoring any space/hyphen separators within
non-head members. As a result a chain head whose later members contain internal
separators shows the wrong enumeration.

## Repro
Any across chain of three members where the tail has an internal separator:
- head, length 5
- middle, length 9
- tail, length 7, with `spaceRight` after its 2nd cell splitting it into 2+5

Expected head enumeration: `5,9,2,5`
Actual head enumeration: `5,9,7`

The tail alone enumerates correctly as `2,5`, so the separator is stored and
read; the head just does not consult it.

## Root cause
`src/domain/chain/LengthPattern.ts`, `forWord`:

```ts
forWord(grid, words, w): LengthPattern {
  if (w.nextWord !== null) {
    return Chain.membersOf(words, w.key)
      .map((m) => String(m.length))   // <-- uses whole length, ignores separators
      .join(',');
  }
  // ... separator-aware single-word branch ...
}
```

The chain branch maps each member to `m.length` instead of computing the
separator-aware sub-pattern for that member. The separator-aware logic exists
only in the single-word branch below, which chain members skip.

## Suggested fix
For each chain member, compute the separator-aware pattern using the same logic
as the single-word branch (iterate the member's cells, split on
`spaceRight`/`spaceBottom`/`hyphenRight`/`hyphenBottom`), then join member
patterns with `,`. Ensure no infinite recursion: chain members must use the
single-word branch, not re-enter the chain branch.

## Workaround
Add the enumeration literally to the chain head's clue text.

## Notes
- Non-chain multi-word entries enumerate correctly.
- Cosmetic: single-word branch emits `5, 4` (space after comma) due to
  `pieces.push(String(run), ', ')`; chain branch emits `5,9,7` (no space). A
  fix should also normalise spacing.
