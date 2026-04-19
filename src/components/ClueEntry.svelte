<script lang="ts">
  import type { Word, WordId } from "$lib/types";
  import { toWordId } from "$lib/chain-logic";

  let {
    word,
    number,
    wordLengthPattern,
    isEditable,
    isSelected,
    isChainHead,
    displayClue,
    onClueClick,
    onClueChange,
    onJoinClick,
    onUnjoinClick,
    joinMode,
    joinSourceWordId,
    onSelected,
  }: {
    word: Word;
    number: number;
    wordLengthPattern: string;
    isEditable: boolean;
    isSelected: boolean;
    isChainHead: boolean;
    displayClue: string;
    onClueClick: (wordId: WordId) => void;
    onClueChange?: (wordId: WordId, newText: string) => void;
    onJoinClick?: (wordId: WordId) => void;
    onUnjoinClick?: (wordId: WordId) => void;
    joinMode?: boolean;
    joinSourceWordId?: WordId | null;
    /** Called with the root element when this entry becomes selected. */
    onSelected?: (el: HTMLElement) => void;
  } = $props();

  let wordId = $derived(toWordId(word));
  let directionLabel = $derived(
    word.direction === "across" ? "Across" : "Down"
  );
  let isJoinSource = $derived(joinMode && joinSourceWordId === wordId);
  let hasChainLink = $derived(word.nextWord !== null);

  let rootEl: HTMLElement | undefined = $state();

  $effect(() => {
    if (isSelected && rootEl) {
      onSelected?.(rootEl);
    }
  });

  function handleClick(): void {
    onClueClick(wordId);
  }

  function handleKeydown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
    if (e.key === "Enter" || (e.key === " " && !isInput)) {
      e.preventDefault();
      onClueClick(wordId);
    }
  }

  function handleInputChange(e: Event): void {
    const target = e.currentTarget as HTMLInputElement;
    onClueChange?.(wordId, target.value);
  }

  function handleJoinClick(e: MouseEvent): void {
    e.stopPropagation();
    onJoinClick?.(wordId);
  }

  function handleUnjoinClick(e: MouseEvent): void {
    e.stopPropagation();
    onUnjoinClick?.(wordId);
  }

  function handleInputClick(e: MouseEvent): void {
    e.stopPropagation();
  }
</script>

<div
  bind:this={rootEl}
  class="clue-entry {isSelected ? 'clue-entry--selected' : ''} {isJoinSource ? 'clue-entry--join-source' : ''}"
  role="button"
  tabindex="0"
  onclick={handleClick}
  onkeydown={handleKeydown}
>
  <span class="clue-number">
    {number} {directionLabel}{#if isChainHead} <span class="clue-length">({wordLengthPattern})</span>{/if}
  </span>

  <div class="clue-content">
    {#if isChainHead}
      {#if isEditable}
        <input
          type="text"
          class="clue-input"
          value={word.clue}
          oninput={handleInputChange}
          onclick={handleInputClick}
          spellcheck="false"
          placeholder="Enter clue..."
        />
      {:else}
        <span class="clue-text">{displayClue}</span>
      {/if}
    {:else}
      <!-- Non-chain-head: show "→ See [number] [direction]" reference -->
      <span class="clue-reference">{displayClue}</span>
    {/if}
  </div>

  {#if isEditable}
    {#if hasChainLink}
      <button
        class="clue-action-btn clue-action-btn--unlink"
        onclick={handleUnjoinClick}
      >
        Unlink ✕
      </button>
    {:else}
      <button
        class="clue-action-btn clue-action-btn--link"
        onclick={handleJoinClick}
      >
        Link next →
      </button>
    {/if}
  {/if}
</div>

<style>
  .clue-entry {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem; /* gap-2 */
    padding: 0.25rem 0.5rem; /* py-1 px-2 */
    border-radius: 0.25rem; /* rounded */
    cursor: pointer;
    user-select: none;
  }

  .clue-entry:hover {
    background: #f9fafb; /* gray-50 */
  }

  .clue-entry--selected {
    background: #fef3c7; /* yellow-100 */
  }

  .clue-entry--join-source {
    outline: 2px solid #60a5fa; /* ring-2 ring-blue-400 */
    outline-offset: -1px;
  }

  .clue-number {
    font-weight: 700;
    font-size: 0.875rem; /* text-sm */
    min-width: var(--clue-number-width);
    flex-shrink: 0;
    padding-top: 0.125rem; /* pt-0.5 */
  }

  .clue-length {
    font-weight: normal;
    color: #6b7280; /* gray-500 */
  }

  .clue-content {
    flex: 1;
    min-width: 0;
  }

  .clue-input {
    width: 100%;
    font-size: 0.875rem; /* text-sm */
    border: 1px solid #d1d5db; /* gray-300 */
    border-radius: 0.25rem;
    padding: 0.125rem 0.375rem; /* py-0.5 px-1.5 */
    background: white;
  }

  .clue-input:focus {
    outline: none;
    box-shadow: 0 0 0 1px #60a5fa; /* ring-1 ring-blue-400 */
  }

  .clue-text {
    font-size: 0.875rem; /* text-sm */
  }

  .clue-reference {
    font-size: 0.875rem; /* text-sm */
    color: #6b7280; /* gray-500 */
    font-style: italic;
  }

  .clue-action-btn {
    font-size: 0.75rem; /* text-xs */
    padding: 0.125rem 0.375rem; /* py-0.5 px-1.5 */
    border-radius: 0.25rem;
    flex-shrink: 0;
    margin-top: 0.125rem; /* mt-0.5 */
    transition: colors 0.15s;
  }

  .clue-action-btn--link {
    color: #2563eb; /* blue-600 */
    border: 1px solid #93c5fd; /* blue-300 */
  }

  .clue-action-btn--link:hover {
    color: #1d4ed8; /* blue-800 */
    border-color: #3b82f6; /* blue-500 */
  }

  .clue-action-btn--unlink {
    color: #dc2626; /* red-600 */
    border: 1px solid #fca5a5; /* red-300 */
  }

  .clue-action-btn--unlink:hover {
    color: #991b1b; /* red-800 */
    border-color: #ef4444; /* red-500 */
  }
</style>
