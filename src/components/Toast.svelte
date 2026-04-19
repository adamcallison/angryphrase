<script lang="ts">
  let {
    message,
    visible,
  }: {
    message: string;
    visible: boolean;
  } = $props();
</script>

{#if visible}
  <div
    class="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white
      px-5 py-2.5 rounded-lg shadow-lg text-sm z-50 whitespace-nowrap"
  >
    {message}
  </div>
{/if}