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
    onClueChange,
    onClueClick,
    onJoinClick,
    onUnjoinClick,
    joinMode,
    joinSourceWordId,
  }: {
    word: Word;
    number: number;
    wordLengthPattern: string;
    isEditable: boolean;
    isSelected: boolean;
    isChainHead: boolean;
    displayClue: string;
    onClueChange: (wordId: WordId, newText: string) => void;
    onClueClick: (wordId: WordId) => void;
    onJoinClick: (wordId: WordId) => void;
    onUnjoinClick: (wordId: WordId) => void;
    joinMode: boolean;
    joinSourceWordId: WordId | null;
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
      rootEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    onClueChange(wordId, target.value);
  }

  function handleJoinClick(e: MouseEvent): void {
    e.stopPropagation();
    onJoinClick(wordId);
  }

  function handleUnjoinClick(e: MouseEvent): void {
    e.stopPropagation();
    onUnjoinClick(wordId);
  }

  function handleInputClick(e: MouseEvent): void {
    e.stopPropagation();
  }
</script>

<div
  bind:this={rootEl}
  class="flex items-start gap-2 px-2 py-1 rounded cursor-pointer select-none
    {isSelected ? 'bg-yellow-100' : 'hover:bg-gray-50'}
    {isJoinSource ? 'ring-2 ring-blue-400' : ''}"
  role="button"
  tabindex="0"
  onclick={handleClick}
  onkeydown={handleKeydown}
>
  <span class="font-bold text-sm min-w-[4.5rem] shrink-0 pt-0.5">
    {number} {directionLabel}{#if isChainHead} <span class="font-normal text-gray-500">({wordLengthPattern})</span>{/if}
  </span>

  <div class="flex-1 min-w-0">
    {#if isChainHead}
      {#if isEditable}
        <input
          type="text"
          value={word.clue}
          oninput={handleInputChange}
          onclick={handleInputClick}
          spellcheck="false"
          class="w-full text-sm border border-gray-300 rounded px-1.5 py-0.5 bg-white
            focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="Enter clue..."
        />
      {:else}
        <span class="text-sm">{displayClue}</span>
      {/if}
    {:else}
      <!-- Non-chain-head: show "→ See [number] [direction]" reference -->
      <span class="text-sm text-gray-500 italic">{displayClue}</span>
    {/if}
  </div>

  {#if isEditable}
    {#if hasChainLink}
      <button
        class="text-xs text-red-600 hover:text-red-800 px-1.5 py-0.5 rounded
          border border-red-300 hover:border-red-500 shrink-0 mt-0.5"
        onclick={handleUnjoinClick}
      >
        Unlink ✕
      </button>
    {:else}
      <button
        class="text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded
          border border-blue-300 hover:border-blue-500 shrink-0 mt-0.5"
        onclick={handleJoinClick}
      >
        Link next →
      </button>
    {/if}
  {/if}
</div>