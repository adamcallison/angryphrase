<script lang="ts">
  import type { BuilderFacade, BuilderShellVM } from '../bindings/builderFacade';
  import BuilderToolbar from './BuilderToolbar.svelte';
  import Grid from '../shared/Grid.svelte';
  import BuilderCluePanel from './BuilderCluePanel.svelte';
  import DisplacedCluesPanel from './DisplacedCluesPanel.svelte';
  import JoinReattachBanner from './JoinReattachBanner.svelte';
  import TypingSurface from '../shared/TypingSurface.svelte';
  import { applyTypingIntent } from '../shared/typingIntent';

  let { builderFacade }: { builderFacade: BuilderFacade } = $props();

  const vm: BuilderShellVM = $derived(builderFacade.builderShellVM());

  function onCellClick(row: number, col: number): void {
    // §7.2: Design → toggle-design-cell; Fill → select-cell (auto-direction per FR-10/11 reducer).
    const state = builderFacade.getBuilderState();
    if (state.mode === 'design') {
      builderFacade.actions.grid.toggleDesignCell(row, col);
    } else {
      builderFacade.actions.grid.selectCell(row, col);
    }
  }

</script>

<div class="mx-auto max-w-7xl px-4 py-4 flex flex-col gap-4">
  <BuilderToolbar vm={vm.toolbar} title={vm.title} author={vm.author} actions={builderFacade.actions.toolbar} pick={builderFacade.pickFile} />

  {#if vm.subModeBanner.kind !== 'none'}
    <JoinReattachBanner vm={vm.subModeBanner} actions={builderFacade.actions.banner} />
  {/if}

  <div class="flex flex-col md:flex-row gap-6">
    <!-- left column: grid + displaced clues panel -->
    <section class="flex flex-col gap-4">
      <div class="relative overflow-x-auto">
        <Grid vm={vm.grid} allCellsClickable={builderFacade.getBuilderState().mode === 'design'} onCellClick={onCellClick} />
        <TypingSurface enabled={builderFacade.getBuilderState().mode === 'fill'} cursor={vm.grid.cursor} onDispatch={(intent) => applyTypingIntent(intent, builderFacade.actions.grid)} />
      </div>
      <DisplacedCluesPanel vm={vm.displacedClues} actions={builderFacade.actions.displacedClues} />
    </section>

    <!-- right column: clue panel -->
    <section class="flex-1">
      <BuilderCluePanel vm={vm.cluePanel} actions={builderFacade.actions.cluePanel} />
    </section>
  </div>
</div>
