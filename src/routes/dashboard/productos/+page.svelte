<script lang="ts">
	import toast from 'svelte-french-toast';
	import { Search, X, Trash2, ChevronLeft, ChevronRight, Pencil, Tag } from '@lucide/svelte';
	import { Select, Dialog, Input, Breadcrumbs, ConfirmDialog } from '$lib/components/ui';
	import { currency, calcularGanancia } from '$lib/utils';
	import ProductoForm from '$lib/components/ProductoForm.svelte';
	import type { PageData } from './$types';
	import type { ProductoDTO, OpcionSimple } from '$lib/server/productos';

	let { data }: { data: PageData } = $props();

	const pageSize = data.pageSize;

	let productosLista = $state<ProductoDTO[]>(data.productos);
	let total = $state(data.total);
	let marcasList = $state<OpcionSimple[]>(data.marcas);
	let categoriasList = $state<OpcionSimple[]>(data.categorias);

	let busqueda = $state('');
	let categoriaFiltroId = $state('');
	let marcaFiltroId = $state('');
	let pagina = $state(1);
	let cargando = $state(false);

	const totalPaginas = $derived(Math.max(1, Math.ceil(total / pageSize)));

	async function cargarProductos() {
		cargando = true;
		try {
			const params = new URLSearchParams({
				page: String(pagina),
				pageSize: String(pageSize),
				search: busqueda,
				categoriaId: categoriaFiltroId,
				marcaId: marcaFiltroId
			});
			const res = await fetch(`/api/productos?${params}`);
			if (!res.ok) throw new Error('request failed');
			const resultado = (await res.json()) as { productos: ProductoDTO[]; total: number };
			productosLista = resultado.productos;
			total = resultado.total;
		} catch {
			toast.error('No se pudo cargar el inventario');
		} finally {
			cargando = false;
		}
	}

	let debounceHandle: ReturnType<typeof setTimeout> | undefined;
	function onBusquedaInput() {
		pagina = 1;
		clearTimeout(debounceHandle);
		debounceHandle = setTimeout(cargarProductos, 300);
	}

	function onFiltroChange() {
		pagina = 1;
		cargarProductos();
	}

	function irAPagina(n: number) {
		if (n < 1 || n > totalPaginas || n === pagina) return;
		pagina = n;
		cargarProductos();
	}

	async function ajustarStockBase(producto: ProductoDTO, delta: number) {
		if (!producto.presentacionBaseId) return;
		const anterior = producto.cantidad;
		producto.cantidad = Math.max(0, anterior + delta);
		try {
			const res = await fetch(`/api/presentaciones/${producto.presentacionBaseId}/stock`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ delta })
			});
			if (!res.ok) throw new Error('request failed');
			const { productoCantidad } = (await res.json()) as { productoCantidad: number };
			producto.cantidad = productoCantidad;
		} catch {
			producto.cantidad = anterior;
			toast.error('No se pudo actualizar el stock');
		}
	}

	let confirmEliminarOpen = $state(false);
	let productoAEliminar = $state<ProductoDTO | null>(null);
	let eliminando = $state(false);

	function pedirEliminar(producto: ProductoDTO) {
		productoAEliminar = producto;
		confirmEliminarOpen = true;
	}

	async function confirmarEliminar() {
		if (!productoAEliminar) return;
		eliminando = true;
		try {
			const res = await fetch(`/api/productos/${productoAEliminar.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('request failed');
			toast.success('Producto eliminado');
			confirmEliminarOpen = false;
			await cargarProductos();
		} catch {
			toast.error('No se pudo eliminar el producto');
		} finally {
			eliminando = false;
		}
	}

	let dialogOpen = $state(false);
	let productoParaEditar = $state<ProductoDTO | null>(null);
	let formKey = $state(0);

	function abrirDialog() {
		productoParaEditar = null;
		formKey++;
		dialogOpen = true;
	}

	function abrirDialogEditar(producto: ProductoDTO) {
		productoParaEditar = producto;
		formKey++;
		dialogOpen = true;
	}

	function onMarcaCreada(marca: OpcionSimple) {
		if (!marcasList.some((m) => m.id === marca.id)) marcasList = [...marcasList, marca];
	}

	function onCategoriaCreada(categoria: OpcionSimple) {
		if (!categoriasList.some((c) => c.id === categoria.id))
			categoriasList = [...categoriasList, categoria];
	}

	async function onProductoGuardado(
		_producto: ProductoDTO,
		{ seguirAgregando }: { seguirAgregando: boolean }
	) {
		await cargarProductos();
		if (!seguirAgregando) dialogOpen = false;
	}
</script>

<svelte:head>
	<title>Productos · La Central</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Inventario' }]} />

	<header>
		<h1 class="title">Inventario</h1>
		<p class="mt-1 text-sm text-stone-400">Gestiona los productos de tu tienda</p>
	</header>

	<div class="flex items-center justify-between gap-4">
		<div class="flex flex-1 items-center gap-3">
			<div class="max-w-sm flex-1">
				<Input
					bind:value={busqueda}
					oninput={onBusquedaInput}
					placeholder="Buscar por nombre de producto…"
					type="text"
				>
					{#snippet icon()}
						<Search size={16} />
					{/snippet}
					{#snippet trailing()}
						{#if busqueda}
							<button
								type="button"
								onclick={() => {
									busqueda = '';
									onBusquedaInput();
								}}
								class="cursor-pointer text-stone-400 transition-colors hover:text-stone-600"
								aria-label="Limpiar búsqueda"
							>
								<X size={16} />
							</button>
						{/if}
					{/snippet}
				</Input>
			</div>
			<Select bind:value={categoriaFiltroId} onchange={onFiltroChange} class="w-52">
				<option value="">Todas las categorías</option>
				{#each categoriasList as categoria (categoria.id)}
					<option value={categoria.id}>{categoria.nombre}</option>
				{/each}
			</Select>
			<Select bind:value={marcaFiltroId} onchange={onFiltroChange} class="w-52">
				<option value="">Todas las marcas</option>
				{#each marcasList as marca (marca.id)}
					<option value={marca.id}>{marca.nombre}</option>
				{/each}
			</Select>
		</div>
		<div class="flex items-center gap-2">
			<a
				href="/dashboard/productos/promos"
				class="flex cursor-pointer items-center gap-2 rounded-xl bg-stone-200 px-5 py-3.5 text-sm font-extrabold text-stone-700 transition-colors hover:bg-stone-300"
			>
				<Tag size={16} strokeWidth={2.5} />
				Promos
			</a>
			<button
				type="button"
				onclick={abrirDialog}
				class="cursor-pointer rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-extrabold text-white transition-colors hover:bg-emerald-600"
			>
				Agregar Producto
			</button>
		</div>
	</div>

	<section
		aria-labelledby="inventario-heading"
		class="flex flex-1 flex-col gap-4 rounded-2xl bg-white p-6"
	>
		<h2 id="inventario-heading" class="sr-only">Listado de productos</h2>
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-stone-100 text-left text-xs text-stone-400 uppercase">
					<th class="py-2 font-bold">Producto</th>
					<th class="py-2 font-bold">Categoría</th>
					<th class="py-2 font-bold">Stock (unidades)</th>
					<th class="py-2 font-bold">Precio</th>
					<th class="py-2 font-bold">Costo</th>
					<th class="py-2 font-bold">Ganancia</th>
					<th class="py-2 font-bold">Estado</th>
					<th class="py-2"><span class="sr-only">Editar</span></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-stone-100">
				{#if productosLista.length === 0}
					<tr>
						<td colspan="8" class="py-8 text-center text-sm text-stone-400">
							{cargando ? 'Cargando…' : 'No se encontraron productos'}
						</td>
					</tr>
				{/if}
				{#each productosLista as producto (producto.id)}
					{@const ganancia = calcularGanancia(
						producto.costoUltimo,
						producto.presentaciones[0]?.precio ?? 0
					)}
					<tr>
						<td class="py-3 font-medium text-stone-700">
							{producto.nombre}
							{#if producto.marca}
								<span class="ml-1 text-xs font-medium text-stone-400">· {producto.marca}</span>
							{/if}
						</td>
						<td class="py-3 text-stone-500">{producto.categoria ?? '—'}</td>
						<td class="py-3">
							<input
								type="number"
								min="0"
								step="1"
								inputmode="numeric"
								value={producto.cantidad}
								disabled={!producto.presentacionBaseId}
								onchange={(event) => {
									const nuevo = Math.max(0, Math.floor(Number(event.currentTarget.value)) || 0);
									const delta = nuevo - producto.cantidad;
									if (delta !== 0) {
										ajustarStockBase(producto, delta);
									} else {
										event.currentTarget.value = String(producto.cantidad);
									}
								}}
								class="w-16 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-center text-sm font-bold tabular-nums outline-none focus:border-yellow-400 focus:bg-white focus:ring-2 focus:ring-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
								aria-label="Editar stock de {producto.nombre}"
							/>
						</td>
						<td class="py-3 font-bold text-stone-800">
							{currency(producto.presentaciones[0]?.precio ?? 0)}
							{#if producto.presentaciones.length > 1}
								<span class="ml-1 text-xs font-medium text-stone-400"
									>+{producto.presentaciones.length - 1} más</span
								>
							{/if}
						</td>
						<td class="py-3 text-stone-500">
							{producto.costoUltimo !== null ? currency(producto.costoUltimo) : '—'}
						</td>
						<td class="py-3">
							{#if ganancia}
								<span class="font-bold {ganancia.monto >= 0 ? 'text-emerald-600' : 'text-red-500'}">
									{currency(ganancia.monto)} · {ganancia.porcentaje.toFixed(0)}%
								</span>
							{:else}
								<span class="text-stone-400">—</span>
							{/if}
						</td>
						<td class="py-3">
							<span
								class="rounded-full px-2.5 py-0.5 text-xs font-bold {producto.cantidad > 0
									? 'bg-emerald-100 text-emerald-700'
									: 'bg-red-100 text-red-700'}"
							>
								{producto.cantidad > 0 ? 'Disponible' : 'Agotado'}
							</span>
						</td>
						<td class="py-3 text-right">
							<div class="flex items-center justify-end gap-1">
								<button
									type="button"
									onclick={() => abrirDialogEditar(producto)}
									class="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
									aria-label="Editar producto"
								>
									<Pencil size={16} />
								</button>
								<button
									type="button"
									onclick={() => pedirEliminar(producto)}
									class="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
									aria-label="Eliminar producto"
								>
									<Trash2 size={16} />
								</button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<div class="mt-auto flex items-center justify-between border-t border-stone-100 pt-4">
			<p class="text-sm text-stone-400">
				{#if total === 0}
					0 productos
				{:else}
					Mostrando {(pagina - 1) * pageSize + 1}–{Math.min(pagina * pageSize, total)} de {total}
				{/if}
			</p>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => irAPagina(pagina - 1)}
					disabled={pagina <= 1}
					class="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40"
					aria-label="Página anterior"
				>
					<ChevronLeft size={16} />
				</button>
				<span class="px-2 text-sm font-bold text-stone-700">Página {pagina} de {totalPaginas}</span>
				<button
					type="button"
					onclick={() => irAPagina(pagina + 1)}
					disabled={pagina >= totalPaginas}
					class="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40"
					aria-label="Página siguiente"
				>
					<ChevronRight size={16} />
				</button>
			</div>
		</div>
	</section>
</main>

<Dialog
	bind:open={dialogOpen}
	title={productoParaEditar ? 'Editar producto' : 'Nuevo producto'}
	class="max-w-xl"
>
	<p class="-mt-4 text-sm text-stone-400">Completa los datos del producto</p>
	{#key formKey}
		<ProductoForm
			producto={productoParaEditar}
			{marcasList}
			{categoriasList}
			{onMarcaCreada}
			{onCategoriaCreada}
			onGuardado={onProductoGuardado}
			onCancelar={() => (dialogOpen = false)}
		/>
	{/key}
</Dialog>

<ConfirmDialog
	bind:open={confirmEliminarOpen}
	title="Eliminar producto"
	message={`¿Eliminar "${productoAEliminar?.nombre ?? ''}" del inventario? Esta acción no se puede deshacer.`}
	confirmando={eliminando}
	onConfirm={confirmarEliminar}
/>
