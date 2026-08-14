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
	let proveedoresList = $state<OpcionSimple[]>(data.proveedores);
	let categoriasList = $state<OpcionSimple[]>(data.categorias);

	let busqueda = $state('');
	let categoriaFiltroId = $state('');
	let pagina = $state(1);
	let cargando = $state(false);

	const totalPaginas = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const proveedorNombres = $derived(proveedoresList.map((p) => p.nombre));
	const categoriaNombres = $derived(categoriasList.map((c) => c.nombre));

	async function cargarProductos() {
		cargando = true;
		try {
			const params = new URLSearchParams({
				page: String(pagina),
				pageSize: String(pageSize),
				search: busqueda,
				categoriaId: categoriaFiltroId
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

	function onCategoriaFiltroChange() {
		pagina = 1;
		cargarProductos();
	}

	function irAPagina(n: number) {
		if (n < 1 || n > totalPaginas || n === pagina) return;
		pagina = n;
		cargarProductos();
	}

	async function ajustarStock(producto: ProductoDTO, delta: number) {
		const anterior = producto.cantidad;
		producto.cantidad = Math.max(0, anterior + delta);
		try {
			const res = await fetch(`/api/productos/${producto.id}/stock`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ delta })
			});
			if (!res.ok) throw new Error('request failed');
			const { cantidad } = (await res.json()) as { cantidad: number };
			producto.cantidad = cantidad;
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

	async function crearOpcion(tipo: 'proveedor' | 'categoria', nombre: string) {
		try {
			const res = await fetch(`/api/${tipo === 'proveedor' ? 'proveedores' : 'categorias'}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nombre })
			});
			if (!res.ok) return;
			const creado = (await res.json()) as OpcionSimple;
			if (tipo === 'proveedor') {
				if (!proveedoresList.some((p) => p.id === creado.id)) {
					proveedoresList = [...proveedoresList, creado];
				}
			} else if (!categoriasList.some((c) => c.id === creado.id)) {
				categoriasList = [...categoriasList, creado];
			}
		} catch {
			// El producto igual podrá crearse: el servidor resuelve o crea el proveedor/categoría por nombre.
		}
	}

	let dialogOpen = $state(false);
	let guardando = $state(false);
	let editandoId = $state<string | null>(null);
	let nuevoNombre = $state('');
	let nuevoProveedor = $state('');
	let nuevoCategoria = $state('');
	let nuevoStock = $state('');
	let nuevoCodigoBarras = $state('');
	let nuevosPrecios = $state<{ nombre: string; valor: string }[]>([
		{ nombre: 'Unitario', valor: '' }
	]);
	let seguirAgregando = $state(false);
	let nombreInputEl: HTMLInputElement | undefined = $state();

	function abrirDialog() {
		editandoId = null;
		nuevoNombre = '';
		nuevoProveedor = proveedorNombres[0] ?? '';
		nuevoCategoria = categoriaNombres[0] ?? '';
		nuevoStock = '';
		nuevoCodigoBarras = '';
		nuevosPrecios = [{ nombre: 'Unitario', valor: '' }];
		seguirAgregando = false;
		dialogOpen = true;
	}

	function abrirDialogEditar(producto: ProductoDTO) {
		editandoId = producto.id;
		nuevoNombre = producto.nombre;
		nuevoProveedor = producto.proveedor ?? '';
		nuevoCategoria = producto.categoria ?? '';
		nuevoStock = String(producto.cantidad);
		nuevoCodigoBarras = producto.codigoBarras ?? '';
		nuevosPrecios =
			producto.precios.length > 0
				? producto.precios.map((p) => ({ nombre: p.nombre, valor: String(p.valor) }))
				: [{ nombre: 'Unitario', valor: '' }];
		seguirAgregando = false;
		dialogOpen = true;
	}

	function agregarPrecio() {
		nuevosPrecios = [...nuevosPrecios, { nombre: '', valor: '' }];
	}

	function quitarPrecio(index: number) {
		if (nuevosPrecios.length <= 1) return;
		nuevosPrecios = nuevosPrecios.filter((_, i) => i !== index);
	}

	function evitarEnvioPorEnter(event: KeyboardEvent) {
		if (event.key === 'Enter') event.preventDefault();
	}

	async function handleGuardar(event: SubmitEvent) {
		event.preventDefault();

		const precios = nuevosPrecios
			.map((p) => ({ nombre: p.nombre.trim(), valor: Number(p.valor) }))
			.filter((p) => p.nombre && p.valor >= 0);

		if (
			!nuevoNombre.trim() ||
			!nuevoProveedor.trim() ||
			!nuevoCategoria.trim() ||
			precios.length === 0
		) {
			toast.error('Completa el nombre, proveedor, categoría y al menos un precio válido');
			return;
		}

		guardando = true;
		try {
			const payload = {
				nombre: nuevoNombre.trim(),
				proveedor: nuevoProveedor.trim(),
				categoria: nuevoCategoria.trim(),
				cantidad: Number(nuevoStock) || 0,
				codigoBarras: nuevoCodigoBarras.trim() || null,
				precios
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
				nuevoStock = '';
				nuevoCodigoBarras = '';
				nuevosPrecios = [{ nombre: 'Unitario', valor: '' }];
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
	<title>Productos · La tiendita</title>
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
			<Select bind:value={categoriaFiltroId} onchange={onCategoriaFiltroChange} class="w-52">
				<option value="">Todas las categorías</option>
				{#each categoriasList as categoria (categoria.id)}
					<option value={categoria.id}>{categoria.nombre}</option>
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
					<th class="py-2 font-bold">Cantidad</th>
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
						<td class="py-3 font-medium text-stone-700">{producto.nombre}</td>
						<td class="py-3 text-stone-500">{producto.categoria ?? '—'}</td>
						<td class="py-3">
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => ajustarStock(producto, -1)}
									class="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200"
									aria-label="Reducir stock"
								>
									<Minus size={14} strokeWidth={3} />
								</button>
								<span class="w-6 text-center font-bold tabular-nums">{producto.cantidad}</span>
								<button
									type="button"
									onclick={() => ajustarStock(producto, 1)}
									class="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200"
									aria-label="Aumentar stock"
								>
									<Plus size={14} strokeWidth={3} />
								</button>
							</div>
						</td>
						<td class="py-3 font-bold text-stone-800">
							{currency(producto.precios[0]?.valor ?? 0)}
							{#if producto.precios.length > 1}
								<span class="ml-1 text-xs font-medium text-stone-400"
									>+{producto.precios.length - 1} más</span
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

<Dialog bind:open={dialogOpen} title={editandoId ? 'Editar producto' : 'Nuevo producto'}>
	<p class="-mt-4 text-sm text-stone-400">Completa los datos del producto</p>
	<form onsubmit={handleGuardar} class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label for="proveedor" class="text-sm font-bold text-stone-800">Proveedor</label>
			<Combobox
				id="proveedor"
				bind:value={nuevoProveedor}
				items={proveedorNombres}
				placeholder="Buscar o crear proveedor…"
				oncreate={(nombre) => crearOpcion('proveedor', nombre)}
			/>
		</div>

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

		<div class="flex flex-col gap-2">
			<div class="flex items-center justify-between">
				<span class="text-sm font-bold text-stone-800">Precios</span>
				<button type="button" onclick={agregarPrecio} class="link text-xs">
					<Plus size={12} strokeWidth={3} />
					Agregar precio
				</button>
			</div>
			{#each nuevosPrecios as precio, index (index)}
				<div class="flex items-center gap-2">
					<input
						type="text"
						placeholder="Nombre (ej. Unitario, Por mayor)"
						bind:value={precio.nombre}
						class="input flex-1"
					/>
					<MoneyInput bind:value={precio.valor} class="w-32" />
					<button
						type="button"
						onclick={() => quitarPrecio(index)}
						disabled={nuevosPrecios.length <= 1}
						class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
						aria-label="Quitar precio"
					>
						<Trash2 size={16} />
					</button>
				</div>
			{/each}
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="stock" class="text-sm font-bold text-stone-800">Stock Inicial</label>
			<input
				id="stock"
				type="number"
				min="0"
				step="1"
				inputmode="numeric"
				placeholder="0"
				bind:value={nuevoStock}
				class="input"
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
