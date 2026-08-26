<script lang="ts">
	import toast from 'svelte-french-toast';
	import { Search, X, Trash2, Pencil, Tag } from '@lucide/svelte';
	import {
		Select,
		Dialog,
		Input,
		Breadcrumbs,
		ConfirmDialog,
		DataTable,
		type ColumnaTabla
	} from '$lib/components/ui';
	import { currency, calcularGanancia } from '$lib/utils';
	import ProductoForm from '$lib/components/ProductoForm.svelte';
	import type { PageData } from './$types';
	import type { ProductoDTO, OpcionSimple, OrdenProducto } from '$lib/server/productos';

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

	let ordenPor = $state<OrdenProducto | null>('nombre');
	let ordenDireccion = $state<'asc' | 'desc'>('asc');
	// Tres estados por columna: asc → desc → sin orden (vuelve al orden por defecto del servidor).
	function onOrdenar(columnaId: string) {
		if (ordenPor === columnaId) {
			if (ordenDireccion === 'asc') {
				ordenDireccion = 'desc';
			} else {
				ordenPor = null;
			}
		} else {
			ordenPor = columnaId as OrdenProducto;
			ordenDireccion = 'asc';
		}
		pagina = 1;
		cargarProductos();
	}

	// Evita que una respuesta vieja (p.ej. de la página anterior o de un filtro ya reemplazado)
	// llegue después de una más nueva y pise el resultado correcto en pantalla.
	let cargaId = 0;
	async function cargarProductos() {
		const miCarga = ++cargaId;
		cargando = true;
		try {
			const params = new URLSearchParams({
				page: String(pagina),
				pageSize: String(pageSize),
				search: busqueda,
				categoriaId: categoriaFiltroId,
				marcaId: marcaFiltroId,
				orderBy: ordenPor ?? 'nombre',
				orderDir: ordenPor ? ordenDireccion : 'asc'
			});
			const res = await fetch(`/api/productos?${params}`);
			if (!res.ok) throw new Error('request failed');
			const resultado = (await res.json()) as { productos: ProductoDTO[]; total: number };
			if (miCarga !== cargaId) return;
			productosLista = resultado.productos;
			total = resultado.total;
		} catch {
			if (miCarga === cargaId) toast.error('No se pudo cargar el inventario');
		} finally {
			if (miCarga === cargaId) cargando = false;
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

	<div
		class="flex flex-col gap-4 @min-[1024px]:flex-row @min-[1024px]:items-center @min-[1024px]:justify-between"
	>
		<div class="flex flex-1 flex-col gap-3 @min-[640px]:flex-row @min-[640px]:items-center">
			<div class="w-full @min-[640px]:max-w-sm @min-[640px]:flex-1">
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
			<div class="flex flex-col gap-3 @min-[480px]:flex-row">
				<Select
					bind:value={categoriaFiltroId}
					onchange={onFiltroChange}
					class="w-full @min-[640px]:w-52"
				>
					<option value="">Todas las categorías</option>
					{#each categoriasList as categoria (categoria.id)}
						<option value={categoria.id}>{categoria.nombre}</option>
					{/each}
				</Select>
				<Select
					bind:value={marcaFiltroId}
					onchange={onFiltroChange}
					class="w-full @min-[640px]:w-52"
				>
					<option value="">Todas las marcas</option>
					{#each marcasList as marca (marca.id)}
						<option value={marca.id}>{marca.nombre}</option>
					{/each}
				</Select>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<a
				href="/dashboard/productos/promos"
				class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-stone-200 px-5 py-3.5 text-sm font-extrabold text-stone-700 transition-colors hover:bg-stone-300 @min-[1024px]:flex-initial"
			>
				<Tag size={16} strokeWidth={2.5} />
				Promos
			</a>
			<button
				type="button"
				onclick={abrirDialog}
				class="flex-1 cursor-pointer rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-extrabold text-white transition-colors hover:bg-emerald-600 @min-[1024px]:flex-initial"
			>
				Agregar Producto
			</button>
		</div>
	</div>

	{#snippet celdaProducto(producto: ProductoDTO)}
		<span class="font-medium text-stone-700">
			{producto.nombre}
			{#if producto.marca}
				<span class="ml-1 text-xs font-medium text-stone-400">· {producto.marca}</span>
			{/if}
		</span>
	{/snippet}
	{#snippet celdaCategoria(producto: ProductoDTO)}
		<span class="text-stone-500">{producto.categoria ?? '—'}</span>
	{/snippet}
	{#snippet celdaStock(producto: ProductoDTO)}
		<input
			type="number"
			min="0"
			step="any"
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
	{/snippet}
	{#snippet celdaPrecio(producto: ProductoDTO)}
		<span class="font-bold text-stone-800">
			{currency(producto.presentaciones[0]?.precio ?? 0)}
			{#if producto.presentaciones.length > 1}
				<span class="ml-1 text-xs font-medium text-stone-400"
					>+{producto.presentaciones.length - 1} más</span
				>
			{/if}
		</span>
	{/snippet}
	{#snippet celdaCosto(producto: ProductoDTO)}
		<span class="text-stone-500">
			{producto.costoUltimo !== null ? currency(producto.costoUltimo) : '—'}
		</span>
	{/snippet}
	{#snippet celdaGanancia(producto: ProductoDTO)}
		{@const ganancia = calcularGanancia(
			producto.costoUltimo,
			producto.presentaciones[0]?.precio ?? 0
		)}
		{#if ganancia}
			<span class="font-bold {ganancia.monto >= 0 ? 'text-emerald-600' : 'text-red-500'}">
				{currency(ganancia.monto)} · {ganancia.porcentaje.toFixed(0)}%
			</span>
		{:else}
			<span class="text-stone-400">—</span>
		{/if}
	{/snippet}
	{#snippet celdaEstado(producto: ProductoDTO)}
		<span
			class="rounded-full px-2.5 py-0.5 text-xs font-bold {producto.cantidad > 0
				? 'bg-emerald-100 text-emerald-700'
				: 'bg-red-100 text-red-700'}"
		>
			{producto.cantidad > 0 ? 'Disponible' : 'Agotado'}
		</span>
	{/snippet}
	{#snippet celdaAccionesProducto(producto: ProductoDTO)}
		<div class="flex items-center justify-end gap-1">
			<button
				type="button"
				onclick={() => abrirDialogEditar(producto)}
				class="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
				aria-label="Editar producto"
			>
				<Pencil size={16} />
			</button>
			<button
				type="button"
				onclick={() => pedirEliminar(producto)}
				class="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
				aria-label="Eliminar producto"
			>
				<Trash2 size={16} />
			</button>
		</div>
	{/snippet}

	{#snippet tarjetaProducto(producto: ProductoDTO)}
		{@const ganancia = calcularGanancia(
			producto.costoUltimo,
			producto.presentaciones[0]?.precio ?? 0
		)}
		<div class="flex flex-col gap-3 rounded-2xl border-2 border-stone-200 bg-white p-4">
			<div class="flex items-start justify-between gap-2">
				<div class="min-w-0">
					<p class="truncate font-extrabold text-stone-800">{producto.nombre}</p>
					{#if producto.marca}
						<p class="text-xs text-stone-400">{producto.marca}</p>
					{/if}
				</div>
				{@render celdaEstado(producto)}
			</div>
			<div class="grid grid-cols-2 gap-3 text-sm">
				<div>
					<p class="text-xs text-stone-400">Categoría</p>
					<p class="font-medium text-stone-700">{producto.categoria ?? '—'}</p>
				</div>
				<div>
					<p class="text-xs text-stone-400">Precio</p>
					<p class="font-bold text-stone-800">
						{currency(producto.presentaciones[0]?.precio ?? 0)}
					</p>
				</div>
				<div>
					<p class="text-xs text-stone-400">Stock</p>
					<div class="mt-0.5">{@render celdaStock(producto)}</div>
				</div>
				<div>
					<p class="text-xs text-stone-400">Costo / Ganancia</p>
					<p class="font-medium text-stone-700">
						{producto.costoUltimo !== null ? currency(producto.costoUltimo) : '—'}
						{#if ganancia}
							<span class="ml-1 {ganancia.monto >= 0 ? 'text-emerald-600' : 'text-red-500'}">
								· {ganancia.porcentaje.toFixed(0)}%
							</span>
						{/if}
					</p>
				</div>
			</div>
			<div class="flex items-center gap-2 border-t border-stone-100 pt-3">
				<button
					type="button"
					onclick={() => abrirDialogEditar(producto)}
					class="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-stone-100 text-sm font-bold text-stone-700"
				>
					<Pencil size={16} />
					Editar
				</button>
				<button
					type="button"
					onclick={() => pedirEliminar(producto)}
					class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-stone-100 text-red-500"
					aria-label="Eliminar producto"
				>
					<Trash2 size={16} />
				</button>
			</div>
		</div>
	{/snippet}

	<DataTable
		columnas={[
			{ id: 'nombre', etiqueta: 'Producto', ordenable: true, celda: celdaProducto },
			{ id: 'categoria', etiqueta: 'Categoría', ordenable: true, celda: celdaCategoria },
			{ id: 'cantidad', etiqueta: 'Stock (unidades)', ordenable: true, celda: celdaStock },
			{ id: 'precio', etiqueta: 'Precio', celda: celdaPrecio },
			{ id: 'costo', etiqueta: 'Costo', ordenable: true, celda: celdaCosto },
			{ id: 'ganancia', etiqueta: 'Ganancia', celda: celdaGanancia },
			{ id: 'estado', etiqueta: 'Estado', celda: celdaEstado },
			{ id: 'acciones', etiqueta: '', celda: celdaAccionesProducto }
		] as ColumnaTabla<ProductoDTO>[]}
		filas={productosLista}
		claveFila={(p) => p.id}
		{cargando}
		mensajeVacio="No se encontraron productos"
		{ordenPor}
		{ordenDireccion}
		{onOrdenar}
		tarjetaMovil={tarjetaProducto}
		{pagina}
		{totalPaginas}
		{total}
		{pageSize}
		onCambiarPagina={irAPagina}
	/>
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
