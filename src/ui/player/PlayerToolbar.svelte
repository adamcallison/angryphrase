<script lang="ts">
  import type { PlayerToolbarVM, PlayerCheckResultVM } from '../bindings/viewmodels/playerVM';
  import type { PlayerToolbarActions } from '../bindings/playerFacade';

  let { vm, checkResult, actions }: {
    vm: PlayerToolbarVM;
    checkResult: PlayerCheckResultVM;
    actions: PlayerToolbarActions;
  } = $props();

  const COLOR_CLASS: Record<NonNullable<PlayerCheckResultVM>['classification'], string> = {
    'complete-correct': 'text-green-600',
    'incomplete-correct': 'text-green-600',
    'complete-incorrect': 'text-red-600',
    'incomplete-incorrect': 'text-red-600',
  };

  const buttons = [
    { label: 'Check', colorPair: 'btn-primary', disabled: () => !vm.canCheck, run: () => actions.check() },
    { label: 'Clear Errors', colorPair: 'bg-amber-600 text-white hover:bg-amber-700', disabled: () => !vm.canClearErrors, run: () => actions.clearErrors() },
    { label: 'Reset', colorPair: 'bg-red-600 text-white hover:bg-red-700', disabled: () => !vm.canReset, run: () => actions.requestResetPlayer() },
    { label: 'Import New', colorPair: 'bg-green-600 text-white hover:bg-green-700', disabled: () => !vm.canImportNew, run: () => actions.importNewPuzzle() },
    { label: 'Anagram Helper', colorPair: 'bg-purple-600 text-white hover:bg-purple-700', disabled: () => !vm.canOpenAnagram, run: () => actions.openAnagramHelper() },
  ];
</script>

<div class="flex flex-col gap-3">
  <div class="flex flex-wrap gap-2">
    {#each buttons as b (b.label)}
      <button type="button"
              class="btn btn-sm {b.colorPair}"
              disabled={b.disabled()}
              onclick={b.run}>{b.label}</button>
    {/each}
  </div>

  {#if checkResult !== null}
    <div class="rounded p-2 text-sm font-semibold {COLOR_CLASS[checkResult.classification]}">
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
