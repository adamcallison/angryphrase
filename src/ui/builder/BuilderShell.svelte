<script lang="ts">
  import type { BuilderFacade, BuilderShellVM } from '../bindings/builderFacade';
  import BuilderToolbar from './BuilderToolbar.svelte';
  import BuilderCluePanel from './BuilderCluePanel.svelte';
  import DisplacedCluesPanel from './DisplacedCluesPanel.svelte';
  import JoinReattachBanner from './JoinReattachBanner.svelte';
  import GridTypingBlock from '../shared/GridTypingBlock.svelte';
  import TwoColumnShell from '../shared/TwoColumnShell.svelte';
  import SaveFailureBanner from '../shared/SaveFailureBanner.svelte';

  let { builderFacade }: { builderFacade: BuilderFacade } = $props();

  const vm: BuilderShellVM = $derived(builderFacade.builderShellVM());
  const saveBanner = $derived(builderFacade.saveBannerVM());

  function onCellClick(row: number, col: number): void {
    builderFacade.actions.grid.clickCell(row, col);
  }

  // Non-reactive slot for the clue panel's Tab-out handler, registered at
  // panel init (plain wiring held by the component — OverlayDialog's
  // returnFocusEl is the precedent). Absent handler means the default Tab
  // walk, which is today's behaviour for the window before the panel
  // registers.
  let tabOutToSelectedClue: (() => boolean) | null = null;

</script>

<TwoColumnShell>
  {#snippet header()}
    <h2 class="text-lg font-bold text-gray-800">Build a puzzle</h2>
    <SaveFailureBanner vm={saveBanner} />
    <BuilderToolbar vm={vm.toolbar} title={vm.title} author={vm.author} actions={builderFacade.actions.toolbar} pick={builderFacade.pickFile} />

    {#if vm.subModeBanner.kind !== 'none'}
      <JoinReattachBanner vm={vm.subModeBanner} actions={builderFacade.actions.banner} />
    {/if}
  {/snippet}

  {#snippet left()}
    <GridTypingBlock grid={vm.grid} enabled={vm.toolbar.mode === 'fill'} actions={builderFacade.actions.grid} onCellClick={onCellClick} allCellsClickable={vm.toolbar.mode === 'design'} onTabOut={() => tabOutToSelectedClue?.() ?? false} />
    <DisplacedCluesPanel vm={vm.displacedClues} actions={builderFacade.actions.displacedClues} />
  {/snippet}

  {#snippet right()}
    <BuilderCluePanel vm={vm.cluePanel} actions={builderFacade.actions.cluePanel} registerTabOut={(fn) => (tabOutToSelectedClue = fn)} />
  {/snippet}
</TwoColumnShell>
