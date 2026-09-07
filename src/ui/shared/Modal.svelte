<script lang="ts">
  import type { ModalVM, ModalActions } from '../bindings/modalFacade';
  import type { ConfirmableIntent } from '../../domain/notifications/Event';

  let {
    vm,
    confirmIntent,
    actions,
  }: {
    vm: ModalVM;
    confirmIntent: ConfirmableIntent | null;
    actions: ModalActions;
  } = $props();

  function handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      actions.cancel();
    }
  }

  function onConfirmClick(): void {
    if (confirmIntent !== null) {
      actions.confirm();
    }
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
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={onBackdropClick}>
    <div class="max-w-md rounded-lg bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title" class="mb-3 text-xl font-bold text-gray-800">{vm.title}</h2>
      <p class="mb-6 text-gray-600">{vm.body}</p>
      <div class="flex justify-end gap-3">
        <button
          type="button"
          class="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100"
          onclick={onCancelClick}>
          {vm.cancelLabel}
        </button>
        <button
          type="button"
          class="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          onclick={onConfirmClick}>
          {vm.confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
