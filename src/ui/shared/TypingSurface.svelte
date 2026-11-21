<script lang="ts">
  import type { GridActions } from '../bindings/gridActions';

  let {
    enabled,
    typingFocusSeq,
    actions,
    onTabOut,
    onTypingFocusChange,
  }: {
    enabled: boolean;
    typingFocusSeq: number;
    actions: Pick<GridActions, 'typeLetter' | 'backspace' | 'moveCursor' | 'escape'>;
    // `| undefined` so the pass-through leaf can forward an absent optional
    // prop under exactOptionalPropertyTypes.
    onTabOut?: (() => boolean) | undefined;
    onTypingFocusChange?: (keyboard: boolean) => void;
  } = $props();

  let inputEl: HTMLInputElement | null = $state(null);

  // Non-reactive last-applied values: the focus side effect runs only when the
  // token or the enabled flag *actually changes*. Svelte 5 re-runs effects on
  // parent re-render even with unchanged primitive props (verified empirically);
  // acting on those re-runs was the former focus-steal bug (Tab focus cycled
  // between the clue entry and this hidden input).
  let lastSeq: number | null = null;
  let lastEnabled: boolean | null = null;

  // Last interaction modality, tracked so GridTypingBlock can ring the grid
  // wrapper only for keyboard acquisition (pointer mints and touch taps
  // never ring). Non-reactive on purpose: only the focus report below reads it.
  let lastModality: 'pointer' | 'keyboard' = 'pointer';
  let lastListenerEnabled: boolean | null = null;
  let lastRouterEnabled: boolean | null = null;

  // Window capture listeners exist only while enabled (OverlayDialog's
  // effect-gated window listener is the precedent). Guarded by the same
  // last-applied comparison as the focus effect above: a parent re-render
  // must not tear the listeners down, or the cleanup's false report would
  // drop a live keyboard ring. The cleanup reports false so enabled-flips
  // and unmounts (which fire no blur) still clear GridTypingBlock's ring.
  $effect(() => {
    if (enabled === lastListenerEnabled) return;
    lastListenerEnabled = enabled;
    if (!enabled) return;
    const onPointer = (): void => {
      lastModality = 'pointer';
    };
    const onKey = (): void => {
      lastModality = 'keyboard';
    };
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey, true);
      onTypingFocusChange?.(false);
    };
  });

  // Grid-first fallback router: while enabled, letters and Backspace are
  // grid-bound whenever no other surface owns them. This leaf already owns
  // keyboard typing normalisation for the input's own events (IME guards,
  // raw-character dispatch through the actions bag); the router extends that
  // ownership to the window, so a letter typed with focus on a toolbar
  // button or a clue row lands in the grid without focus theft. Arrows,
  // Escape, Enter and Tab never route — the clue listbox keeps its arrow
  // browsing, dialogs keep their traps, the default Tab walk stands — and
  // DOM focus never moves on a routed key.
  function routeFallback(event: KeyboardEvent): void {
    // IME / composition: same guards as the input's own keydown handler.
    if (event.isComposing) return;
    if (event.keyCode === 229) return; // legacy IME composition keyCode

    const target = event.target;
    // Editable targets own their keys. The hidden input itself is an
    // HTMLInputElement, so when it is focused its own handler has already
    // routed and the router never double-dispatches.
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return;
    }
    if (target instanceof HTMLElement && target.isContentEditable) return;

    // An open dialog owns its keys (confirm modal, anagram modal).
    if (target instanceof Element && target.closest('[role="dialog"]') !== null) return;

    // Modifier chords are browser shortcuts (Ctrl+R, Cmd+C), never grid input.
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (isLetter(event.key)) {
      event.preventDefault();
      actions.typeLetter(event.key);
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      actions.backspace();
      return;
    }
    // Everything else is untouched: un-routed keys keep browser defaults.
  }

  // Window keydown router, mounted only while enabled (no path routes
  // letters while the surface is disabled — Builder design mode, the Player
  // import screen, an open anagram modal). Guarded like the listener effect
  // above: a parent re-render with unchanged enabled must not tear it down.
  $effect(() => {
    if (enabled === lastRouterEnabled) return;
    lastRouterEnabled = enabled;
    if (!enabled) return;
    window.addEventListener('keydown', routeFallback);
    return () => {
      window.removeEventListener('keydown', routeFallback);
    };
  });

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

  function onFocusReport(): void {
    // Double false reports are harmless: GridTypingBlock's boolean is idempotent.
    onTypingFocusChange?.(lastModality === 'keyboard');
  }

  function onBlurReport(): void {
    onTypingFocusChange?.(false);
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
        return; // ignore
      case 'Tab':
        // Plain Tab (never Shift+Tab — the backward walk stays default) is
        // offered to the shell; a true return means focus moved and the
        // default walk is prevented. Absent or false falls through to the
        // normal Tab order.
        if (event.shiftKey) return;
        if (onTabOut?.() === true) event.preventDefault();
        return;
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
  onfocus={onFocusReport}
  onblur={onBlurReport}
  oninput={onInput}
  oncompositionend={onCompositionEnd}
/>
