<script lang="ts">
  import type { CellData, Word, WordId, ClueInteractionMode } from "$lib/types";
  import CluePanelInternal from "./_CluePanelInternal.svelte";

  let {
    words,
    grid,
    selectedWordId,
    onClueClick,
  }: {
    words: Word[];
    grid: CellData[][];
    selectedWordId: WordId | null;
    onClueClick: (wordId: WordId) => void;
  } = $props();

  const interactionMode: ClueInteractionMode = { kind: "idle" };
</script>

<CluePanelInternal
  {words}
  {grid}
  {selectedWordId}
  isEditable={false}
  {onClueClick}
  {interactionMode}
/>
