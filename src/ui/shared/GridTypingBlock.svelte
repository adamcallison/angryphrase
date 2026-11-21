<script lang="ts">
  import type { GridVM } from '../bindings/viewmodels/gridVM';
  import type { GridActions } from '../bindings/gridActions';
  import Grid from './Grid.svelte';
  import TypingSurface from './TypingSurface.svelte';

  let {
    grid,
    enabled,
    actions,
    onCellClick,
    allCellsClickable = false,
    onTabOut,
  }: {
    grid: GridVM;
    enabled: boolean;
    actions: Pick<GridActions, 'typeLetter' | 'backspace' | 'moveCursor' | 'escape'>;
    onCellClick: (row: number, col: number) => void;
    allCellsClickable?: boolean;
    onTabOut?: () => boolean;
  } = $props();

  // Modality-gated typing-focus boolean (TypingSurface reports; true means
  // keyboard acquisition — ring the grid wrapper, false means pointer/touch or
  // lost focus — no ring). Moved here from the shells in the B1→B2 flip.
  let typingFocusRing = $state(false);
</script>

<div class="relative overflow-x-auto {typingFocusRing ? 'focus-ring-within' : ''}">
  <Grid vm={grid} onCellClick={onCellClick} allCellsClickable={allCellsClickable} />
  <TypingSurface enabled={enabled} typingFocusSeq={grid.typingFocusSeq} actions={actions} onTabOut={onTabOut} onTypingFocusChange={(keyboard) => (typingFocusRing = keyboard)} />
</div>
