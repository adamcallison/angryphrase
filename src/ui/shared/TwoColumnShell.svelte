<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    header,
    left,
    right,
  }: {
    header: Snippet;
    left: Snippet;
    right: Snippet;
  } = $props();
</script>

<div class="mx-auto max-w-7xl px-4 py-4 flex flex-col gap-4">
  {@render header()}

  <div class="flex flex-col md:flex-row gap-6">
    <!-- left column: grid -->
    <section class="flex flex-col gap-4 min-w-0 md:flex-[3]">
      {@render left()}
    </section>

    <!-- right column: clue panel (caps its own width at max-w-md) -->
    <section class="md:flex-[2] md:max-w-md">
      {@render right()}
    </section>
  </div>
</div>
