<script lang="ts">
  import type { PlayerToolbarVM, PlayerCheckResultVM } from '../bindings/viewmodels/playerVM';
  import type { PlayerToolbarActions } from '../bindings/playerFacade';

  let { vm, checkResult, actions }: {
    vm: PlayerToolbarVM;
    checkResult: PlayerCheckResultVM;
    actions: PlayerToolbarActions;
  } = $props();

  const COLOR_CLASS: Record<NonNullable<PlayerCheckResultVM>['classification'], string> = {
    'complete-correct': 'text-success',
    'incomplete-correct': 'text-success',
    'complete-incorrect': 'text-danger',
    'incomplete-incorrect': 'text-danger',
  };

  const buttons = [
    { label: 'Check', variant: 'btn-primary', disabled: () => !vm.canCheck, run: () => actions.check() },
    { label: 'Clear Errors', variant: 'btn-warning', disabled: () => !vm.canClearErrors, run: () => actions.clearErrors() },
    { label: 'Reset', variant: 'btn-danger', disabled: () => !vm.canReset, run: () => actions.requestResetPlayer() },
    { label: 'Import New', variant: 'btn-success', disabled: () => !vm.canImportNew, run: () => actions.importNewPuzzle() },
    { label: 'Anagram Helper', variant: 'btn-tool', disabled: () => !vm.canOpenAnagram, run: () => actions.openAnagramHelper() },
  ];
</script>

<div class="flex flex-col gap-3">
  <div class="flex flex-wrap gap-2">
    {#each buttons as b (b.label)}
      <button type="button"
              class="btn btn-sm {b.variant}"
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

  <div class="sr-only" role="status">{checkResult === null ? '' : checkResult.announcement}</div>
</div>
