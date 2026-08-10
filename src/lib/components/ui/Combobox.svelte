<script lang="ts">
	import { Check, Plus, ChevronDown, X } from '@lucide/svelte';

	interface Props {
		value?: string;
		items: string[];
		placeholder?: string;
		id?: string;
		class?: string;
		oncreate?: (value: string) => void;
	}

	let {
		value = $bindable(''),
		items,
		placeholder = 'Buscar…',
		id,
		class: className = '',
		oncreate
	}: Props = $props();

	let open = $state(false);
	let query = $state(value);
	let rootEl: HTMLDivElement | undefined = $state();
	let inputEl: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (!open) query = value;
	});

	const filtered = $derived(
		items.filter((item) => item.toLowerCase().includes(query.trim().toLowerCase()))
	);
	const exactMatch = $derived(
		items.some((item) => item.toLowerCase() === query.trim().toLowerCase())
	);

	function abrir() {
		open = true;
	}

	function cerrar() {
		open = false;
	}

	function elegir(item: string) {
		value = item;
		query = item;
		cerrar();
	}

	function crear() {
		const nombre = query.trim();
		if (!nombre) return;
		value = nombre;
		query = nombre;
		oncreate?.(nombre);
		cerrar();
	}

	function limpiar(event: MouseEvent) {
		event.stopPropagation();
		value = '';
		query = '';
		inputEl?.focus();
		open = true;
	}

	function handleWindowClick(event: MouseEvent) {
		if (!open) return;
		if (rootEl && !rootEl.contains(event.target as Node)) cerrar();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			cerrar();
			inputEl?.blur();
		} else if (event.key === 'Tab') {
			cerrar();
		}
	}
</script>

<svelte:window onclick={handleWindowClick} />

<div bind:this={rootEl} class="relative">
	<div
		onclick={() => inputEl?.focus()}
		onkeydown={() => {}}
		role="presentation"
		class="flex cursor-text items-center gap-2 rounded-xl bg-stone-200 px-4 py-3.5 transition-colors focus-within:bg-stone-100 focus-within:ring-3 focus-within:ring-yellow-400 {className}"
	>
		<input
			{id}
			bind:this={inputEl}
			bind:value={query}
			oninput={abrir}
			onfocus={abrir}
			onkeydown={handleKeydown}
			{placeholder}
			autocomplete="off"
			class="w-full flex-1 bg-transparent font-medium text-stone-800 placeholder-stone-400 outline-none"
		/>
		{#if value}
			<button
				type="button"
				onclick={limpiar}
				class="shrink-0 cursor-pointer text-stone-400 transition-colors hover:text-stone-600"
				aria-label="Limpiar selección"
			>
				<X size={14} />
			</button>
		{/if}
		<ChevronDown size={16} class="pointer-events-none shrink-0 text-stone-400" />
	</div>

	{#if open}
		<div
			class="absolute top-full right-0 left-0 z-20 mt-1 max-h-56 overflow-auto rounded-xl bg-white p-1 shadow-xl"
		>
			{#each filtered as item (item)}
				<button
					type="button"
					onclick={() => elegir(item)}
					class="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-100 {item ===
					value
						? 'font-bold text-stone-900'
						: 'text-stone-700'}"
				>
					{item}
					{#if item === value}
						<Check size={14} />
					{/if}
				</button>
			{/each}
			{#if query.trim() && !exactMatch}
				<button
					type="button"
					onclick={crear}
					class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-yellow-600 hover:bg-yellow-50"
				>
					<Plus size={14} />
					Crear "{query.trim()}"
				</button>
			{/if}
			{#if filtered.length === 0 && !query.trim()}
				<p class="px-3 py-2 text-sm text-stone-400">Escribe para buscar o crear uno nuevo</p>
			{/if}
		</div>
	{/if}
</div>
