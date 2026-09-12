<script lang="ts">
	import toast from 'svelte-french-toast';
	import { Bookmark, Pencil, X, Package, Plus, Search, Trash2 } from '@lucide/svelte';
	import { Button, Dialog, Input, Breadcrumbs, ConfirmDialog } from '$lib/components/ui';
	import type { PageData } from './$types';
	import type { MarcaConConteo, ProductoDeMarca, ProductoDTO } from '$lib/server/productos';

	let { data }: { data: PageData } = $props();

	let marcas = $state<MarcaConConteo[]>(data.marcas);

	async function cargarMarcas() {
		const res = await fetch('/api/marcas?conConteo=1');
		if (res.ok) marcas = (await res.json()) as MarcaConConteo[];
	}

	// Filtro por nombre de la lista de arriba. Las marcas vienen todas en el load (son
	// pocas), así que se resuelve en memoria sin volver a pegarle a la BD.
	let filtroLista = $state('');

	const marcasVisibles = $derived.by(() => {
		const q = normalizar(filtroLista.trim());
		if (!q) return marcas;
		return marcas.filter((m) => normalizar(m.nombre).includes(q));
	});

	let dialogOpen = $state(false);
	let marcaEditada = $state<MarcaConConteo | null>(null);
	let nombre = $state('');
	let guardando = $state(false);

	// Productos de la marca abierta. Ni quitar ni agregar pegan contra la API al instante:
	// se acumulan acá y recién se aplican al guardar, así "Cancelar" de verdad cancela todo
	// lo que se tocó en el diálogo.
	let productos = $state<ProductoDeMarca[]>([]);
	let cargandoProductos = $state(false);
	let quitados = $state<string[]>([]);
	let agregados = $state<ProductoDeMarca[]>([]);

	// Filtro local sobre lo que ya está en memoria — no vuelve a pegarle a la BD.
	let filtro = $state('');

	const listaCompleta = $derived([...agregados, ...productos]);

	function normalizar(texto: string) {
		return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
	}

	const listaVisible = $derived.by(() => {
		const q = normalizar(filtro.trim());
		if (!q) return listaCompleta;
		return listaCompleta.filter(
			(p) => normalizar(p.nombre).includes(q) || normalizar(p.categoria ?? '').includes(q)
		);
	});

	const totalEnMarca = $derived(listaCompleta.filter((p) => !quitados.includes(p.id)).length);

	function reiniciarDialog() {
		productos = [];
		quitados = [];
		agregados = [];
		filtro = '';
		busquedaCatalogo = '';
		resultadosCatalogo = [];
		buscadorAbierto = false;
	}

	function abrirNueva() {
		marcaEditada = null;
		nombre = '';
		reiniciarDialog();
		dialogOpen = true;
	}

	async function abrirEditar(marca: MarcaConConteo) {
		marcaEditada = marca;
		nombre = marca.nombre;
		reiniciarDialog();
		dialogOpen = true;

		cargandoProductos = true;
		try {
			const res = await fetch(`/api/marcas/${marca.id}/productos`);
			if (!res.ok) throw new Error('request failed');
			productos = (await res.json()) as ProductoDeMarca[];
		} catch {
			toast.error('No se pudieron cargar los productos de la marca');
		} finally {
			cargandoProductos = false;
		}
	}

	function quitarProducto(id: string) {
		// Uno recién agregado se descarta del todo; uno que ya estaba se marca para quitar.
		if (agregados.some((p) => p.id === id)) {
			agregados = agregados.filter((p) => p.id !== id);
			return;
		}
		if (!quitados.includes(id)) quitados = [...quitados, id];
	}

	function deshacerQuitar(id: string) {
		quitados = quitados.filter((productoId) => productoId !== id);
	}

	// --- Buscador de catálogo (este sí pega contra la API, igual que en Categorías) ---
	let buscadorAbierto = $state(false);
	let busquedaCatalogo = $state('');
	let resultadosCatalogo = $state<ProductoDTO[]>([]);
	let buscandoCatalogo = $state(false);
	let debounceCatalogo: ReturnType<typeof setTimeout> | undefined;

	// Lo que ya está en la marca (o marcado para agregar) no vuelve a ofrecerse.
	const sugerencias = $derived(
		resultadosCatalogo.filter(
			(p) => !agregados.some((a) => a.id === p.id) && !productos.some((x) => x.id === p.id)
		)
	);

	async function buscarEnCatalogo() {
		const q = busquedaCatalogo.trim();
		if (!q) {
			resultadosCatalogo = [];
			return;
		}
		buscandoCatalogo = true;
		try {
			const params = new URLSearchParams({ page: '1', pageSize: '12', search: q });
			const res = await fetch(`/api/productos?${params}`);
			if (!res.ok) throw new Error('request failed');
			const { productos: encontrados } = (await res.json()) as { productos: ProductoDTO[] };
			resultadosCatalogo = encontrados;
		} catch {
			toast.error('No se pudo buscar productos');
		} finally {
			buscandoCatalogo = false;
		}
	}

	function onBusquedaCatalogoInput() {
		clearTimeout(debounceCatalogo);
		debounceCatalogo = setTimeout(buscarEnCatalogo, 250);
	}

	function agregarDelCatalogo(producto: ProductoDTO) {
		agregados = [
			{
				id: producto.id,
				nombre: producto.nombre,
				categoria: producto.categoria,
				cantidad: producto.cantidad
			},
			...agregados
		];
		quitados = quitados.filter((id) => id !== producto.id);
		busquedaCatalogo = '';
		resultadosCatalogo = [];
	}

	async function handleGuardar(event: SubmitEvent) {
		event.preventDefault();
		const nombreLimpio = nombre.trim();
		if (!nombreLimpio) {
			toast.error('Ponle un nombre a la marca');
			return;
		}

		guardando = true;
		try {
			// Al crear hacen falta dos pasos: primero existe la marca, después se le mueven los
			// productos elegidos (el POST compartido con el alta de producto solo recibe el
			// nombre).
			let marcaId = marcaEditada?.id;
			if (!marcaId) {
				const res = await fetch('/api/marcas', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ nombre: nombreLimpio })
				});
				if (!res.ok) {
					const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
					toast.error(cuerpo?.message ?? 'No se pudo crear la marca');
					return;
				}
				marcaId = ((await res.json()) as { id: string }).id;
			}

			const hayCambios = marcaEditada !== null || agregados.length > 0 || quitados.length > 0;
			if (hayCambios) {
				const res = await fetch(`/api/marcas/${marcaId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						nombre: nombreLimpio,
						productosQuitados: quitados,
						productosAgregados: agregados.map((p) => p.id)
					})
				});
				if (!res.ok) {
					const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
					toast.error(cuerpo?.message ?? 'No se pudo guardar la marca');
					return;
				}
			}

			toast.success(marcaEditada ? 'Marca actualizada' : 'Marca creada');
			dialogOpen = false;
			await cargarMarcas();
		} catch {
			toast.error('No se pudo guardar la marca');
		} finally {
			guardando = false;
		}
	}

	let confirmEliminarOpen = $state(false);
	let marcaAEliminar = $state<MarcaConConteo | null>(null);
	let eliminando = $state(false);

	function pedirEliminar(marca: MarcaConConteo) {
		marcaAEliminar = marca;
		confirmEliminarOpen = true;
	}

	const mensajeEliminar = $derived.by(() => {
		const marca = marcaAEliminar;
		if (!marca) return '';
		const partes = [`¿Eliminar la marca "${marca.nombre}"?`];

		if (marca.productos > 0) {
			partes.push(
				marca.productos === 1
					? 'Su producto no se borra: queda sin marca.'
					: `Sus ${marca.productos} productos no se borran: quedan sin marca.`
			);
		}

		return partes.join(' ');
	});

	async function confirmarEliminar() {
		if (!marcaAEliminar) return;
		eliminando = true;
		try {
			const res = await fetch(`/api/marcas/${marcaAEliminar.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('request failed');
			toast.success('Marca eliminada');
			confirmEliminarOpen = false;
			await cargarMarcas();
		} catch {
			toast.error('No se pudo eliminar la marca');
		} finally {
			eliminando = false;
		}
	}
</script>

<svelte:head>
	<title>Marcas · La Central</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<Breadcrumbs
		items={[
			{ label: 'Dashboard', href: '/dashboard' },
			{ label: 'Inventario', href: '/dashboard/productos' },
			{ label: 'Marcas' }
		]}
	/>

	<header
		class="flex flex-col gap-4 @min-[768px]:flex-row @min-[768px]:items-start @min-[768px]:justify-between"
	>
		<div class="@min-[768px]:max-w-xl">
			<h1 class="title">Marcas</h1>
			<p class="mt-1 text-sm text-stone-400">
				Renombra una marca, agrégale o sácale productos. Quitar un producto no lo elimina del
				inventario: solo lo deja sin marca.
			</p>
		</div>
		<button
			type="button"
			onclick={abrirNueva}
			class="h-12 cursor-pointer rounded-xl bg-success px-6 text-sm font-extrabold whitespace-nowrap text-white transition-colors hover:bg-success-dark @min-[768px]:shrink-0"
		>
			Nueva Marca
		</button>
	</header>

	{#if marcas.length === 0}
		<p class="rounded-2xl bg-white p-10 text-center text-sm text-stone-400">
			Todavía no hay marcas. Crea la primera con el botón de arriba.
		</p>
	{:else}
		<Input bind:value={filtroLista} placeholder="Filtrar por nombre…" class="@min-[640px]:max-w-sm">
			{#snippet icon()}
				<Search size={16} />
			{/snippet}
			{#snippet trailing()}
				{#if filtroLista}
					<button
						type="button"
						onclick={() => (filtroLista = '')}
						class="cursor-pointer text-stone-400 transition-colors hover:text-stone-600"
						aria-label="Limpiar filtro"
					>
						<X size={16} />
					</button>
				{/if}
			{/snippet}
		</Input>

		{#if marcasVisibles.length === 0}
			<p class="rounded-2xl bg-white p-10 text-center text-sm text-stone-400">
				Ninguna marca coincide con "{filtroLista}"
			</p>
		{:else}
			<div class="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-3">
				{#each marcasVisibles as marca (marca.id)}
					<div
						class="flex items-center gap-2 rounded-2xl border-2 border-stone-100 bg-white p-5 transition-colors focus-within:border-primary hover:border-primary"
					>
						<button
							type="button"
							onclick={() => abrirEditar(marca)}
							class="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
						>
							<span
								class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600"
							>
								<Bookmark size={16} strokeWidth={2.5} />
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate font-extrabold text-stone-800">{marca.nombre}</span>
								<span class="block text-xs leading-3.75 text-stone-400">
									{marca.productos}
									{marca.productos === 1 ? 'producto' : 'productos'}
								</span>
							</span>
							<span
								class="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-stone-400 transition-colors group-hover:bg-stone-100 group-hover:text-stone-700"
							>
								<Pencil size={16} />
							</span>
						</button>
						<button
							type="button"
							onclick={() => pedirEliminar(marca)}
							class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-red-50 hover:text-error"
							aria-label="Eliminar {marca.nombre}"
						>
							<Trash2 size={16} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</main>

<Dialog
	bind:open={dialogOpen}
	title={marcaEditada ? 'Editar marca' : 'Nueva marca'}
	class="max-w-lg"
>
	<form onsubmit={handleGuardar} class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label for="marca-nombre" class="text-sm font-bold text-stone-800">Nombre</label>
			<Input id="marca-nombre" bind:value={nombre} placeholder="Ej. Gloria" />
		</div>

		<div class="flex flex-col gap-2">
			<div class="flex items-center justify-between gap-2">
				<span class="text-sm font-bold text-stone-800">
					Productos
					{#if !cargandoProductos}
						<span class="font-medium text-stone-400">({totalEnMarca})</span>
					{/if}
				</span>
				<button
					type="button"
					onclick={() => (buscadorAbierto = !buscadorAbierto)}
					class="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-stone-200 px-3 py-2 text-xs leading-3.75 font-bold whitespace-nowrap text-stone-700 transition-colors hover:bg-stone-300"
				>
					<Plus size={14} strokeWidth={3} />
					Añadir productos
				</button>
			</div>

			{#if buscadorAbierto}
				<div class="relative">
					<Input
						bind:value={busquedaCatalogo}
						oninput={onBusquedaCatalogoInput}
						placeholder="Buscar en todo el inventario…"
					>
						{#snippet icon()}
							<Search size={16} />
						{/snippet}
					</Input>
					{#if busquedaCatalogo.trim()}
						<div
							class="absolute top-full right-0 left-0 z-20 mt-1 max-h-48 overflow-auto rounded-xl bg-white p-1 ring-2 ring-stone-200"
						>
							{#if buscandoCatalogo && sugerencias.length === 0}
								<p class="px-3 py-2 text-sm text-stone-400">Buscando…</p>
							{:else if sugerencias.length === 0}
								<p class="px-3 py-2 text-sm text-stone-400">No hay productos para agregar</p>
							{/if}
							{#each sugerencias as producto (producto.id)}
								<button
									type="button"
									onclick={() => agregarDelCatalogo(producto)}
									class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-100"
								>
									<Package size={14} class="shrink-0 text-stone-400" />
									<span class="min-w-0 flex-1 truncate">{producto.nombre}</span>
									{#if producto.marca}
										<span class="shrink-0 text-xs leading-3.75 text-stone-400">
											mover desde {producto.marca}
										</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#if cargandoProductos}
				<p class="rounded-xl bg-stone-100 p-4 text-center text-xs leading-4 text-stone-400">
					Cargando productos…
				</p>
			{:else if listaCompleta.length === 0}
				<p class="rounded-xl bg-stone-100 p-4 text-center text-xs leading-4 text-stone-400">
					Esta marca todavía no tiene productos. Agrégalos con "Añadir productos".
				</p>
			{:else}
				{#if listaCompleta.length > 5}
					<Input bind:value={filtro} placeholder="Filtrar esta lista…">
						{#snippet icon()}
							<Search size={16} />
						{/snippet}
						{#snippet trailing()}
							{#if filtro}
								<button
									type="button"
									onclick={() => (filtro = '')}
									class="cursor-pointer text-stone-400 transition-colors hover:text-stone-600"
									aria-label="Limpiar filtro"
								>
									<X size={16} />
								</button>
							{/if}
						{/snippet}
					</Input>
				{/if}

				{#if listaVisible.length === 0}
					<p class="rounded-xl bg-stone-100 p-4 text-center text-xs leading-4 text-stone-400">
						Ningún producto coincide con "{filtro}"
					</p>
				{:else}
					<ul class="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
						{#each listaVisible as producto (producto.id)}
							{@const quitado = quitados.includes(producto.id)}
							{@const nuevo = agregados.some((p) => p.id === producto.id)}
							<li
								class="flex items-center gap-2 rounded-xl px-3 py-2.5 {quitado
									? 'bg-red-50'
									: 'bg-stone-100'}"
							>
								<Package size={16} class="shrink-0 text-stone-400" />
								<div class="min-w-0 flex-1">
									<p
										class="flex items-center gap-1.5 truncate text-sm font-bold text-stone-700 {quitado
											? 'text-stone-400 line-through'
											: ''}"
									>
										<span class="truncate">{producto.nombre}</span>
										{#if nuevo}
											<span
												class="shrink-0 rounded-full bg-badge-green-bg px-2 py-0.5 text-[10px] leading-3 font-bold text-badge-green-fg"
											>
												Nuevo
											</span>
										{/if}
									</p>
									<p class="truncate text-xs leading-3.75 text-stone-400">
										{producto.categoria ?? 'Sin categoría'} · {producto.cantidad} en stock
									</p>
								</div>
								{#if quitado}
									<button
										type="button"
										onclick={() => deshacerQuitar(producto.id)}
										class="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-xs leading-3.75 font-bold text-stone-500 transition-colors hover:bg-stone-200"
									>
										Deshacer
									</button>
								{:else}
									<button
										type="button"
										onclick={() => quitarProducto(producto.id)}
										class="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-red-100 hover:text-error"
										aria-label="Quitar {producto.nombre} de la marca"
									>
										<X size={16} strokeWidth={2.5} />
									</button>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}

				{#if quitados.length > 0}
					<p class="text-xs leading-4 text-stone-400">
						{quitados.length}
						{quitados.length === 1 ? 'producto quedará' : 'productos quedarán'} sin marca al guardar.
					</p>
				{/if}
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-3">
			<Button type="button" variant="danger" onclick={() => (dialogOpen = false)}>Cancelar</Button>
			<Button type="submit" variant="success" disabled={guardando}>
				{guardando ? 'Guardando…' : marcaEditada ? 'Guardar' : 'Crear'}
			</Button>
		</div>
	</form>
</Dialog>

<ConfirmDialog
	bind:open={confirmEliminarOpen}
	title="Eliminar marca"
	message={mensajeEliminar}
	confirmando={eliminando}
	onConfirm={confirmarEliminar}
/>
