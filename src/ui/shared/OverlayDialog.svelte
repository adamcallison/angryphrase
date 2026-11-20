<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    open,
    onClose,
    labelId,
    widthClass,
    initialFocusId,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    labelId: string;
    widthClass: string;
    initialFocusId?: string;
    children: Snippet;
  } = $props();

  let dialogEl: HTMLElement | null = $state(null);
  let returnFocusEl: HTMLElement | null = null;

  const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  function focusablesIn(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }

  function focusInitial(root: HTMLElement): void {
    const named =
      initialFocusId === undefined ? null : document.getElementById(initialFocusId);
    const target =
      (named instanceof HTMLElement ? named : null) ??
      focusablesIn(root)[0] ??
      root;
    target.focus();
  }

  // Escape/Tab listener exists only while open — mounted here because Svelte 5
  // forbids svelte:window inside blocks, and a conditionally-valued handler
  // still leaves a wrapper listener attached.
  $effect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  // Runs after the open branch's DOM is in place; if the dialog element has
  // not bound yet the effect re-runs when it does, deferring focus one pass.
  $effect(() => {
    if (!open) return;
    const root = dialogEl;
    if (root === null) return;
    returnFocusEl =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusInitial(root);
    return () => {
      const el = returnFocusEl;
      returnFocusEl = null;
      if (el !== null && el.isConnected) el.focus();
    };
  });

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const root = dialogEl;
    if (root === null) return;
    const focusables = focusablesIn(root);
    if (focusables.length === 0) {
      event.preventDefault();
      root.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (first === undefined || last === undefined) return;
    const active = document.activeElement;
    const inside = active instanceof Node && root.contains(active);
    if (event.shiftKey && (active === first || !inside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !inside)) {
      event.preventDefault();
      first.focus();
    }
  }

  function onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) onClose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- Escape on the window keydown listener is the key equivalent; the a11y checker cannot see it. -->
  <div
    class="fixed inset-0 z-overlay flex items-center justify-center bg-black/40"
    onclick={onBackdropClick}
  >
    <div
      bind:this={dialogEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      tabindex="-1"
      class="w-full rounded-lg bg-white p-6 shadow-xl {widthClass}"
    >
      {@render children()}
    </div>
  </div>
{/if}
