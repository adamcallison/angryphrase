<script lang="ts">
  import type { AnagramModalVM } from '../bindings/viewmodels/anagramVM';
  import type { PlayerAnagramActions } from '../bindings/playerFacade';
  import OverlayDialog from '../shared/OverlayDialog.svelte';

  let { vm, actions }: { vm: AnagramModalVM | null; actions: PlayerAnagramActions } = $props();

  function onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    actions.input(target.value);
  }
</script>

<OverlayDialog
  open={vm !== null}
  labelId="anagram-dialog-title"
  widthClass="max-w-2xl"
  initialFocusId="anagram-input"
  onClose={actions.close}
>
  {#if vm !== null}
    <div class="mb-4 flex items-center justify-between">
      <h2 id="anagram-dialog-title" class="text-lg font-bold text-gray-800">Anagram Helper</h2>
      <button
        type="button"
        class="text-2xl text-gray-500 hover:text-gray-700 focus-ring"
        onclick={() => actions.close()}
        aria-label="Close"
      >
        ×
      </button>
    </div>

    <!-- Tile row -->
    <div class="mb-4 flex flex-wrap items-center gap-1">
      {#each vm.tiles as tile}
        <div
          class="flex h-12 w-10 items-center justify-center rounded border text-lg font-bold {tile.fixed
            ? 'bg-gray-200 text-gray-500'
            : 'bg-white text-gray-900 border-gray-400'}"
        >
          {tile.letter ?? ''}
        </div>
        {#if tile.separatorAfter === 'space'}
          <div class="w-4"></div>
        {:else if tile.separatorAfter === 'hyphen'}
          <div class="px-1 font-bold text-gray-700">-</div>
        {/if}
      {/each}
    </div>

    <!-- Input -->
    <label for="anagram-input" class="mb-1 block text-sm font-semibold text-gray-700">Your attempt:</label>
    <input
      id="anagram-input"
      type="text"
      value={vm.input}
      oninput={onInput}
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      maxlength={vm.wordLength}
      class="w-full rounded border border-gray-300 px-3 py-2 text-lg uppercase tracking-widest focus-ring"
    />
    <div class="mt-1 text-xs text-gray-500">Entered: {vm.input.length} / {vm.wordLength}</div>

    {#if vm.errorMessage !== null}
      <div class="mt-2 text-xs text-danger">{vm.errorMessage}</div>
    {/if}

    <!-- Expected unique letter counts -->
    <div class="mt-3 text-xs text-gray-500">
      Expected letters:
      {#each vm.expectedUniqueLetterCounts as c}
        <span class="mx-1 font-mono">{c.letter}×{c.count}</span>
      {/each}
    </div>

    <!-- Actions -->
    <div class="mt-4 flex justify-end gap-2">
      <button
        type="button"
        class="btn btn-md btn-tool"
        disabled={!vm.scrambleEnabled}
        onclick={() => actions.scramble()}>Scramble</button>
      <button
        type="button"
        class="btn btn-md btn-secondary"
        onclick={() => actions.close()}>Close</button>
    </div>
  {/if}
</OverlayDialog>
