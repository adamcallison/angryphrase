<script lang="ts">
  import type { BuilderFacade, BuilderShellVM } from '../bindings/builderFacade';
  import BuilderToolbar from './BuilderToolbar.svelte';
  import Grid from '../shared/Grid.svelte';
  import BuilderCluePanel from './BuilderCluePanel.svelte';
  import DisplacedCluesPanel from './DisplacedCluesPanel.svelte';
  import JoinReattachBanner from './JoinReattachBanner.svelte';
  import TypingSurface from '../shared/TypingSurface.svelte';
  import TwoColumnShell from '../shared/TwoColumnShell.svelte';

  let { builderFacade }: { builderFacade: BuilderFacade } = $props();

  const vm: BuilderShellVM = $derived(builderFacade.builderShellVM());

  function onCellClick(row: number, col: number): void {
    builderFacade.actions.grid.clickCell(row, col);
  }

</script>

<TwoColumnShell>
  {#snippet header()}
    <h2 class="text-lg font-bold text-gray-800">Build a puzzle</h2>
    <BuilderToolbar vm={vm.toolbar} title={vm.title} author={vm.author} actions={builderFacade.actions.toolbar} pick={builderFacade.pickFile} />

    {#if vm.subModeBanner.kind !== 'none'}
      <JoinReattachBanner vm={vm.subModeBanner} actions={builderFacade.actions.banner} />
    {/if}
  {/snippet}

  {#snippet left()}
    <div class="relative overflow-x-auto">
      <Grid vm={vm.grid} allCellsClickable={vm.toolbar.mode === 'design'} onCellClick={onCellClick} />
      <TypingSurface enabled={vm.toolbar.mode === 'fill'} typingFocusSeq={vm.grid.typingFocusSeq} actions={builderFacade.actions.grid} />
    </div>
    <DisplacedCluesPanel vm={vm.displacedClues} actions={builderFacade.actions.displacedClues} />
  {/snippet}

  {#snippet right()}
    <BuilderCluePanel vm={vm.cluePanel} actions={builderFacade.actions.cluePanel} />
  {/snippet}
</TwoColumnShell>
