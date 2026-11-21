<script lang="ts">
  import type { GridActions } from '../bindings/gridActions';

  let {
    enabled,
    typingFocusSeq,
    actions,
  }: {
    enabled: boolean;
    typingFocusSeq: number;
    actions: Pick<GridActions, 'typeLetter' | 'backspace' | 'moveCursor' | 'escape'>;
  } = $props();

  let inputEl: HTMLInputElement | null = $state(null);

  // Non-reactive last-applied values: the focus side effect runs only when the
  // token or the enabled flag *actually changes*. Svelte 5 re-runs effects on
  // parent re-render even with unchanged primitive props (verified empirically);
  // acting on those re-runs was the focus-steal bug (the A4 Tab "cycle").
  let lastSeq: number | null = null;
  let lastEnabled: boolean | null = null;

  $effect(() => {
    if (typingFocusSeq === lastSeq && enabled === lastEnabled) return;
    lastSeq = typingFocusSeq;
    lastEnabled = enabled;
    if (enabled) {
      inputEl?.focus({ preventScroll: true });
    } else {
      inputEl?.blur();
    }
  });

  function isLetter(ch: string): boolean {
    return /^[a-zA-Z]$/.test(ch);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!enabled) return;

    // IME / composition: ignore keydown events that occur mid-composition; we listen for `compositionend` instead.
    if (event.isComposing) return;
    if (event.keyCode === 229) return; // legacy IME composition keyCode

    switch (event.key) {
      case 'Backspace':
        event.preventDefault();
        actions.backspace();
        return;
      case 'Escape':
        event.preventDefault();
        actions.escape();
        return;
      case 'ArrowLeft':
        event.preventDefault();
        actions.moveCursor('across', -1);
        return;
      case 'ArrowRight':
        event.preventDefault();
        actions.moveCursor('across', 1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        actions.moveCursor('down', -1);
        return;
      case 'ArrowDown':
        event.preventDefault();
        actions.moveCursor('down', 1);
        return;
      case 'Enter':
      case 'Tab':
        return; // ignore
    }

    if (isLetter(event.key)) {
      event.preventDefault();
      actions.typeLetter(event.key);
      return;
    }

    // Other key sequences: ignore
  }

  function onInput(event: Event): void {
    if (!enabled) return;
    // Mobile keyboards often don't fire keydown for typed characters; they fire `input`.
    // Read the current value and emit each character as a type-letter call, then clear.
    const target = event.target as HTMLInputElement;
    if (target.value === '') return;
    // Take only the LAST character (typing one letter at a time):
    const lastChar = target.value.slice(-1);
    if (isLetter(lastChar)) {
      actions.typeLetter(lastChar);
    }
    // Clear the input so the next input event reports only the new keystroke cleanly.
    target.value = '';
  }

  function onCompositionEnd(event: CompositionEvent): void {
    if (!enabled) return;
    if (typeof event.data !== 'string' || event.data.length === 0) return;
    // For an IME composition, take the LAST character of the composed string.
    // Letter casing and validation are owned by the facade action via Letter.try.
    const lastChar = event.data.slice(-1);
    if (isLetter(lastChar)) {
      actions.typeLetter(lastChar);
    }
    // Clear any pending value so onInput doesn't double-fire.
    if (inputEl !== null) inputEl.value = '';
  }
</script>

<input
  bind:this={inputEl}
  type="text"
  aria-label="Crossword typing input"
  autocapitalize="off"
  autocomplete="off"
  autocorrect="off"
  spellcheck="false"
  inert={!enabled}
  class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1 w-1 opacity-0 z-typing-surface"
  onkeydown={onKeyDown}
  oninput={onInput}
  oncompositionend={onCompositionEnd}
/>
