<script lang="ts">
  import FilePicker from '../shared/FilePicker.svelte';
  import type { PlayerImportScreenActions } from '../bindings/playerFacade';

  let {
    importError,
    pick,
    actions,
  }: {
    importError: string | null;
    pick: () => Promise<string | null>;
    actions: PlayerImportScreenActions;
  } = $props();

  function onPick(text: string): void {
    actions.importPuzzle(text);
  }

  // URL draft is component-local (§7 Drafts): composing text, dies on unmount,
  // and on failure the field keeps the user's URL for editing. The value is
  // dispatched exactly as typed — the port owns validation, the reducer owns
  // rejection. Pending is a display fact only; state records no "loading" flag.
  let urlDraft = $state('');
  let urlPending = $state(false);

  async function onUrlSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (urlDraft.trim() === '') return;
    urlPending = true;
    try {
      await actions.importFromUrl(urlDraft);
    } finally {
      urlPending = false;
    }
  }
</script>

<div class="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-16">
  <h2 class="text-xl font-bold text-gray-800">Import a puzzle to start solving</h2>
  <p class="text-sm text-gray-600 text-center">Select a <strong>complete</strong> puzzle JSON file exported from the Builder, or drag one in.</p>
  <FilePicker label="Pick a puzzle JSON file" pick={pick} onpick={onPick} ondropfile={(file) => actions.importDroppedFile(file)} />
  <form onsubmit={onUrlSubmit} class="flex flex-col items-center gap-2">
    <label for="puzzle-url" class="text-sm text-gray-700">…or paste a puzzle URL</label>
    <div class="flex items-center gap-2">
      <input
        id="puzzle-url"
        type="text"
        placeholder="https://example.com/puzzle.json"
        value={urlDraft}
        oninput={(e) => {
          urlDraft = e.currentTarget.value;
        }}
        disabled={urlPending}
        class="w-72 rounded border border-gray-300 px-2 py-1 text-sm focus-ring"
      />
      <button type="submit" disabled={urlPending} class="btn btn-md btn-secondary">
        {urlPending ? 'Loading…' : 'Load from URL'}
      </button>
    </div>
  </form>
  {#if importError !== null}
    <div role="alert" class="rounded border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-soft-text">
      {importError}
    </div>
  {/if}
</div>
