<script lang="ts">
  type Direction = 'across' | 'down';

  type TypingIntent =
    | { kind: 'type-letter'; letter: string }
    | { kind: 'backspace' }
    | { kind: 'move-cursor'; direction: Direction; sign: -1 | 1 }
    | { kind: 'escape' };

  let {
    enabled,
    onDispatch,
  }: {
    enabled: boolean;
    onDispatch: (intent: TypingIntent) => void;
  } = $props();

  let inputEl: HTMLInputElement | null = $state(null);

  // Focus the hidden input when enabled; blur when disabled.
  $effect(() => {
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
        onDispatch({ kind: 'backspace' });
        return;
      case 'Escape':
        event.preventDefault();
        onDispatch({ kind: 'escape' });
        return;
      case 'ArrowLeft':
        event.preventDefault();
        onDispatch({ kind: 'move-cursor', direction: 'across', sign: -1 });
        return;
      case 'ArrowRight':
        event.preventDefault();
        onDispatch({ kind: 'move-cursor', direction: 'across', sign: 1 });
        return;
      case 'ArrowUp':
        event.preventDefault();
        onDispatch({ kind: 'move-cursor', direction: 'down', sign: -1 });
        return;
      case 'ArrowDown':
        event.preventDefault();
        onDispatch({ kind: 'move-cursor', direction: 'down', sign: 1 });
        return;
      case 'Enter':
      case 'Tab':
        return; // ignore
    }

    if (isLetter(event.key)) {
      event.preventDefault();
      onDispatch({ kind: 'type-letter', letter: event.key.toUpperCase() });
      return;
    }

    // Other key sequences: ignore
  }

  function onInput(event: Event): void {
    if (!enabled) return;
    // Mobile keyboards often don't fire keydown for typed characters; they fire `input`.
    // Read the current value and emit each character as a type-letter intent, then clear.
    const target = event.target as HTMLInputElement;
    if (target.value === '') return;
    // Take only the LAST character (typing one letter at a time):
    const lastChar = target.value.slice(-1);
    if (isLetter(lastChar)) {
      onDispatch({ kind: 'type-letter', letter: lastChar.toUpperCase() });
    }
    // Clear the input so the next input event reports only the new keystroke cleanly.
    target.value = '';
  }

  function onCompositionEnd(event: CompositionEvent): void {
    if (!enabled) return;
    if (typeof event.data !== 'string' || event.data.length === 0) return;
    // For an IME composition, take the LAST character of the composed string.
    // Only A-Z letters are valid; anything else is ignored by the parent via Letter.try.
    const lastChar = event.data.slice(-1);
    if (isLetter(lastChar)) {
      onDispatch({ kind: 'type-letter', letter: lastChar.toUpperCase() });
    }
    // Clear any pending value so onInput doesn't double-fire.
    if (inputEl !== null) inputEl.value = '';
  }
</script>

<input
  id="typing-surface-input"
  bind:this={inputEl}
  type="text"
  autocapitalize="off"
  autocomplete="off"
  autocorrect="off"
  spellcheck="false"
  inert={!enabled}
  class="absolute h-1 w-1 opacity-0 -z-50"
  onkeydown={onKeyDown}
  oninput={onInput}
  oncompositionend={onCompositionEnd}
/>
