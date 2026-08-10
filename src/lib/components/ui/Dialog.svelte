<script lang="ts">
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		title: string;
		children: Snippet;
	}

	let { open = $bindable(false), title, children }: Props = $props();
	let dialogEl: HTMLDialogElement | undefined = $state();
	const titleId = $props.id();

	// Keep the native <dialog> open state in sync with the bindable prop.
	// https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal
	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) {
			dialogEl.showModal();
		} else if (!open && dialogEl.open) {
			dialogEl.close();
		}
	});

	// Fires on Escape, form[method=dialog] submit, or dialog.close() — keeps `open` truthful either way.
	function handleClose() {
		open = false;
	}

	// MDN's documented pattern for "light dismiss": a click that lands on the
	// <dialog> element itself (not its content) originated on the backdrop.
	function handleBackdropClick(event: MouseEvent) {
		if (event.target === dialogEl) {
			dialogEl?.close();
		}
	}
</script>

<dialog
	bind:this={dialogEl}
	onclose={handleClose}
	onclick={handleBackdropClick}
	aria-labelledby={titleId}
	class="m-auto w-full max-w-sm rounded-3xl bg-stone-50 p-0 [&::backdrop]:bg-stone-950/60 [&::backdrop]:backdrop-blur-sm"
>
	<div class="flex flex-col gap-6 p-6">
		<div class="flex items-center justify-between">
			<h2 id={titleId} class="text-xl font-extrabold text-stone-800">{title}</h2>
			<button
				type="button"
				onclick={() => dialogEl?.close()}
				class="cursor-pointer text-stone-400 transition-colors hover:text-stone-700"
				aria-label="Cerrar"
			>
				<X size={20} strokeWidth={2.5} />
			</button>
		</div>
		{@render children()}
	</div>
</dialog>
