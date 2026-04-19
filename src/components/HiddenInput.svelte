<script lang="ts">
  let {
    onKeyAction,
    inputRef = $bindable<HTMLInputElement>(),
  }: {
    /** Callback fired with a processed key string (e.g. "A", "Backspace", "ArrowUp"). */
    onKeyAction: (key: string) => void;
    /** Bindable reference to the underlying <input> element. Use this to focus/blur. */
    inputRef?: HTMLInputElement;
  } = $props();

  /**
   * Whether we're waiting for an `input` event to deliver the actual character
   * because `keydown` gave us "Unidentified" (iOS Safari, some Android browsers).
   */
  let awaitingInput = $state(false);

  function handleKeydown(event: KeyboardEvent): void {
    const { key } = event;

    if (key === 'Unidentified') {
      // Defer to the `input` event which will carry the actual character.
      awaitingInput = true;
      return;
    }

    // Only handle keys the crossword recognises.
    if (/^[a-zA-Z]$/.test(key) || key === 'Backspace' || key.startsWith('Arrow')) {
      event.preventDefault();
      onKeyAction(key);
    }

    // Clear value to prevent accumulation.
    if (inputRef) inputRef.value = '';
  }

  function handleInput(event: Event): void {
    const inputEvent = event as InputEvent;
    if (awaitingInput && inputEvent.data) {
      awaitingInput = false;
      const char = inputEvent.data;
      // Only process single characters (A-Z). Ignore multi-character compositions.
      if (/^[a-zA-Z]$/.test(char)) {
        onKeyAction(char);
      }
    }

    // Always clear to prevent accumulation.
    if (inputRef) inputRef.value = '';
  }

  function handleCompositionEnd(): void {
    // Some IMEs fire compositionend with accumulated text.
    // Clear the value; we don't attempt to process composition results
    // since crosswords take one character at a time.
    if (inputRef) inputRef.value = '';
    awaitingInput = false;
  }
</script>

<input
  bind:this={inputRef}
  type="text"
  autocomplete="off"
  autocorrect="off"
  autocapitalize="characters"
  inputmode="text"
  class="mobile-keyboard-input"
  onkeydown={handleKeydown}
  oninput={handleInput}
  oncompositionend={handleCompositionEnd}
  aria-hidden="true"
  tabindex="-1"
/>

<style>
  .mobile-keyboard-input {
    position: fixed;
    left: 0;
    top: 0;
    opacity: 0;
    width: 1px;
    height: 1px;
    font-size: 16px; /* Prevents Android Chrome auto-zoom */
    pointer-events: none;
    z-index: -1;
  }
</style>