<script lang="ts">
  import Header from './Header.svelte';
  import Landing from './Landing.svelte';
  import BuilderShell from '../builder/BuilderShell.svelte';
  import PlayerShell from '../player/PlayerShell.svelte';
  import ToastHost from '../shared/ToastHost.svelte';
  import Modal from '../shared/Modal.svelte';
  import { getRoute, getBuilder, getPlayer, getScheduler } from '../bindings/appStore.svelte';

  const route = $derived(getRoute());

  // Autosave: observe each state slice independently and schedule debounced persistence.
  // Reading inside each $effect registers that slice's reactive subscription; the
  // scheduler coalesces multiple rapid changes into one save (400ms default).
  // Split per-slice so a builder keystroke does not re-arm the player timer, and vice versa.
  // Relies on reducers preserving sibling substate refs (spreads copy the other ref unchanged).
  $effect(() => {
    getScheduler().scheduleBuilderSave(getBuilder());
  });
  $effect(() => {
    getScheduler().schedulePlayerSave(getPlayer());
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
