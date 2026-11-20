<script lang="ts">
  import type { ModalVM, ModalActions } from '../bindings/modalFacade';
  import OverlayDialog from './OverlayDialog.svelte';

  let {
    vm,
    actions,
  }: {
    vm: ModalVM;
    actions: ModalActions;
  } = $props();

  function onConfirmClick(): void {
    actions.confirm();
  }

  function onCancelClick(): void {
    actions.cancel();
  }
</script>

<OverlayDialog open={vm !== null} labelId="modal-title" widthClass="max-w-md" onClose={actions.cancel}>
  {#if vm !== null}
    <h2 id="modal-title" class="mb-3 text-xl font-bold text-gray-800">{vm.title}</h2>
    <p class="mb-6 text-gray-600">{vm.body}</p>
    <div class="flex justify-end gap-3">
      <button
        type="button"
        class="btn btn-md btn-outline"
        onclick={onCancelClick}>
        {vm.cancelLabel}
      </button>
      <button
        type="button"
        class="btn btn-md btn-primary"
        onclick={onConfirmClick}>
        {vm.confirmLabel}
      </button>
    </div>
  {/if}
</OverlayDialog>
