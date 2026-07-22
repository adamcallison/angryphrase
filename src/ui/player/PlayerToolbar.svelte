<script lang="ts">
  import type { PlayerToolbarVM, PlayerShellVM } from '../bindings/viewmodels/playerVM';
  import {
    dispatchCheck, dispatchClearErrors, dispatchRequestResetPlayer,
    dispatchImportNewPuzzle, dispatchOpenAnagramHelper,
  } from '../bindings/playerStore.svelte';

  let { vm, checkResult }: {
    vm: PlayerToolbarVM;
    checkResult: PlayerShellVM['checkResult'];
  } = $props();
</script>

<div class="flex flex-col gap-3">
  <div class="flex flex-wrap gap-2">
    <button type="button"
            class="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!vm.canCheck}
            onclick={() => dispatchCheck()}>Check</button>

    <button type="button"
            class="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!vm.canClearErrors}
            onclick={() => dispatchClearErrors()}>Clear Errors</button>

    <button type="button"
            class="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!vm.canReset}
            onclick={() => dispatchRequestResetPlayer()}>Reset</button>

    <button type="button"
            class="rounded bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!vm.canImportNew}
            onclick={() => dispatchImportNewPuzzle()}>Import New</button>

    <button type="button"
            class="rounded bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!vm.canOpenAnagram}
            onclick={() => dispatchOpenAnagramHelper()}>Anagram Helper</button>
  </div>

  {#if checkResult !== null}
    <div class="rounded p-2 text-sm font-semibold {checkResult.colorClass}">
      {checkResult.message}
      {#if checkResult.incorrectCount > 0}
        <span class="font-normal text-gray-600"> ({checkResult.incorrectCount} incorrect)</span>
      {/if}
      {#if checkResult.emptyCount > 0}
        <span class="font-normal text-gray-600"> ({checkResult.emptyCount} empty)</span>
      {/if}
    </div>
  {/if}
</div>
