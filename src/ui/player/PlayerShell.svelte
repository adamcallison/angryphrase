<script lang="ts">
  import type { PlayerShellVM } from '../bindings/viewmodels/playerVM';
  import {
    playerShellVM,
    dispatchSelectCell, dispatchTypeLetter, dispatchBackspace,
    dispatchMoveCursor, dispatchEscape,
  } from '../bindings/playerStore.svelte';
  import PlayerGrid from './PlayerGrid.svelte';
  import ActiveClueBanner from './ActiveClueBanner.svelte';
  import PlayerCluePanel from './PlayerCluePanel.svelte';
  import PlayerToolbar from './PlayerToolbar.svelte';
  import ImportScreen from './ImportScreen.svelte';
  import AnagramModal from './AnagramModal.svelte';
  import TypingSurface from '../shared/TypingSurface.svelte';

  // No props — PlayerShell owns the entire Player scene.
  const vm: PlayerShellVM = $derived(playerShellVM());

  // TypingSurface TypingIntent union (inlined structural type — same shape as in BuilderShell.svelte).
  type TypingIntent =
    | { kind: 'type-letter'; letter: string }
    | { kind: 'backspace' }
    | { kind: 'move-cursor'; direction: 'across' | 'down' }
    | { kind: 'escape' };

  function onCellClick(row: number, col: number): void {
    // Player has no design mode; all grid clicks go through select-cell.
    dispatchSelectCell(row, col);
  }

  function onTypingIntent(intent: TypingIntent): void {
    switch (intent.kind) {
      case 'type-letter': dispatchTypeLetter(intent.letter); return;
      case 'backspace': dispatchBackspace(); return;
      case 'move-cursor': dispatchMoveCursor(intent.direction); return;
      case 'escape': dispatchEscape(); return;
    }
  }
</script>

{#if vm.phase === 'import'}
  <ImportScreen importError={vm.importError} />
{:else}
  <div class="mx-auto max-w-7xl px-4 py-4 flex flex-col gap-4">
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

    <div class="flex gap-6">
      <!-- left column: banners + grid + toolbar -->
      <section class="flex flex-col gap-3 flex-1">
        <ActiveClueBanner vm={vm.topBanner} />
        <PlayerGrid vm={vm.grid} onCellClick={onCellClick} />
        <ActiveClueBanner vm={vm.bottomBanner} />
        <PlayerToolbar vm={vm.toolbar} checkResult={vm.checkResult} />
      </section>

      <!-- right column: clue panel -->
      <section>
        <PlayerCluePanel vm={vm.cluePanel} />
      </section>
    </div>
  </div>
{/if}

<AnagramModal vm={vm.anagram} />
<TypingSurface enabled={vm.phase === 'solving'} onDispatch={onTypingIntent} />
