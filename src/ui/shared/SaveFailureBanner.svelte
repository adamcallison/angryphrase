<script lang="ts">
  import type { SaveBannerVM } from '../bindings/viewmodels/saveBannerVM';

  let { vm }: { vm: SaveBannerVM | null } = $props();
</script>

<!-- Always-mounted speech mirror: a region that persists and changes content
     announces more reliably than one mounting fresh, so this stays mounted
     (empty when healthy) rather than appearing with the banner.
     role="status" implies aria-live="polite" — never spelled, repo convention. -->
<div class="sr-only" role="status">{vm?.message ?? ''}</div>
{#if vm !== null}
  <div class="rounded-md border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-soft-text">{vm.message}</div>
{/if}
