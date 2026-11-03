<script lang="ts" module>
	export interface OpcionMultiSelect<V extends string = string> {
		value: V;
		label: string;
	}
</script>

<script lang="ts" generics="T extends string">
	import { Popover } from 'bits-ui';
	import { ChevronDown, X } from '@lucide/svelte';
	import Checkbox from './Checkbox.svelte';

	interface Props {
		opciones: OpcionMultiSelect<T>[];
		/** Valores elegidos. Vacío = sin filtro. */
		value?: T[];
		/** Nombre del filtro: es lo que muestra el botón mientras no hay nada elegido. */
		etiqueta: string;
		class?: string;
	}

	let { opciones, value = $bindable([]), etiqueta, class: className = '' }: Props = $props();

	const activo = $derived(value.length > 0);
	const texto = $derived(
		value.length === 0
			? etiqueta
			: value.length === 1
				? (opciones.find((o) => o.value === value[0])?.label ?? etiqueta)
				: `${etiqueta} · ${value.length}`
	);

	function alternar(opcion: T, marcada: boolean) {
		value = marcada ? [...value, opcion] : value.filter((v) => v !== opcion);
	}

	function limpiar(event: Event) {
		event.stopPropagation();
		value = [];
	}
</script>

<Popover.Root>
	<Popover.Trigger
		title={activo ? `${etiqueta}: ${texto}` : `Filtrar por ${etiqueta.toLowerCase()}`}
		class="flex h-12 w-fit cursor-pointer items-center gap-2 rounded-xl px-4 font-medium whitespace-nowrap text-stone-800 transition-colors {activo
			? 'bg-yellow-100 hover:bg-yellow-200'
			: 'bg-stone-200 hover:bg-stone-300'} {className}"
	>
		<span>{texto}</span>
		{#if activo}
			<span
				role="button"
				tabindex="0"
				onclick={limpiar}
				onkeydown={(event) => (event.key === 'Enter' || event.key === ' ') && limpiar(event)}
				class="cursor-pointer text-stone-500 hover:text-stone-800"
				aria-label="Quitar filtro {etiqueta.toLowerCase()}"
				title="Quitar filtro"
			>
				<X size={14} />
			</span>
		{:else}
			<ChevronDown size={14} strokeWidth={3} class="text-stone-500" />
		{/if}
	</Popover.Trigger>

	<Popover.Content
		sideOffset={8}
		align="start"
		class="z-20 flex min-w-52 flex-col gap-1 rounded-2xl border-2 border-stone-100 bg-white p-2"
	>
		{#each opciones as opcion (opcion.value)}
			<Checkbox
				class="w-full rounded-xl px-3 py-2.5 hover:bg-stone-100"
				bind:checked={
					() => value.includes(opcion.value), (marcada) => alternar(opcion.value, marcada)
				}
			>
				{opcion.label}
			</Checkbox>
		{/each}
	</Popover.Content>
</Popover.Root>
