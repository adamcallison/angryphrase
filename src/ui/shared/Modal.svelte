<script lang="ts">
  import type { ModalVM, ModalActions } from '../bindings/modalFacade';

  let {
    vm,
    actions,
  }: {
    vm: ModalVM;
    actions: ModalActions;
  } = $props();

  function handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      actions.cancel();
    }
  }

  function onConfirmClick(): void {
    actions.confirm();
  }

  function onCancelClick(): void {
    actions.cancel();
  }

  function onBackdropClick(event: MouseEvent): void {
    // Click outside the modal content but inside the backdrop cancels.
    if (event.target === event.currentTarget) {
      actions.cancel();
    }
  }
</script>

<svelte:window onkeydown={handleKey} />

{#if vm !== null}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-overlay flex items-center justify-center bg-black/40" onclick={onBackdropClick}>
    <div class="max-w-md rounded-lg bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="modal-title">
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
    </div>
  </div>
{/if}
