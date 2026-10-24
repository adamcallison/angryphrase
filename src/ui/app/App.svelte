<script lang="ts">
  import Header from './Header.svelte';
  import Landing from './Landing.svelte';
  import BuilderShell from '../builder/BuilderShell.svelte';
  import PlayerShell from '../player/PlayerShell.svelte';
  import ToastHost from '../shared/ToastHost.svelte';
  import Modal from '../shared/Modal.svelte';
  import VersionStamp from '../shared/VersionStamp.svelte';
  import type { AppStore, LandingActions } from '../bindings/appStore.svelte';
  import { createBuilderFacade } from '../bindings/builderFacade';
  import { createPlayerFacade } from '../bindings/playerFacade';
  import { createModalFacade } from '../bindings/modalFacade';
  import { createToastFacade } from '../bindings/toastFacade';

  let { appStore }: { appStore: AppStore } = $props();

  // svelte-ignore state_referenced_locally
  const builderFacade = createBuilderFacade(appStore);
  // svelte-ignore state_referenced_locally
  const playerFacade = createPlayerFacade(appStore);
  // svelte-ignore state_referenced_locally
  const modalFacade = createModalFacade(appStore);
  // svelte-ignore state_referenced_locally
  const toastFacade = createToastFacade(appStore);

  const landingActions: LandingActions = {
    build: () => appStore.dispatch({ kind: 'navigate', route: 'build' }),
    play: () => appStore.dispatch({ kind: 'navigate', route: 'play' }),
  };

  const route = $derived(appStore.getRoute());
  const modalVm = $derived(modalFacade.modalVM());
  const toastVms = $derived(toastFacade.toastVMs());
</script>

<div class="flex min-h-screen flex-col">
  <Header />
  <main class="flex-1">
    {#if route === 'landing'}
      <Landing actions={landingActions} />
    {:else if route === 'build'}
      <BuilderShell builderFacade={builderFacade} />
    {:else if route === 'play'}
      <PlayerShell playerFacade={playerFacade} />
    {/if}
  </main>
  <ToastHost vms={toastVms} actions={toastFacade.actions} />
  <Modal vm={modalVm} actions={modalFacade.actions} />
  <VersionStamp />
</div>
