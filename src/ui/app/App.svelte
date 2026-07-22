<script lang="ts">
  import Header from './Header.svelte';
  import Landing from './Landing.svelte';
  import BuilderShell from '../builder/BuilderShell.svelte';
  import PlayerShell from '../player/PlayerShell.svelte';
  import ToastHost from '../shared/ToastHost.svelte';
  import Modal from '../shared/Modal.svelte';
  import { getRoute, getBuilder, getPlayer, getScheduler } from '../bindings/appStore.svelte';

  const route = $derived(getRoute());

  // Autosave: observe builder / player state and schedule debounced persistence.
  // Reading inside $effect registers the reactive subscription; scheduler.takeState
  // coalesces multiple rapid changes into one save (400ms default).
  $effect(() => {
    const builder = getBuilder();
    const player = getPlayer();
    getScheduler().scheduleBuilderSave(builder);
    getScheduler().schedulePlayerSave(player);
  });
</script>

<div class="flex min-h-screen flex-col">
  <Header />
  <main class="flex-1">
    {#if route === 'landing'}
      <Landing />
    {:else if route === 'build'}
      <BuilderShell />
    {:else if route === 'play'}
      <PlayerShell />
    {/if}
  </main>
  <ToastHost />
  <Modal />
</div>
