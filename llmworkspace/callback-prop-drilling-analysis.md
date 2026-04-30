# Callback Prop Drilling Analysis

## Current Pattern

BuilderPage (737 lines, 20+ handlers) orchestrates all logic. Every action funnels through the page component, which holds all state, all derived state, and all side effects. Child components receive behavior exclusively through callback props:

```
BuilderPage (all state + all logic)
  → CrosswordGrid → Cell          onCellClick, onKeyDown
  → CluePanel → ClueEntry         onClueClick, onClueChange, onJoinClick, onUnjoinClick, joinMode, joinSourceWordId
  → MarkerToolbar                  onToggleMarker
  → DisplacedCluesPanel           onReattachClick, onDelete
  → BuilderActions                onSave, onExportComplete, onImport, onReset
  → ModeToggle                     onModeChange
  → PuzzleMetadataForm            onTitleChange, onAuthorChange
  → GridSizeSelector              onSizeChange
```

Maximum drill depth: 2 levels (Page → CluePanel → ClueEntry).

## What's Working

These callback patterns are correct and should stay:

- **Cell click → CrosswordGrid → Page.** Behavior depends on global `interaction` state (design toggles black/white, fill selects for typing, join/reattach have yet more behaviors). No child can own this logic without being aware of the interaction state machine.

- **ModeToggle, BuilderActions, GridSizeSelector, PuzzleMetadataForm.** These are thin UI triggers. They report user intent; the page decides what to do (including confirmation dialogs). This is proper inversion of control.

- **MarkerToolbar, DisplacedCluesPanel.** Pure presentation with callbacks. The page owns the grid mutation logic, which is correct since it touches shared state.

## What's Not Working

### Problem 1: God Component

BuilderPage holds all state, all derived state, and all handlers. It's 737 lines doing everything. The same pattern repeats in PlayerPage (354 lines). Both pages duplicate cursor/keyboard logic nearly identically (only `puzzleLetter` vs `playerLetter` differs).

### Problem 2: Builder-Leaking Interface on PlayerPage

PlayerPage passes 4 no-op callbacks to CluePanel:

```svelte
<CluePanel
  onClueChange={() => {}}
  onJoinClick={() => {}}
  onUnjoinClick={() => {}}
  joinMode={false}
  joinSourceWordId={null}
/>
```

This means the CluePanel interface is shaped by the Builder's needs and forced onto the Player.

### Problem 3: Implicit State Machine

`BuilderInteraction` has 4 states (`design`, `fill`, `join`, `reattach`) with transitions scattered across 6+ handlers. No single place defines legal transitions or guards.

## Recommendations

### 1. Extract domain logic into stores and modules, not into child components

The handlers stay on the Page as thin one-liners delegating to named, testable functions:

```ts
// Before (BuilderPage) — 15 lines inline
function handleToggleMarker(marker) {
  if (!selectedCell || interaction.kind === "design") return;
  // ... grid mutation ...
}

// After (BuilderPage) — 1 line
function handleToggleMarker(marker) {
  builderStore.toggleMarker(marker);
}
```

Component interfaces (callback props) stay the same. The logic moves sideways into modules.

### 2. Extract shared cursor logic to a shared module

Near-identical `enterLetterInGrid`, `deleteInGrid`, `arrowInGrid` exist in both BuilderPage and PlayerPage. Extract to a shared module parameterized by `letterSource` (`"puzzle" | "player"`).

### 3. Make CluePanel's builder-specific props optional

When `editable={false}`, join/unjoin callbacks are meaningless. Make them optional with no-op defaults instead of requiring PlayerPage to pass `() => {}`:

```ts
// CluePanel props
onClueChange?: (wordId: WordId, newText: string) => void;
onJoinClick?: (wordId: WordId) => void;
onUnjoinClick?: (wordId: WordId) => void;
joinMode?: boolean = false;
joinSourceWordId?: WordId | null = null;
```

### 4. Model the interaction state machine explicitly

Create `interactionMachine.ts` that defines states and legal transitions:

```ts
// States: design | fill | join | reattach
// Transitions:
//   design → fill        (handleModeChange)
//   fill → design         (handleModeChange, with confirmation if clues exist)
//   fill → join           (handleJoinClick)
//   join → fill           (handleClueClickJoinMode or Escape)
//   fill → reattach       (handleDisplacedClueClick)
//   reattach → fill       (handleClueClickReattachMode or Escape)
```

This makes transition rules testable and centralised.

### 5. Target file structure

```
src/lib/
  interaction-machine.ts       — state machine for BuilderInteraction
  cursor-logic.ts              — shared enterLetter, delete, arrow logic
  builder-store.ts             — Svelte store for builder state + actions
  player-store.ts              — Svelte store for player state + actions

src/pages/
  BuilderPage.svelte           — thin orchestration (~150–200 lines)
  PlayerPage.svelte            — thin orchestration (~100–150 lines)
```

## Principle

**Don't push cross-cutting logic down into components that lack context. Pull it out sideways into modules where it can be tested, named, and reused.**

The callback pattern from page → component is sound. The problem is that the page contains too much uncommented, unextracted logic. The fix is not giving components business logic; it's giving the page better-organised business logic to delegate to.

---

## Problem 2: Resolution

### Approach Taken

We rejected recommendation #3 (optional props with no-op defaults) in favor of a **type-safe component split**. The issue wasn't just the no-op callbacks—it was that a single component interface tried to serve two incompatible use cases.

### Solution: Discriminated Union via Component Split

Instead of one `CluePanel` with optional builder props, we created two type-safe wrappers around a shared internal component:

```
src/components/
  _CluePanelInternal.svelte    ← shared template (all props optional)
  CluePanel.svelte             ← player mode (read-only, 4 props)
  EditableCluePanel.svelte     ← builder mode (editable, 10 props required)
```

### Before (Problem)

```svelte
<!-- PlayerPage.svelte -->
<CluePanel
  {words} {grid} selectedWordId={selectedWordId}
  editable={false}
  onClueClick={handleClueClick}
  onClueChange={() => {}}        ← no-op
  onJoinClick={() => {}}         ← no-op
  onUnjoinClick={() => {}}       ← no-op
  joinMode={false}               ← meaningless
  joinSourceWordId={null}        ← meaningless
/>
```

### After (Solution)

```svelte
<!-- PlayerPage.svelte -->
<CluePanel
  {words} {grid} selectedWordId={selectedWordId}
  onClueClick={handleClueClick}
/>
<!-- TypeScript errors if you try to pass builder props -->

<!-- BuilderPage.svelte -->
<EditableCluePanel
  {words} {grid} {selectedWordId}
  onClueClick={handleClueClick}
  onClueChange={handleClueChange}     ← required
  onJoinClick={handleJoinClick}       ← required
  onUnjoinClick={handleUnjoinClick}   ← required
  joinMode={interaction.kind === "join"}
  joinSourceWordId={...}
/>
<!-- TypeScript errors if you omit any builder prop -->
```

### Additional Improvements

1. **Extracted and tested utility function**

   ```ts
   // src/lib/grid-logic.ts
   export function splitWordsByDirection(words: Word[]): {
     across: Word[];
     down: Word[];
   }
   ```

   - 5 test cases in `grid-logic.test.ts`
   - Used by both `CluePanel` and `EditableCluePanel`
   - Eliminates duplicate filter+sort logic

2. **Internal component convention**

   - Underscore prefix (`_CluePanelInternal.svelte`) signals "not a public API"
   - Files sort together in editors
   - Clear visual distinction from public components

3. **Discriminated union for interaction mode**

   After initial implementation, we identified that `joinMode` (boolean) and `joinSourceWordId` (WordId | null) were independent props even though the latter is meaningless without the former. We replaced them with a discriminated union:

   ```ts
   // _CluePanelInternal.svelte
   export type ClueInteractionMode =
     | { kind: "idle" }
     | { kind: "join"; sourceWordId: WordId }
     | { kind: "reattach"; displacedClueId: string };
   ```

   **Benefits:**
   - **Mutually exclusive** — TypeScript enforces only one mode at a time
   - **Type-safe state** — Each mode carries exactly the data it needs
   - **Extensible** — Adding `"reattach"` mode is trivial (already defined)
   - **Prevents invalid states** — Impossible to have `joinMode={true}` with `joinSourceWordId={null}`

   **Usage:**
   ```svelte
   <!-- BuilderPage.svelte -->
   <EditableCluePanel
     interactionMode={
       interaction.kind === "join"
         ? { kind: "join", sourceWordId: interaction.sourceWordId }
         : { kind: "idle" }
     }
   />
   ```

### Tradeoffs Considered

| Approach | Pros | Cons |
|----------|------|------|
| Optional props (original recommendation) | Simple, one component | Type safety weakened, interface still conflates modes |
| Component split (chosen) | Full type safety, clear intent | Extra files, template indirection |
| Snippets | No wrapper overhead | Complex types, less idiomatic |
| **Discriminated union for mode** (refinement) | **Mutually exclusive modes, type-safe state** | **Slightly more verbose construction** |

We chose component split because:
- **Type safety is enforced at component boundaries**, not runtime guards
- **No-op callbacks eliminated entirely**, not just defaulted
- **Template DRY preserved** via `_CluePanelInternal`
- **Each public component is self-documenting**

The discriminated union refinement ensures:
- **`joinMode` and `joinSourceWordId` cannot be inconsistent** — they're now a single atomic value
- **Future modes (reattach) are trivial to add** — already defined in the union
- **Invalid states are unrepresentable** — TypeScript prevents `kind: "join"` without `sourceWordId`

### Verification

```bash
npm run check   # 0 errors, 0 warnings
npm test        # 370 tests passed (including 36 new tests)
```

### Files Changed

- `src/components/CluePanel.svelte` — now a thin read-only wrapper
- `src/components/EditableCluePanel.svelte` — new, thin editable wrapper
- `src/components/_CluePanelInternal.svelte` — new, shared template
- `src/components/ClueEntry.svelte` — made builder props optional (internal use)
- `src/lib/grid-logic.ts` — added `splitWordsByDirection()`
- `src/lib/grid-logic.test.ts` — added 5 tests
- `src/pages/PlayerPage.svelte` — removed 6 lines of no-op props
- `src/pages/BuilderPage.svelte` — switched to `EditableCluePanel`

---

## Problem 3: Implicit State Machine — Resolution

### Problem

`BuilderInteraction` has 4 states (`design`, `fill`, `join`, `reattach`) with transitions scattered across 6+ handlers in BuilderPage. No single place defines legal transitions or guards. It was possible to write code that attempted illegal transitions (e.g., entering join mode from reattach mode).

### Solution: Explicit State Machine in `interaction-machine.ts`

Created a pure function `transitionInteraction(current, event)` that:
- Takes the current state and an event
- Returns the new state, or `null` if the transition is illegal
- Centralizes all legal transition rules in one testable module

```ts
export type InteractionEvent =
  | { kind: "switchMode"; mode: "design" | "fill" }
  | { kind: "startJoin"; sourceWordId: WordId }
  | { kind: "finishJoin" }
  | { kind: "startReattach"; clueIndex: number }
  | { kind: "finishReattach" }
  | { kind: "cancel" }           // Escape key
  | { kind: "activeClueDeleted" }
  | { kind: "clueIndexChanged"; newIndex: number };

export function transitionInteraction(
  current: BuilderInteraction,
  event: InteractionEvent,
): BuilderInteraction | null { ... }
```

### Legal Transitions (Now in One Place)

```
design    ↔ fill          (switchMode)
fill      → join           (startJoin)
join      → fill           (finishJoin, cancel)
fill      → reattach       (startReattach)
reattach  → fill           (finishReattach, cancel, activeClueDeleted)
reattach  → reattach       (clueIndexChanged — adjusts index)
```

All transitions use `switchMode`, even resets:
- Reset → `switchMode: "design"` (from any state)
- Import → `switchMode: "fill"` (from any state)
- Load from storage → `switchMode: "design"` or `switchMode: "fill"` (from any state, never restores sub-modes)

### Before vs After

**Before** — scattered transitions, no guards:
```ts
// In handleJoinClick — no guard
interaction = { kind: "join", sourceWordId: wordId };

// In handleGlobalKeyDown — manual kind check
if (interaction.kind === "join" || interaction.kind === "reattach") {
  interaction = { kind: "fill" };
}
```

**After** — centralized transitions, illegal transitions blocked:
```ts
// In handleJoinClick — state machine guards
const next = transitionInteraction(interaction, { kind: "startJoin", sourceWordId: wordId });
if (next) interaction = next;

// In handleGlobalKeyDown — generic cancel
const next = transitionInteraction(interaction, { kind: "cancel" });
if (next) interaction = next;
```

### Test Coverage

36 tests covering:
- Every legal transition from every starting state
- Every illegal transition that returns `null`
- Edge cases (preserving event data like `sourceWordId` and `clueIndex`)
- Same-mode transitions (cancel from non-sub-mode states)

### Files Changed

- `src/lib/interaction-machine.ts` — new, state machine module
- `src/lib/interaction-machine.test.ts` — new, 36 tests
- `src/pages/BuilderPage.svelte` — all transitions now use `transitionInteraction()`, forced transitions annotated with comments