<script lang="ts">
  import type { CellData, Word, WordId, ClueInteractionMode } from "$lib/types";
  import { toWordId, getDisplayClue, isChainHead, getWordLengthPattern } from "$lib/chain-logic";
  import { splitWordsByDirection } from "$lib/grid-logic";
  import ClueEntry from "./ClueEntry.svelte";

  let {
    words,
    grid,
    selectedWordId,
    isEditable,
    onClueClick,
    onClueChange,
    onJoinClick,
    onUnjoinClick,
    interactionMode = { kind: "idle" } as ClueInteractionMode,
  }: {
    words: Word[];
    grid: CellData[][];
    selectedWordId: WordId | null;
    isEditable: boolean;
    onClueClick: (wordId: WordId) => void;
    onClueChange?: (wordId: WordId, newText: string) => void;
    onJoinClick?: (wordId: WordId) => void;
    onUnjoinClick?: (wordId: WordId) => void;
    interactionMode?: ClueInteractionMode;
  } = $props();

  let { across: acrossWords, down: downWords } = $derived(splitWordsByDirection(words));

  // Helper to check current mode
  let isJoinMode = $derived(interactionMode.kind === "join");
  let joinSourceWordId = $derived(
    interactionMode.kind === "join" ? interactionMode.sourceWordId : null
  );
</script>

<div class="flex flex-col gap-4 overflow-y-auto max-h-full">
  <section>
    <h3
      class="font-bold text-sm uppercase tracking-wide mb-1 text-gray-700 border-b border-gray-200 pb-1"
    >
      Across
    </h3>
    <div class="flex flex-col gap-0.5">
      {#each acrossWords as word (toWordId(word))}
        <ClueEntry
          {word}
          number={word.number}
          wordLengthPattern={getWordLengthPattern(grid, word, words)}
          isEditable={isEditable}
          isSelected={selectedWordId === toWordId(word)}
          isChainHead={isChainHead(words, word)}
          displayClue={getDisplayClue(word, words)}
          onClueClick={onClueClick}
          onClueChange={onClueChange}
          onJoinClick={onJoinClick}
          onUnjoinClick={onUnjoinClick}
          joinMode={isJoinMode}
          joinSourceWordId={joinSourceWordId}
        />
      {/each}
    </div>
  </section>

  <section>
    <h3
      class="font-bold text-sm uppercase tracking-wide mb-1 text-gray-700 border-b border-gray-200 pb-1"
    >
      Down
    </h3>
    <div class="flex flex-col gap-0.5">
      {#each downWords as word (toWordId(word))}
        <ClueEntry
          {word}
          number={word.number}
          wordLengthPattern={getWordLengthPattern(grid, word, words)}
          isEditable={isEditable}
          isSelected={selectedWordId === toWordId(word)}
          isChainHead={isChainHead(words, word)}
          displayClue={getDisplayClue(word, words)}
          onClueClick={onClueClick}
          onClueChange={onClueChange}
          onJoinClick={onJoinClick}
          onUnjoinClick={onUnjoinClick}
          joinMode={isJoinMode}
          joinSourceWordId={joinSourceWordId}
        />
      {/each}
    </div>
  </section>
</div>
