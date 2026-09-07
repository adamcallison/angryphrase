<script lang="ts">
  import type { LandingActions } from '../bindings/appStore.svelte';

  let { actions }: { actions: LandingActions } = $props();
</script>

<main class="mx-auto flex max-w-3xl flex-col items-center gap-12 px-4 py-16">
  <p class="text-lg text-gray-700">What would you like to do?</p>
  <div class="flex w-full max-w-md gap-6">
    <button
      type="button"
      class="flex-1 rounded-md bg-blue-600 px-6 py-12 text-white text-xl font-bold hover:bg-blue-700"
      onclick={actions.build}>
      Build
    </button>
    <button
      type="button"
      class="flex-1 rounded-md bg-green-600 px-6 py-12 text-white text-xl font-bold hover:bg-green-700"
      onclick={actions.play}>
      Play
    </button>
  </div>
</main>
