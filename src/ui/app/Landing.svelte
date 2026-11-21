<script lang="ts">
  import type { LandingActions } from '../bindings/appStore.svelte';

  let { actions }: { actions: LandingActions } = $props();
</script>

<div class="mx-auto flex max-w-3xl flex-col items-center gap-12 px-4 py-16">
  <h2 class="text-lg text-gray-700">What would you like to do?</h2>
  <div class="flex w-full max-w-md gap-6">
    <button
      type="button"
      class="btn btn-hero btn-primary flex-1"
      onclick={actions.build}>
      Build
    </button>
    <button
      type="button"
      class="btn btn-hero flex-1 bg-green-600 text-white hover:bg-green-700"
      onclick={actions.play}>
      Play
    </button>
  </div>
</div>
