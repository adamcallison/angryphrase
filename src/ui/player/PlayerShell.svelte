<script lang="ts">
  import type { PlayerFacade, PlayerShellVM } from '../bindings/playerFacade';
  import ActiveClueBanner from './ActiveClueBanner.svelte';
  import PlayerCluePanel from './PlayerCluePanel.svelte';
  import PlayerToolbar from './PlayerToolbar.svelte';
  import ImportScreen from './ImportScreen.svelte';
  import AnagramModal from './AnagramModal.svelte';
  import GridTypingBlock from '../shared/GridTypingBlock.svelte';
  import TwoColumnShell from '../shared/TwoColumnShell.svelte';
  import SaveFailureBanner from '../shared/SaveFailureBanner.svelte';

  let { playerFacade }: { playerFacade: PlayerFacade } = $props();

  const vm: PlayerShellVM = $derived(playerFacade.playerShellVM());
  const saveBanner = $derived(playerFacade.saveBannerVM());

  function onCellClick(row: number, col: number): void {
    // Player has no design mode; all grid clicks go through select-cell.
    playerFacade.actions.grid.selectCell(row, col);
  }

</script>

{#if vm.phase === 'import'}
  <ImportScreen importError={vm.importError} pick={playerFacade.pickFile} actions={playerFacade.actions.importScreen} />
{:else}
  <TwoColumnShell>
    {#snippet header()}
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-800">
            {vm.title === '' ? 'Untitled Puzzle' : vm.title}
          </h2>
          {#if vm.author !== ''}
            <p class="text-xs text-gray-500">by {vm.author}</p>
          {/if}
        </div>
      </div>
      <SaveFailureBanner vm={saveBanner} />
    {/snippet}

    {#snippet left()}
      <!-- DOM order load-bearing: clue region must precede Grid so the reader queues clue first, then cell. -->
      <div class="sr-only" role="status">{vm.banner.announcement}</div>
      <ActiveClueBanner vm={vm.banner} />
      <GridTypingBlock grid={vm.grid} enabled={vm.anagram === null} actions={playerFacade.actions.grid} onCellClick={onCellClick} />
      <ActiveClueBanner vm={vm.banner} />
      <PlayerToolbar vm={vm.toolbar} checkResult={vm.checkResult} actions={playerFacade.actions.toolbar} />
    {/snippet}

    {#snippet right()}
      <PlayerCluePanel vm={vm.cluePanel} actions={playerFacade.actions.cluePanel} />
    {/snippet}
  </TwoColumnShell>

  <AnagramModal vm={vm.anagram} actions={playerFacade.actions.anagram} />
{/if}
