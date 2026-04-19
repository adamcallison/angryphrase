<script lang="ts">
  import Landing from './pages/Landing.svelte';
  import BuilderPage from './pages/BuilderPage.svelte';
  import PlayerPage from './pages/PlayerPage.svelte';

  let currentView = $state<'landing' | 'builder' | 'player'>('landing');
</script>

{#if currentView === 'landing'}
  <Landing
    onBuild={() => (currentView = 'builder')}
    onPlay={() => (currentView = 'player')}
  />
{:else if currentView === 'builder'}
  <BuilderPage />
{:else}
  <PlayerPage />
{/if}