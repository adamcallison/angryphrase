<script lang="ts">
  import type { CellData, Word, WordId, ClueInteractionMode } from "$lib/types";
  import CluePanelInternal from "./_CluePanelInternal.svelte";

  let {
    words,
    grid,
    selectedWordId,
    onClueClick,
    onClueChange,
    onJoinClick,
    onUnjoinClick,
    interactionMode = { kind: "idle" } as ClueInteractionMode,
  }: {
    words: Word[];
    grid: CellData[][];
    selectedWordId: WordId | null;
    onClueClick: (wordId: WordId) => void;
    onClueChange: (wordId: WordId, newText: string) => void;
    onJoinClick: (wordId: WordId) => void;
    onUnjoinClick: (wordId: WordId) => void;
    interactionMode: ClueInteractionMode;
  } = $props();
</script>

<CluePanelInternal
  {words}
  {grid}
  {selectedWordId}
  isEditable={true}
  {onClueClick}
  {onClueChange}
  {onJoinClick}
  {onUnjoinClick}
  {interactionMode}
/>
