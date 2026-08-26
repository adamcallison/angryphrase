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

## Resolution (2026-08-26)
Root cause was a spec bug: FR-91 (`requirements.md`) and §3.4/§8.4
(`architecture_design.md`) mandated `map(m => String(m.length)).join(',')`
for the chain branch — i.e. whole length per member, ignoring separators. The
code faithfully implemented the (wrong) spec. Docs amended first, then code.

- `requirements.md` FR-91: chain branch now computes each member's
  separator-aware sub-pattern (markers split a member's own runs; a member's
  `nextWord` is not consulted → no recursion) and joins member sub-patterns
  with `", "`.
- `architecture_design.md` §3.4 behaviour block + §8.4 step 1 + the
  `LengthPattern` type example comment updated to match.
- `src/domain/chain/LengthPattern.ts`: single-word cell-iteration extracted to
  a module-private `singleWordPattern(grid, w)` helper (no `nextWord` check);
  `forWord` chain branch maps `Chain.membersOf(...)` through that helper and
  joins with `", "`; `forWord` else branch delegates to the same helper.
- Spacing canonicalised to `", "` (comma + space) everywhere — matches the
  pre-existing standalone-word convention (`5, 4`); zero regression for
  standalone space-separated words. Chain display changes from `5,9,7` (buggy)
  to `5, 9, 2, 5` (correct, separator-aware).
- Tests: `test/domain/chain/LengthPattern.test.ts` — existing chain tests
  updated to expect `", "`; 5 new chain-with-separator cases added (space
  marker in tail, hyphen marker in tail, markers in two members, marked head
  member, banner variant). 16/16 pass.
- Gate: `npm run ci` green (lint + typecheck + test + build).

## Notes
- Non-chain multi-word entries enumerate correctly.
- Cosmetic spacing inconsistency (single-word `5, 4` vs chain `5,9,7`) is
  resolved: both branches now emit `", "`.
