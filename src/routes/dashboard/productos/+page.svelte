<script lang="ts">
	import toast from 'svelte-french-toast';
	import {
		Search,
		X,
		Plus,
		Minus,
		Trash2,
		Barcode,
		ChevronLeft,
		ChevronRight,
		Pencil
	} from '@lucide/svelte';
	import {
		Button,
		Select,
		Dialog,
		Input,
		Combobox,
		MoneyInput,
		Checkbox,
		Breadcrumbs
	} from '$lib/components/ui';
	import { currency } from '$lib/utils';
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
	const marcaNombres = $derived(marcasList.map((m) => m.nombre));
	const categoriaNombres = $derived(categoriasList.map((c) => c.nombre));

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

	async function eliminarProducto(producto: ProductoDTO) {
		if (!confirm(`¿Eliminar "${producto.nombre}" del inventario?`)) return;
		try {
			const res = await fetch(`/api/productos/${producto.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('request failed');
			toast.success('Producto eliminado');
			await cargarProductos();
		} catch {
			toast.error('No se pudo eliminar el producto');
		}
	}

	async function crearOpcion(tipo: 'marca' | 'categoria', nombre: string) {
		try {
			const res = await fetch(`/api/${tipo === 'marca' ? 'marcas' : 'categorias'}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nombre })
			});
			if (!res.ok) return;
			const creado = (await res.json()) as OpcionSimple;
			if (tipo === 'marca') {
				if (!marcasList.some((m) => m.id === creado.id)) {
					marcasList = [...marcasList, creado];
				}
			} else if (!categoriasList.some((c) => c.id === creado.id)) {
				categoriasList = [...categoriasList, creado];
			}
		} catch {
			// El producto igual podrá crearse: el servidor resuelve o crea la marca/categoría por nombre.
		}
	}

	interface PresentacionForm {
		id?: string;
		nombre: string;
		factorUnidades: string;
		precio: string;
		cantidad: string;
	}

	let dialogOpen = $state(false);
	let guardando = $state(false);
	let editandoId = $state<string | null>(null);
	let nuevoNombre = $state('');
	let nuevoMarca = $state('');
	let nuevoCategoria = $state('');
	let nuevoCodigoBarras = $state('');
	let nuevasPresentaciones = $state<PresentacionForm[]>([
		{ nombre: 'Unidad', factorUnidades: '1', precio: '', cantidad: '' }
	]);
	let seguirAgregando = $state(false);
	let nombreInputEl: HTMLInputElement | undefined = $state();

	function abrirDialog() {
		editandoId = null;
		nuevoNombre = '';
		nuevoMarca = '';
		nuevoCategoria = categoriaNombres[0] ?? '';
		nuevoCodigoBarras = '';
		nuevasPresentaciones = [{ nombre: 'Unidad', factorUnidades: '1', precio: '', cantidad: '' }];
		seguirAgregando = false;
		dialogOpen = true;
	}

	function abrirDialogEditar(producto: ProductoDTO) {
		editandoId = producto.id;
		nuevoNombre = producto.nombre;
		nuevoMarca = producto.marca ?? '';
		nuevoCategoria = producto.categoria ?? '';
		nuevoCodigoBarras = producto.codigoBarras ?? '';
		nuevasPresentaciones =
			producto.presentaciones.length > 0
				? producto.presentaciones.map((p) => ({
						id: p.id,
						nombre: p.nombre,
						factorUnidades: String(p.factorUnidades),
						precio: String(p.precio),
						cantidad: String(p.cantidad)
					}))
				: [{ nombre: 'Unidad', factorUnidades: '1', precio: '', cantidad: '' }];
		seguirAgregando = false;
		dialogOpen = true;
	}

	function agregarPresentacion() {
		nuevasPresentaciones = [
			...nuevasPresentaciones,
			{ nombre: '', factorUnidades: '', precio: '', cantidad: '' }
		];
	}

	function quitarPresentacion(index: number) {
		if (index === 0 || nuevasPresentaciones.length <= 1) return;
		nuevasPresentaciones = nuevasPresentaciones.filter((_, i) => i !== index);
	}

	function evitarEnvioPorEnter(event: KeyboardEvent) {
		if (event.key === 'Enter') event.preventDefault();
	}

	async function handleGuardar(event: SubmitEvent) {
		event.preventDefault();

		const presentaciones = nuevasPresentaciones
			.map((p, index) => ({
				id: p.id,
				nombre: index === 0 ? 'Unidad' : p.nombre.trim(),
				factorUnidades: index === 0 ? 1 : Number(p.factorUnidades),
				precio: Number(p.precio),
				cantidadInicial: editandoId ? undefined : Math.max(0, Number(p.cantidad) || 0)
			}))
			.filter((p) => p.nombre && p.factorUnidades >= 1 && p.precio >= 0);

		if (!nuevoNombre.trim() || !nuevoCategoria.trim() || presentaciones.length === 0) {
			toast.error('Completa el nombre, categoría y al menos una presentación válida');
			return;
		}

		guardando = true;
		try {
			const payload = {
				nombre: nuevoNombre.trim(),
				marca: nuevoMarca.trim() || undefined,
				categoria: nuevoCategoria.trim(),
				codigoBarras: nuevoCodigoBarras.trim() || null,
				presentaciones
			};

			const res = editandoId
				? await fetch(`/api/productos/${editandoId}`, {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					})
				: await fetch('/api/productos', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					});

			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(
					cuerpo?.message ??
						(editandoId ? 'No se pudo actualizar el producto' : 'No se pudo crear el producto')
				);
				return;
			}

			toast.success(editandoId ? 'Producto actualizado' : 'Producto agregado');
			await cargarProductos();

			if (editandoId) {
				dialogOpen = false;
			} else if (seguirAgregando) {
				nuevoNombre = '';
				nuevoCategoria = categoriaNombres[0] ?? '';
				nuevoCodigoBarras = '';
				nuevasPresentaciones = [{ nombre: 'Unidad', factorUnidades: '1', precio: '', cantidad: '' }];
				nombreInputEl?.focus();
			} else {
				dialogOpen = false;
			}
		} finally {
			guardando = false;
		}
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
		<button
			type="button"
			onclick={abrirDialog}
			class="cursor-pointer rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-extrabold text-white transition-colors hover:bg-emerald-600"
		>
			Agregar Producto
		</button>
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
					<th class="py-2 font-bold">Estado</th>
					<th class="py-2"><span class="sr-only">Editar</span></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-stone-100">
				{#if productosLista.length === 0}
					<tr>
						<td colspan="6" class="py-8 text-center text-sm text-stone-400">
							{cargando ? 'Cargando…' : 'No se encontraron productos'}
						</td>
					</tr>
				{/if}
				{#each productosLista as producto (producto.id)}
					<tr>
						<td class="py-3 font-medium text-stone-700">
							{producto.nombre}
							{#if producto.marca}
								<span class="ml-1 text-xs font-medium text-stone-400">· {producto.marca}</span>
							{/if}
						</td>
						<td class="py-3 text-stone-500">{producto.categoria ?? '—'}</td>
						<td class="py-3">
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => ajustarStockBase(producto, -1)}
									disabled={!producto.presentacionBaseId}
									class="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40"
									aria-label="Reducir stock"
								>
									<Minus size={14} strokeWidth={3} />
								</button>
								<span class="w-6 text-center font-bold tabular-nums">{producto.cantidad}</span>
								<button
									type="button"
									onclick={() => ajustarStockBase(producto, 1)}
									disabled={!producto.presentacionBaseId}
									class="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40"
									aria-label="Aumentar stock"
								>
									<Plus size={14} strokeWidth={3} />
								</button>
							</div>
						</td>
						<td class="py-3 font-bold text-stone-800">
							{currency(producto.presentaciones[0]?.precio ?? 0)}
							{#if producto.presentaciones.length > 1}
								<span class="ml-1 text-xs font-medium text-stone-400"
									>+{producto.presentaciones.length - 1} más</span
								>
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
									onclick={() => eliminarProducto(producto)}
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
	title={editandoId ? 'Editar producto' : 'Nuevo producto'}
	class="max-w-xl"
>
	<p class="-mt-4 text-sm text-stone-400">Completa los datos del producto</p>
	<form onsubmit={handleGuardar} class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label for="nombre" class="text-sm font-bold text-stone-800">Nombre del producto</label>
			<input
				id="nombre"
				type="text"
				placeholder="Colocar nombre del producto"
				bind:value={nuevoNombre}
				bind:this={nombreInputEl}
				class="input"
			/>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div class="flex flex-col gap-1.5">
				<label for="marca" class="text-sm font-bold text-stone-800">Marca (opcional)</label>
				<Combobox
					id="marca"
					bind:value={nuevoMarca}
					items={marcaNombres}
					placeholder="Buscar o crear marca…"
					oncreate={(nombre) => crearOpcion('marca', nombre)}
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<label for="categoria" class="text-sm font-bold text-stone-800">Categoría</label>
				<Combobox
					id="categoria"
					bind:value={nuevoCategoria}
					items={categoriaNombres}
					placeholder="Buscar o crear categoría…"
					oncreate={(nombre) => crearOpcion('categoria', nombre)}
				/>
			</div>
		</div>

		<div class="flex flex-col gap-2">
			<div class="flex items-center justify-between">
				<span class="text-sm font-bold text-stone-800">Presentaciones</span>
				<button type="button" onclick={agregarPresentacion} class="link text-xs">
					<Plus size={12} strokeWidth={3} />
					Agregar presentación
				</button>
			</div>
			<p class="text-xs text-stone-400">
				La primera es la presentación base (1 unidad). Una "Caja" con factor 6 equivale a 6
				unidades.
			</p>
			{#each nuevasPresentaciones as presentacion, index (index)}
				<div class="flex items-center gap-2">
					{#if index === 0}
						<input type="text" value="Unidad" disabled class="input min-w-0 flex-1 opacity-60" />
						<input type="text" value="1 unidad" disabled class="input w-24 shrink-0 opacity-60" />
					{:else}
						<input
							type="text"
							placeholder="Nombre (ej. Caja, Sixpack)"
							bind:value={presentacion.nombre}
							class="input min-w-0 flex-1"
						/>
						<input
							type="number"
							min="1"
							step="1"
							inputmode="numeric"
							placeholder="Factor"
							bind:value={presentacion.factorUnidades}
							class="input w-24 shrink-0"
						/>
					{/if}
					<MoneyInput bind:value={presentacion.precio} class="w-28 shrink-0" />
					{#if editandoId}
						<span
							class="w-20 shrink-0 text-center text-sm font-bold text-stone-500"
							title="Stock actual"
						>
							{presentacion.cantidad}
						</span>
					{:else}
						<input
							type="number"
							min="0"
							step="1"
							inputmode="numeric"
							placeholder="Stock"
							bind:value={presentacion.cantidad}
							class="input w-20 shrink-0"
						/>
					{/if}
					<button
						type="button"
						onclick={() => quitarPresentacion(index)}
						disabled={index === 0 || nuevasPresentaciones.length <= 1}
						class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
						aria-label="Quitar presentación"
					>
						<Trash2 size={16} />
					</button>
				</div>
			{/each}
			{#if editandoId}
				<p class="text-xs text-stone-400">
					El stock se ajusta desde Pedidos o los botones +/- de la tabla, no aquí.
				</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="codigo_barras" class="text-sm font-bold text-stone-800"
				>Código de barras (opcional)</label
			>
			<Input
				id="codigo_barras"
				bind:value={nuevoCodigoBarras}
				placeholder="Escanea o escribe el código"
				onkeydown={evitarEnvioPorEnter}
			>
				{#snippet icon()}
					<Barcode size={18} />
				{/snippet}
			</Input>
		</div>

		{#if !editandoId}
			<Checkbox bind:checked={seguirAgregando}>Seguir añadiendo</Checkbox>
		{/if}

		<div class="grid grid-cols-2 gap-3">
			<Button type="button" variant="danger" onclick={() => (dialogOpen = false)}>Cancelar</Button>
			<Button type="submit" variant="success" disabled={guardando}>
				{guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Agregar'}
			</Button>
		</div>
	</form>
</Dialog>
