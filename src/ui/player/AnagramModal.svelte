<script lang="ts">
  import type { AnagramModalVM } from '../bindings/viewmodels/anagramVM';
  import {
    dispatchAnagramInput,
    dispatchAnagramScramble,
    dispatchCloseAnagramHelper,
  } from '../bindings/playerStore.svelte';

  let { vm }: { vm: AnagramModalVM } = $props();

  function onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    // FR-83: filter A-Z, uppercase, clamp to wordLength
    let s = target.value.toUpperCase().replace(/[^A-Z]/g, '');
    if (s.length > vm.wordLength) s = s.slice(0, vm.wordLength);
    dispatchAnagramInput(s);
  }

  function onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      dispatchCloseAnagramHelper();
    }
  }
</script>

{#if vm.open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
    onclick={onBackdropClick}
  >
    <div class="max-w-2xl w-full rounded-lg bg-white p-6 shadow-xl">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-800">Anagram Helper</h2>
        <button
          type="button"
          class="text-2xl text-gray-500 hover:text-gray-700"
          onclick={() => dispatchCloseAnagramHelper()}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <!-- Tile row (FR-82) -->
      <div class="mb-4 flex flex-wrap items-center gap-1">
        {#each vm.tiles as tile, i}
          {#if i > 0}
            {@const sep = vm.separators[i - 1] ?? 'none'}
            {#if sep === 'space'}
              <div class="w-4"></div>
            {:else if sep === 'hyphen'}
              <div class="px-1 font-bold text-gray-700">-</div>
            {/if}
          {/if}
          <div
            class="flex h-12 w-10 items-center justify-center rounded border text-lg font-bold {tile.fixed
              ? 'bg-gray-200 text-gray-500'
              : 'bg-white text-gray-900 border-gray-400'}"
          >
            {tile.letter ?? ''}
          </div>
        {/each}
      </div>

      <!-- Input (FR-83) -->
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
        class="w-full rounded border border-gray-300 px-3 py-2 text-lg uppercase tracking-widest"
      />
      <div class="mt-1 text-xs text-gray-500">Entered: {vm.inputLength} / {vm.wordLength}</div>

      {#if vm.errorMessage !== null}
        <div class="mt-2 text-xs text-red-600">{vm.errorMessage}</div>
      {/if}

      <!-- Expected unique letter counts (FR-85) -->
      <div class="mt-3 text-xs text-gray-500">
        Expected letters:
        {#each vm.expectedUniqueLetterCounts as c}
          <span class="mx-1 font-mono">{String(c.letter)}×{c.count}</span>
        {/each}
      </div>

      <!-- Actions (FR-86) -->
      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          class="rounded bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!vm.scrambleEnabled}
          onclick={() => dispatchAnagramScramble()}>Scramble</button>
        <button
          type="button"
          class="rounded bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
          onclick={() => dispatchCloseAnagramHelper()}>Close</button>
      </div>
    </div>
  </div>
{/if}
