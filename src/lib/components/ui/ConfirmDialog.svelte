<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
	import Dialog from './Dialog.svelte';
	import Button from './Button.svelte';

	interface Props {
		open?: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		confirmando?: boolean;
		onConfirm: () => void;
	}

	let {
		open = $bindable(false),
		title,
		message,
		confirmLabel = 'Eliminar',
		cancelLabel = 'Cancelar',
		confirmando = false,
		onConfirm
	}: Props = $props();
</script>

<Dialog bind:open {title}>
	<div class="-mt-2 flex items-start gap-3">
		<span
			class="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500"
		>
			<TriangleAlert size={18} strokeWidth={2.5} />
		</span>
		<p class="mt-1.5 text-sm text-stone-500">{message}</p>
	</div>
	<div class="grid grid-cols-2 gap-3">
		<Button type="button" variant="secondary" onclick={() => (open = false)}>{cancelLabel}</Button>
		<Button type="button" variant="danger" onclick={onConfirm} disabled={confirmando}>
			{confirmando ? 'Procesando…' : confirmLabel}
		</Button>
	</div>
</Dialog>
