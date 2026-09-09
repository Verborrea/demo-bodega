<script lang="ts">
	import { invalidate } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import { Layers, Pencil, X, Package, Plus, Search, Trash2 } from '@lucide/svelte';
	import { Button, Dialog, Input, Breadcrumbs, ConfirmDialog } from '$lib/components/ui';
	import type { PageData } from './$types';
	import type { CategoriaConConteo, ProductoDeCategoria, ProductoDTO } from '$lib/server/productos';

	let { data }: { data: PageData } = $props();

	let categorias = $state<CategoriaConConteo[]>(data.categorias);

	async function cargarCategorias() {
		const res = await fetch('/api/categorias?conConteo=1');
		if (res.ok) categorias = (await res.json()) as CategoriaConConteo[];
	}

	let dialogOpen = $state(false);
	let categoriaEditada = $state<CategoriaConConteo | null>(null);
	let nombre = $state('');
	let guardando = $state(false);

	// Productos de la categoría abierta. Ni quitar ni agregar pegan contra la API al
	// instante: se acumulan acá y recién se aplican al guardar, así "Cancelar" de verdad
	// cancela todo lo que se tocó en el diálogo.
	let productos = $state<ProductoDeCategoria[]>([]);
	let cargandoProductos = $state(false);
	let quitados = $state<string[]>([]);
	let agregados = $state<ProductoDeCategoria[]>([]);

	// Filtro local sobre lo que ya está en memoria — no vuelve a pegarle a la BD.
	let filtro = $state('');

	const listaCompleta = $derived([...agregados, ...productos]);

	function normalizar(texto: string) {
		return texto
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
	}

	const listaVisible = $derived.by(() => {
		const q = normalizar(filtro.trim());
		if (!q) return listaCompleta;
		return listaCompleta.filter(
			(p) => normalizar(p.nombre).includes(q) || normalizar(p.marca ?? '').includes(q)
		);
	});

	const totalEnCategoria = $derived(listaCompleta.filter((p) => !quitados.includes(p.id)).length);

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
		categoriaEditada = null;
		nombre = '';
		reiniciarDialog();
		dialogOpen = true;
	}

	async function abrirEditar(categoria: CategoriaConConteo) {
		categoriaEditada = categoria;
		nombre = categoria.nombre;
		reiniciarDialog();
		dialogOpen = true;

		cargandoProductos = true;
		try {
			const res = await fetch(`/api/categorias/${categoria.id}/productos`);
			if (!res.ok) throw new Error('request failed');
			productos = (await res.json()) as ProductoDeCategoria[];
		} catch {
			toast.error('No se pudieron cargar los productos de la categoría');
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

	// --- Buscador de catálogo (este sí pega contra la API, igual que en Promos) ---
	let buscadorAbierto = $state(false);
	let busquedaCatalogo = $state('');
	let resultadosCatalogo = $state<ProductoDTO[]>([]);
	let buscandoCatalogo = $state(false);
	let debounceCatalogo: ReturnType<typeof setTimeout> | undefined;

	// Lo que ya está en la categoría (o marcado para agregar) no vuelve a ofrecerse.
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
				marca: producto.marca,
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
			toast.error('Ponle un nombre a la categoría');
			return;
		}

		guardando = true;
		try {
			// Al crear hacen falta dos pasos: primero existe la categoría, después se le
			// mueven los productos elegidos (el POST compartido con el alta de producto
			// solo recibe el nombre).
			let categoriaId = categoriaEditada?.id;
			if (!categoriaId) {
				const res = await fetch('/api/categorias', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ nombre: nombreLimpio })
				});
				if (!res.ok) {
					const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
					toast.error(cuerpo?.message ?? 'No se pudo crear la categoría');
					return;
				}
				categoriaId = ((await res.json()) as { id: string }).id;
			}

			const hayCambios = categoriaEditada !== null || agregados.length > 0 || quitados.length > 0;
			if (hayCambios) {
				const res = await fetch(`/api/categorias/${categoriaId}`, {
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
					toast.error(cuerpo?.message ?? 'No se pudo guardar la categoría');
					return;
				}
			}

			toast.success(categoriaEditada ? 'Categoría actualizada' : 'Categoría creada');
			dialogOpen = false;
			await cargarCategorias();
		} catch {
			toast.error('No se pudo guardar la categoría');
		} finally {
			guardando = false;
		}
	}

	let confirmEliminarOpen = $state(false);
	let categoriaAEliminar = $state<CategoriaConConteo | null>(null);
	let eliminando = $state(false);

	function pedirEliminar(categoria: CategoriaConConteo) {
		categoriaAEliminar = categoria;
		confirmEliminarOpen = true;
	}

	const mensajeEliminar = $derived.by(() => {
		const categoria = categoriaAEliminar;
		if (!categoria) return '';
		const partes = [`¿Eliminar la categoría "${categoria.nombre}"?`];

		if (categoria.productos > 0) {
			partes.push(
				categoria.productos === 1
					? 'Su producto no se borra: queda sin categoría.'
					: `Sus ${categoria.productos} productos no se borran: quedan sin categoría.`
			);
		}

		// Los modos que la nombran junto a otras categorías solo la pierden de su lista; los
		// que aplicaban únicamente a esta se eliminan (quedarse sin categorías los volvería
		// un recargo sobre todo el catálogo), así que se nombran uno por uno.
		const aEliminar = categoria.modosAEliminar;
		const soloPierdenLaCategoria = categoria.modos - aEliminar.length;

		if (aEliminar.length > 0) {
			partes.push(
				aEliminar.length === 1
					? `Se eliminará también el modo de precio "${aEliminar[0]}", que aplica solo a esta categoría.`
					: `Se eliminarán también ${aEliminar.length} modos de precio que aplican solo a esta categoría: ${aEliminar.join(', ')}.`
			);
		}
		if (soloPierdenLaCategoria > 0) {
			// "Otro/Otros" solo si antes se nombró alguno que sí se elimina.
			const uno = soloPierdenLaCategoria === 1;
			const sujeto = aEliminar.length
				? uno
					? 'Otro modo de precio'
					: `Otros ${soloPierdenLaCategoria} modos de precio`
				: uno
					? 'Un modo de precio'
					: `${soloPierdenLaCategoria} modos de precio`;
			partes.push(
				uno
					? `${sujeto} la tiene en su lista y seguirá activo con el resto de sus categorías.`
					: `${sujeto} la tienen en su lista y seguirán activos con el resto de sus categorías.`
			);
		}

		return partes.join(' ');
	});

	async function confirmarEliminar() {
		if (!categoriaAEliminar) return;
		eliminando = true;
		try {
			const res = await fetch(`/api/categorias/${categoriaAEliminar.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('request failed');
			const { modosEliminados } = (await res.json()) as { modosEliminados: number };
			toast.success(
				modosEliminados > 0
					? `Categoría eliminada, junto con ${modosEliminados} ${modosEliminados === 1 ? 'modo de precio' : 'modos de precio'}`
					: 'Categoría eliminada'
			);
			confirmEliminarOpen = false;
			await Promise.all([cargarCategorias(), invalidate('recargo:precio')]);
		} catch {
			toast.error('No se pudo eliminar la categoría');
		} finally {
			eliminando = false;
		}
	}
</script>

<svelte:head>
	<title>Categorías · La Central</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<Breadcrumbs
		items={[
			{ label: 'Dashboard', href: '/dashboard' },
			{ label: 'Inventario', href: '/dashboard/productos' },
			{ label: 'Categorías' }
		]}
	/>

	<header
		class="flex flex-col gap-4 @min-[768px]:flex-row @min-[768px]:items-start @min-[768px]:justify-between"
	>
		<div class="@min-[768px]:max-w-xl">
			<h1 class="title">Categorías</h1>
			<p class="mt-1 text-sm text-stone-400">
				Renombra una categoría, agrégale o sácale productos. Quitar un producto no lo elimina del
				inventario: solo lo deja sin categoría.
			</p>
		</div>
		<button
			type="button"
			onclick={abrirNueva}
			class="h-12 cursor-pointer rounded-xl bg-success px-6 text-sm font-extrabold whitespace-nowrap text-white transition-colors hover:bg-success-dark @min-[768px]:shrink-0"
		>
			Nueva Categoría
		</button>
	</header>

	{#if categorias.length === 0}
		<p class="rounded-2xl bg-white p-10 text-center text-sm text-stone-400">
			Todavía no hay categorías. Crea la primera con el botón de arriba.
		</p>
	{:else}
		<div class="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-3">
			{#each categorias as categoria (categoria.id)}
				<div
					class="flex items-center gap-2 rounded-2xl border-2 border-stone-100 bg-white p-5 transition-colors focus-within:border-primary hover:border-primary"
				>
					<button
						type="button"
						onclick={() => abrirEditar(categoria)}
						class="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
					>
						<span
							class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600"
						>
							<Layers size={16} strokeWidth={2.5} />
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-extrabold text-stone-800">{categoria.nombre}</span>
							<span class="block text-xs leading-3.75 text-stone-400">
								{categoria.productos}
								{categoria.productos === 1 ? 'producto' : 'productos'}
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
						onclick={() => pedirEliminar(categoria)}
						class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-red-50 hover:text-error"
						aria-label="Eliminar {categoria.nombre}"
					>
						<Trash2 size={16} />
					</button>
				</div>
			{/each}
		</div>
	{/if}
</main>

<Dialog
	bind:open={dialogOpen}
	title={categoriaEditada ? 'Editar categoría' : 'Nueva categoría'}
	class="max-w-lg"
>
	<form onsubmit={handleGuardar} class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label for="categoria-nombre" class="text-sm font-bold text-stone-800">Nombre</label>
			<Input id="categoria-nombre" bind:value={nombre} placeholder="Ej. Bebidas" />
		</div>

		<div class="flex flex-col gap-2">
			<div class="flex items-center justify-between gap-2">
				<span class="text-sm font-bold text-stone-800">
					Productos
					{#if !cargandoProductos}
						<span class="font-medium text-stone-400">({totalEnCategoria})</span>
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
							class="absolute top-full right-0 left-0 z-20 mt-1 max-h-48 overflow-auto rounded-xl bg-white p-1 shadow-xl ring-1 ring-stone-100"
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
									{#if producto.categoria}
										<span class="shrink-0 text-xs leading-3.75 text-stone-400">
											mover desde {producto.categoria}
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
					Esta categoría todavía no tiene productos. Agrégalos con "Añadir productos".
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
										{producto.marca ?? 'Sin marca'} · {producto.cantidad} en stock
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
										aria-label="Quitar {producto.nombre} de la categoría"
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
						{quitados.length === 1 ? 'producto quedará' : 'productos quedarán'} sin categoría al guardar.
					</p>
				{/if}
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-3">
			<Button type="button" variant="danger" onclick={() => (dialogOpen = false)}>Cancelar</Button>
			<Button type="submit" variant="success" disabled={guardando}>
				{guardando ? 'Guardando…' : categoriaEditada ? 'Guardar' : 'Crear'}
			</Button>
		</div>
	</form>
</Dialog>

<ConfirmDialog
	bind:open={confirmEliminarOpen}
	title="Eliminar categoría"
	message={mensajeEliminar}
	confirmando={eliminando}
	onConfirm={confirmarEliminar}
/>
