<script lang="ts">
  import type { BuilderShellVM } from '../bindings/viewmodels/builderVM';
  import {
    builderShellVM,
    getBuilderState,
    dispatchSelectCell,
    dispatchToggleDesignCell,
    dispatchTypeLetter,
    dispatchBackspace,
    dispatchMoveCursor,
    dispatchEscape,
  } from '../bindings/builderStore.svelte';
  import BuilderToolbar from './BuilderToolbar.svelte';
  import BuilderGrid from './BuilderGrid.svelte';
  import BuilderCluePanel from './BuilderCluePanel.svelte';
  import DisplacedCluesPanel from './DisplacedCluesPanel.svelte';
  import JoinReattachBanner from './JoinReattachBanner.svelte';
  import TypingSurface from '../shared/TypingSurface.svelte';
  import type { TypingIntent } from '../shared/typingIntent';

  // No props — BuilderShell owns the entire Builder scene.
  const vm: BuilderShellVM = $derived(builderShellVM());

  function onCellClick(row: number, col: number): void {
    // §7.2: Design → toggle-design-cell; Fill → select-cell (auto-direction per FR-10/11 reducer).
    const state = getBuilderState();
    if (state.mode === 'design') {
      dispatchToggleDesignCell(row, col);
    } else {
      dispatchSelectCell(row, col);
      (document.getElementById('typing-surface-input') as HTMLInputElement | null)?.focus({ preventScroll: true });
    }
  }

  function onTypingIntent(intent: TypingIntent): void {
    switch (intent.kind) {
      case 'type-letter':
        dispatchTypeLetter(intent.letter);
        return;
      case 'backspace':
        dispatchBackspace();
        return;
      case 'move-cursor':
        dispatchMoveCursor(intent.direction, intent.sign);
        return;
      case 'escape':
        dispatchEscape();
        return;
    }
  }
</script>

<div class="mx-auto max-w-7xl px-4 py-4 flex flex-col gap-4">
  <BuilderToolbar vm={vm.toolbar} title={vm.title} author={vm.author} />

  {#if vm.subModeBanner.kind !== 'none'}
    <JoinReattachBanner vm={vm.subModeBanner} />
  {/if}

  <div class="flex flex-col md:flex-row gap-6">
    <!-- left column: grid + displaced clues panel -->
    <section class="flex flex-col gap-4">
      <div class="relative overflow-x-auto">
        <BuilderGrid vm={vm.grid} mode={getBuilderState().mode} onCellClick={onCellClick} />
        <TypingSurface enabled={getBuilderState().mode === 'fill'} onDispatch={onTypingIntent} />
      </div>
      <DisplacedCluesPanel vm={vm.displacedClues} />
    </section>

    <!-- right column: clue panel -->
    <section class="flex-1">
      <BuilderCluePanel vm={vm.cluePanel} />
    </section>
  </div>
</div>
