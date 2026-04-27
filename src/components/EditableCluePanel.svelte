<script lang="ts">
  import type { CellData, Word, WordId } from "$lib/types";
  import CluePanelInternal from "./_CluePanelInternal.svelte";

  let {
    words,
    grid,
    selectedWordId,
    onClueClick,
    onClueChange,
    onJoinClick,
    onUnjoinClick,
    joinMode,
    joinSourceWordId,
  }: {
    words: Word[];
    grid: CellData[][];
    selectedWordId: WordId | null;
    onClueClick: (wordId: WordId) => void;
    onClueChange: (wordId: WordId, newText: string) => void;
    onJoinClick: (wordId: WordId) => void;
    onUnjoinClick: (wordId: WordId) => void;
    joinMode: boolean;
    joinSourceWordId: WordId | null;
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
  {joinMode}
  {joinSourceWordId}
/>
