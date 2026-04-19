# Mobile Keyboard Support — Design Document

## 1. Problem

On mobile devices, tapping a crossword cell does not bring up the soft keyboard. The grid handles key input via `onkeydown` on a `<div>` with `tabindex="0"`. Mobile browsers only show the soft keyboard when a text input (`<input>` or `<textarea>`) is focused. There is no `<input>` element anywhere in the crossword interaction — just `div` cells.

## 2. Approach: Hidden Input Proxy

Add a single, visually-hidden `<input>` element to the page. When a cell is selected (in Player mode or Builder fill mode), focus is moved to this hidden input. The mobile browser sees a focused text input and shows the soft keyboard. Keystrokes from the input are intercepted and routed to the existing key-handling logic.

This is the standard technique used by crossword web apps (NYT, The Guardian, etc.).

### Why not per-cell inputs?

Per-cell `<input>` elements would be 225+ elements for a 15×15 grid. Each would need focus management, and mobile browsers handle rapid focus changes poorly (flickering keyboards, scroll jumps). A single hidden input is simpler and more reliable.

### Why not `contenteditable`?

`contenteditable` on a `div` triggers the keyboard on some mobile browsers but not all (notably inconsistent on iOS Safari). It also injects a rich-text editing UI and composition behavior that we'd have to fight against. `<input>` is the most universally supported trigger for the soft keyboard.

## 3. Architecture

### 3.1 Component Changes

**New component: `HiddenInput.svelte`**

A standalone component that renders a single `<input>` element, positioned off-screen (not `display: none` — that prevents focus/keyboard on some browsers). It accepts a callback that receives the key input.

**No changes to `CrosswordGrid.svelte` or `Cell.svelte`.** Those remain pure visual/display components. The grid `div` stays `tabindex="0"` and keeps its `keydown` handler for desktop keyboard input.

**Changes to `PlayerPage.svelte`:**

- Render `<HiddenInput>` alongside the grid
- When a cell is selected (cursor.cell is non-null), focus the hidden input
- When no cell is selected, blur the hidden input (dismisses the keyboard)
- Route input from `HiddenInput` to the existing `handleKeyInput` logic

**Changes to `BuilderPage.svelte`:**

- Same pattern as PlayerPage, but only in fill mode
- In design mode, the hidden input is not focused (no keyboard needed for toggling cells)

### 3.2 Data Flow

```
Mobile user taps cell
  → handleCellClick() sets cursor.cell
  → $effect watches cursor.cell, focuses hidden input
  → Mobile browser shows soft keyboard
  → User types on soft keyboard
  → HiddenInput intercepts 'keydown' or 'input' event
  → Routes key to handleKeyInput() (same logic as desktop)
  → Grid state updates normally
```

Desktop flow is unchanged — the grid `div` continues to receive `keydown` events directly. The hidden input is only necessary for mobile.

## 4. Detailed Behavior

### 4.1 The Hidden Input

```html
<input
  type="text"
  autocomplete="off"
  autocorrect="off"
  autocapitalize="characters"
  inputmode="text"
  style="position: absolute; left: -9999px; top: -9999px; opacity: 0; width: 1px; height: 1px;"
/>
```

Key attributes:
- **`type="text"`** — Required for the keyboard to appear. `type="hidden"` does NOT trigger the keyboard.
- **`autocomplete="off"`** — Prevents browser autocomplete suggestions.
- **`autocorrect="off"`** — Prevents iOS from "correcting" crossword letters.
- **`autocapitalize="characters"`** — Hints to mobile keyboards to produce uppercase, matching our crossword input model.
- **`inputmode="text"`** — Shows the full alphabet keyboard (not numeric).

Positioning uses absolute positioning off-screen rather than `display: none` or `visibility: hidden`, because some mobile browsers won't focus or show keyboards for `display: none` inputs, and `visibility: hidden` can have similar issues.

### 4.2 Input Event Handling

The hidden input needs to handle **two** event types, because mobile browser behavior is inconsistent:

1. **`keydown`** — Fires on most browsers (desktop and some mobile). Already handled by our existing `handleKeyInput` logic. Works the same as the current grid `div` handler.

2. **`beforeinput` / `input`** — On many mobile browsers (especially iOS Safari), `keydown` fires with `key: "Unidentified"` for most characters. The actual character arrives via the `input` event. We need to listen for `input` events and extract the character from `event.data` when `keydown` gave us `"Unidentified"`.

**Strategy:**

- On `keydown`:
  - If `event.key` is a recognized key (letter, Backspace, Arrow key), handle it immediately and clear the input value (to prevent accumulation).
  - If `event.key` is `"Unidentified"`, set a flag and wait for the `input` event.
  - If `event.key` is something we don't handle (e.g., Shift, Tab), ignore it.

- On `input`:
  - If the "awaiting input" flag is set, extract the character from `event.data`, process it as a letter, clear the input value.
  - If no flag, ignore (the input was already handled by `keydown`).

- On `compositionend`: Clear the input value. Some IMEs fire `compositionend` with accumulated text; we process the final character.

The input's value is **always** cleared after each key/input event. We never let text accumulate in the input — it exists solely to trigger the keyboard and capture individual keystrokes.

### 4.3 Focus Management

- **When `cursor.cell` becomes non-null** → Focus the hidden input. This happens on cell click or clue click.
- **When `cursor.cell` becomes null** → Blur the hidden input. This dismisses the keyboard.
- **After processing a letter key** → Keep focus on the hidden input (it may lose focus on some browsers after value manipulation; re-focus if needed).
- **On mobile scroll** → Some browsers dismiss the keyboard on scroll. This is acceptable; the user can tap a cell to bring it back.

### 4.4 Interaction with Desktop

On desktop, the grid `div` with `tabindex="0"` and `onkeydown` continues to work as-is. The hidden input sits off-screen and does not interfere because:

- Desktop users type on a physical keyboard while the grid `div` has focus.
- The hidden input only gains focus via the `$effect` on `cursor.cell`, which also works on desktop — but since desktop users already have the grid focused and typing works, the dual-input doesn't cause issues. Both the grid `keydown` and the hidden input `keydown` would fire. To prevent double-processing:
  - The hidden input `keydown` handler calls `event.stopPropagation()` so it doesn't bubble to the grid.
  - The grid `keydown` handler is only active when the grid has focus (which it won't when the hidden input is focused).
  - In practice, on desktop the user types with the grid focused. The hidden input being focused simultaneously is fine because the grid won't receive the events.

Actually, let me reconsider. The simpler approach: **remove the `onkeydown` from the grid `div` and always route keyboard input through the hidden input.** This eliminates the dual-input problem entirely.

**Revised approach:** The grid `div` keeps `tabindex="0"` and `role="grid"` for accessibility, but `onkeydown` is removed. Instead, the parent page component renders `HiddenInput` and passes the key events to `handleKeyInput`. On both mobile and desktop, keyboard input flows through the hidden input.

Wait — this means desktop users must have the hidden input focused to type. That works fine: when a cell is selected, the hidden input gets focus. The grid remains visually focused (yellow cell) via state, not DOM focus.

### 4.5 Preventing Double-Entry

With the grid `keydown` removed, there's no dual input path. All keyboard input goes through the hidden input. The grid's `tabindex="0"` is kept for accessibility (screen readers can focus it), but the `onkeydown` handler moves to `HiddenInput`.

Actually, we can keep `tabindex="0"` on the grid for accessibility but remove the `onkeydown`. The `HiddenInput` is always focused when a cell is selected, so keyboard events go there.

But what about accessibility? Screen reader users might focus the grid directly. The grid should still have `role="grid"` and `tabindex="0"`. If a screen reader user focuses the grid and types, we'd miss those keystrokes. We could keep the grid's `onkeydown` as a fallback, but then we risk double-processing on mobile.

**Simplest approach that works:** Keep the grid's `onkeydown` for accessibility. In the `HiddenInput` `keydown` handler, if we process a key, call `event.preventDefault()` and `event.stopPropagation()`. In the grid's `onkeydown`, if we process a key, call `event.preventDefault()`. Since only one element can be focused at a time (either the grid or the hidden input), only one handler will fire for any given keystroke. No double-processing.

### 4.6 Builder Page Differences

The Builder page has two modes:

- **Design mode**: Clicking toggles cells black/white. No keyboard input needed. The hidden input should NOT be focused.
- **Fill mode**: Same as Player page — keyboard input for entering letters. The hidden input SHOULD be focused when a cell is selected.

The Builder page already handles this distinction in `handleKeyDown`:
```typescript
if (interaction.kind !== "fill" || !cursor.cell) return;
```

The `HiddenInput` on the Builder page should only be active (focusable) in fill mode.

## 5. Mobile-Specific Edge Cases

| Case | Handling |
|------|----------|
| iOS Safari `keydown` with `key: "Unidentified"` | Use `beforeinput`/`input` event to capture the actual character |
| iOS autocorrect overlay | Set `autocorrect="off"`, `autocomplete="off"` on the input |
| iOS autocapitalize | Set `autocapitalize="characters"` for uppercase |
| Android compositional input (e.g., Japanese IME) | Handle `compositionstart`/`compositionend` events; ignore input during composition, process the final character |
| Browser zoom on input focus | The input is off-screen and 1×1px, so zoom should not be affected. If Android Chrome zooms, add `font-size: 16px` (the threshold for auto-zoom) |
| Keyboard dismisses on scroll | Acceptable. User taps a cell to refocus. Do NOT auto-refocus on scroll — this causes the keyboard to reappear unexpectedly and is a poor UX pattern |
| Rapid typing | Clear the input value after each processed character to prevent accumulation and maintain correct cursor state |
| Backspace on mobile | `keydown` with `key: "Backspace"` fires reliably on mobile. Handle normally |
| User taps outside grid (deselects cell) | `cursor.cell` becomes null → blur hidden input → keyboard dismisses |
| Chevron keys on mobile keyboards | Most mobile keyboards don't have arrow keys. Not a concern — navigation is tap-based on mobile |

## 6. Implementation Plan

### 6.1 New File

| File | Purpose |
|------|---------|
| `src/components/HiddenInput.svelte` | The hidden `<input>` component with all event handling |

### 6.2 Modified Files

| File | Changes |
|------|---------|
| `src/pages/PlayerPage.svelte` | Render `HiddenInput`, wire up focus management via `$effect` on `cursor.cell`, route key events to `handleKeyInput` |
| `src/pages/BuilderPage.svelte` | Same as PlayerPage, but only in fill mode |
| `src/components/CrosswordGrid.svelte` | Remove `onKeyDown` prop and `onkeydown` handler from the grid `div`. The grid no longer handles keyboard input directly — that's the page's responsibility via `HiddenInput` |

### 6.3 Implementation Steps (Order)

1. **Create `HiddenInput.svelte`** — Component with:
   - Off-screen `<input>` with appropriate mobile attributes
   - `keydown` handler that processes known keys and defers "Unidentified" to the `input` handler
   - `input` handler that extracts characters from `event.data` for "Unidentified" keys
   - `onInput` callback prop so the parent can handle processed key events
   - `expose` a `focus()` method via `$bindable` or a binding so the parent can focus it programmatically
   - Value clearing after each processed character

2. **Modify `CrosswordGrid.svelte`** — Remove `onKeyDown` prop and remove `onkeydown={onKeyDown}` from the grid `div`. The grid becomes a purely visual/click-target component.

3. **Modify `PlayerPage.svelte`** — 
   - Add `HiddenInput` instance
   - Bind a ref to call `.focus()` on the hidden input
   - Add `$effect` that focuses the hidden input when `cursor.cell` is non-null, blurs when null
   - Wire `HiddenInput`'s `onInput` callback to the existing `handleKeyInput` + state update logic (same logic currently in `handleKeyDown`)
   - Remove the `handleKeyDown` function (its logic moves into the HiddenInput callback)

4. **Modify `BuilderPage.svelte`** — Same pattern as PlayerPage, but:
   - Only focus the hidden input when `interaction.kind === "fill"` and `cursor.cell` is non-null
   - In design mode, blur the hidden input

5. **Test on mobile browsers** — Verify keyboard appears on iOS Safari and Android Chrome, letters are entered correctly, autocorrect doesn't interfere.

### 6.4 HiddenInput Props

```typescript
interface HiddenInputProps {
  /** Callback when a key is processed (letter, Backspace, or arrow key). */
  onKey: (result: KeyResult) => void;
}

/** Result from a processed key event. */
interface KeyResult {
  key: string;  // The processed key: a letter, "Backspace", or arrow direction
}
```

Wait, actually the callback should match the existing pattern. Let me look at how `handleKeyInput` is called:

```typescript
const result = handleKeyInput(event.key, grid, cell, direction, letterSource);
if (result) {
  event.preventDefault();
  grid = result.grid;
  cursor.cell = result.nextCell;
  cursor.direction = result.nextDirection;
}
```

The `HiddenInput` doesn't need to know about `handleKeyInput` — it just needs to report what key was pressed. The parent page handles the logic. So the prop should be simpler:

```typescript
interface HiddenInputProps {
  /** Callback when a key event should be processed. */
  onKeyAction: (key: string) => void;
}
```

The parent calls `handleKeyInput(key, ...)` and applies the result. The `HiddenInput`'s job is purely to capture mobile keystrokes and normalize them into key strings.

Actually, even simpler: the `HiddenInput` can directly accept an `onKeyDown`-style handler, same as what `CrosswordGrid` currently accepts. The parent passes down the same handler function. The `HiddenInput` normalizes mobile quirkiness and then calls the handler with a synthetic-like key event (or just the key string).

Let me settle on the simplest interface:

```typescript
// HiddenInput receives a callback that fires with the key string
// for letters (e.g., "A"), "Backspace", "ArrowUp", etc.
onKeyAction: (key: string) => void;
```

The parent page binds this to whatever logic it wants:

```svelte
<!-- PlayerPage -->
<HiddenInput onKeyAction={handleKeyAction} />

function handleKeyAction(key: string): void {
  if (!cursor.cell) return;
  const result = handleKeyInput(key, playerData.grid, cursor.cell, cursor.direction, "player");
  if (result) {
    playerData.grid = result.grid;
    cursor.cell = result.nextCell;
    cursor.direction = result.nextDirection;
  }
}
```

### 6.5 Focus Management Detail

**PlayerPage:**
```typescript
let hiddenInputRef: HTMLInputElement;

$effect(() => {
  if (cursor.cell) {
    hiddenInputRef?.focus();
  } else {
    hiddenInputRef?.blur();
  }
});
```

**BuilderPage:**
```typescript
let hiddenInputRef: HTMLInputElement;

$effect(() => {
  if (interaction.kind === "fill" && cursor.cell) {
    hiddenInputRef?.focus();
  } else {
    hiddenInputRef?.blur();
  }
});
```

### 6.6 Preventing Android Auto-Zoom

Android Chrome auto-zooms when an input with `font-size < 16px` is focused. Our hidden input should have:

```css
font-size: 16px;
```

This prevents the zoom without affecting the visible layout (the input is off-screen).

## 7. What NOT To Do

- **Don't use `contenteditable`** — Inconsistent keyboard triggering across mobile browsers, introduces rich-text editing behavior we'd have to suppress.
- **Don't create per-cell inputs** — 225+ inputs for a 15×15 grid, each requiring focus management. Slow, buggy on mobile.
- **Don't auto-refocus on scroll** — This causes the keyboard to keep popping back up when the user is trying to scroll. Let the user re-tap a cell.
- **Don't use `inputmode="none"`** — This suppresses the keyboard entirely (opposite of what we want).
- **Don't use `type="hidden"`** — Browsers don't show keyboards for hidden inputs.
- **Don't try to position the input near the selected cell** — This is unnecessary complexity. The input is off-screen; the user won't notice. Some implementations position the input near the cell to influence keyboard cursor position, but since we clear the value after each character, this doesn't matter.

## 8. Implementation Deviations from Original Design

The implemented solution differs from the design doc in a few ways:

### 8.1 Focus Ring Removed from Grid

The `focus-visible:ring-*` classes were removed from `CrosswordGrid.svelte`. Since focus now lives on the hidden input (not the grid div), the grid would never show a focus ring anyway. The selected cell's yellow highlight already serves as the visual indicator.

### 8.2 Grid `onKeyDown` Removed

The `onKeyDown` prop was removed from `CrosswordGrid.svelte`. All keyboard input now flows through `HiddenInput` — on both desktop and mobile. This eliminates the dual-input problem where both the grid and the hidden input could receive keystrokes.

### 8.3 Component Interface: `$bindable` inputRef

Instead of exporting `focus()`/`blur()` methods from the component (which doesn't work cleanly with Svelte 5 `bind:this` on component instances), the `HiddenInput` exposes a `$bindable<HTMLInputElement>` prop called `inputRef`. The parent binds a variable to this prop and calls `focus()`/`blur()` on the raw DOM element directly. This is simpler and avoids Svelte 5's component instance typing limitations.

### 8.4 State: `$state` for bind ref, `$state` for awaiting input

- `mobileInput` in page components is declared with `$state<HTMLInputElement>()` to satisfy Svelte's reactivity tracking (avoiding the `non_reactive_update` warning), even though the ref itself doesn't need to trigger effects.
- `awaitingInput` in `HiddenInput` uses `$state` since it's set in event handlers and read in the `input` handler.

## 9. Alternative Considered: Shift Input Handling Entirely Into HiddenInput

Instead of the `HiddenInput` just reporting key strings, it could receive `handleKeyInput`-compatible props and produce the full `CursorResult`. This would make the component more self-contained but would couple it to the crossword-specific state model. The simpler approach (reporting key strings) keeps `HiddenInput` generic and leaves the game logic in the page component where it lives today.