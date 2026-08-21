<script lang="ts">
	import toast from 'svelte-french-toast';
	import { Search, Trash2, ChevronLeft, ChevronRight, Package, Truck, Plus } from '@lucide/svelte';
	import { Button, Dialog, Input, Combobox, MoneyInput, Breadcrumbs } from '$lib/components/ui';
	import { currency, formatFechaHora } from '$lib/utils';
	import type { PageData } from './$types';
	import type { PedidoDTO } from '$lib/server/pedidos';
	import type { ProductoDTO, OpcionSimple } from '$lib/server/productos';

	let { data }: { data: PageData } = $props();

	const pageSize = data.pageSize;

	let productos = $state<ProductoDTO[]>(data.productos);
	let pedidosLista = $state<PedidoDTO[]>(data.pedidos);
	let total = $state(data.total);
	let proveedoresList = $state<OpcionSimple[]>(data.proveedores);
	let marcasList = $state<OpcionSimple[]>(data.marcas);
	let categoriasList = $state<OpcionSimple[]>(data.categorias);
	let pagina = $state(1);
	let cargando = $state(false);

	const totalPaginas = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const proveedorNombres = $derived(proveedoresList.map((p) => p.nombre));
	const marcaNombres = $derived(marcasList.map((m) => m.nombre));
	const categoriaNombres = $derived(categoriasList.map((c) => c.nombre));

	async function cargarPedidos() {
		cargando = true;
		try {
			const params = new URLSearchParams({ page: String(pagina), pageSize: String(pageSize) });
			const res = await fetch(`/api/pedidos?${params}`);
			if (!res.ok) throw new Error('request failed');
			const resultado = (await res.json()) as { pedidos: PedidoDTO[]; total: number };
			pedidosLista = resultado.pedidos;
			total = resultado.total;
		} catch {
			toast.error('No se pudo cargar los pedidos');
		} finally {
			cargando = false;
		}
	}

	function irAPagina(n: number) {
		if (n < 1 || n > totalPaginas || n === pagina) return;
		pagina = n;
		cargarPedidos();
	}

	async function crearProveedor(nombre: string) {
		try {
			const res = await fetch('/api/proveedores', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nombre })
			});
			if (!res.ok) return;
			const creado = (await res.json()) as OpcionSimple;
			if (!proveedoresList.some((p) => p.id === creado.id)) {
				proveedoresList = [...proveedoresList, creado];
			}
		} catch {
			// El pedido igual podrá crearse: el servidor resuelve o crea el proveedor por nombre.
		}
	}

	function generarCodigo() {
		const hoy = new Date();
		const yyyymmdd = hoy.toISOString().slice(0, 10).replace(/-/g, '');
		const sufijo = Math.floor(1000 + Math.random() * 9000);
		return `PED-${yyyymmdd}-${sufijo}`;
	}

	function fechaLocalInput(fecha: Date) {
		const yyyy = fecha.getFullYear();
		const mm = String(fecha.getMonth() + 1).padStart(2, '0');
		const dd = String(fecha.getDate()).padStart(2, '0');
		return `${yyyy}-${mm}-${dd}`;
	}

	interface LineaPedido {
		productoId: string;
		productoNombre: string;
		presentacionId: string;
		cantidad: string;
		costoUnitario: string;
	}

	let dialogOpen = $state(false);
	let guardando = $state(false);
	let nuevoProveedor = $state('');
	let nuevoCodigo = $state('');
	let nuevaFecha = $state('');
	let nuevasNotas = $state('');
	let lineas = $state<LineaPedido[]>([]);
	let busquedaProducto = $state('');

	const productosFiltrados = $derived(
		busquedaProducto.trim()
			? productos.filter((p) => p.nombre.toLowerCase().includes(busquedaProducto.trim().toLowerCase()))
			: []
	);

	function presentacionesDe(productoId: string) {
		return productos.find((p) => p.id === productoId)?.presentaciones ?? [];
	}

	function abrirDialog() {
		nuevoProveedor = '';
		nuevoCodigo = generarCodigo();
		nuevaFecha = fechaLocalInput(new Date());
		nuevasNotas = '';
		lineas = [];
		busquedaProducto = '';
		dialogOpen = true;
	}

	function agregarLinea(producto: ProductoDTO) {
		if (lineas.some((l) => l.productoId === producto.id)) {
			toast.error('Ese producto ya está en la lista');
			return;
		}
		const base = producto.presentaciones[0];
		lineas = [
			...lineas,
			{
				productoId: producto.id,
				productoNombre: producto.nombre,
				presentacionId: base?.id ?? '',
				cantidad: '',
				costoUnitario: ''
			}
		];
		busquedaProducto = '';
	}

	function quitarLinea(index: number) {
		lineas = lineas.filter((_, i) => i !== index);
	}

	const totalPedido = $derived(
		lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.costoUnitario) || 0), 0)
	);

	async function handleGuardar(event: SubmitEvent) {
		event.preventDefault();

		const items = lineas
			.map((l) => ({
				productoId: l.productoId,
				presentacionId: l.presentacionId,
				cantidad: Math.floor(Number(l.cantidad)),
				costoUnitario: Number(l.costoUnitario)
			}))
			.filter((i) => i.presentacionId && i.cantidad > 0 && i.costoUnitario >= 0);

		if (!nuevoProveedor.trim() || items.length === 0) {
			toast.error('Completa el proveedor y al menos un producto con cantidad y costo válidos');
			return;
		}

		guardando = true;
		try {
			const res = await fetch('/api/proveedores', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nombre: nuevoProveedor.trim() })
			});
			const proveedor = (await res.json()) as OpcionSimple;

			const fecha = nuevaFecha ? new Date(`${nuevaFecha}T12:00:00`).toISOString() : undefined;

			const resPedido = await fetch('/api/pedidos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					codigo: nuevoCodigo.trim() || null,
					proveedorId: proveedor.id,
					fecha,
					notas: nuevasNotas.trim() || null,
					items
				})
			});

			if (!resPedido.ok) {
				const cuerpo = (await resPedido.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo registrar el pedido');
				return;
			}

			toast.success('Pedido registrado, el stock ya se actualizó');
			dialogOpen = false;
			pagina = 1;
			await cargarPedidos();
		} finally {
			guardando = false;
		}
	}

	// --- Crear producto nuevo sin salir del pedido ---
	let productoDialogOpen = $state(false);
	let guardandoProducto = $state(false);
	let npNombre = $state('');
	let npMarca = $state('');
	let npCategoria = $state('');
	let npPrecio = $state('');

	function abrirDialogProducto() {
		npNombre = busquedaProducto.trim();
		npMarca = '';
		npCategoria = categoriaNombres[0] ?? '';
		npPrecio = '';
		productoDialogOpen = true;
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
				if (!marcasList.some((m) => m.id === creado.id)) marcasList = [...marcasList, creado];
			} else if (!categoriasList.some((c) => c.id === creado.id)) {
				categoriasList = [...categoriasList, creado];
			}
		} catch {
			// El producto igual podrá crearse: el servidor resuelve o crea la marca/categoría por nombre.
		}
	}

	async function handleGuardarProducto(event: SubmitEvent) {
		event.preventDefault();

		if (!npNombre.trim() || !npCategoria.trim() || !npPrecio || Number(npPrecio) < 0) {
			toast.error('Completa el nombre, categoría y precio del producto');
			return;
		}

		guardandoProducto = true;
		try {
			const res = await fetch('/api/productos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					nombre: npNombre.trim(),
					marca: npMarca.trim() || undefined,
					categoria: npCategoria.trim(),
					codigoBarras: null,
					presentaciones: [
						{ nombre: 'Unidad', factorUnidades: 1, precio: Number(npPrecio), cantidadInicial: 0 }
					]
				})
			});

			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo crear el producto');
				return;
			}

			const nuevoProducto = (await res.json()) as ProductoDTO;
			productos = [...productos, nuevoProducto];
			agregarLinea(nuevoProducto);
			toast.success('Producto creado y agregado al pedido');
			productoDialogOpen = false;
		} finally {
			guardandoProducto = false;
		}
	}
</script>

<svelte:head>
	<title>Pedidos · La Central</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Pedidos' }]} />

	<header class="flex items-center justify-between">
		<div>
			<h1 class="title">Ingreso de Mercadería</h1>
			<p class="mt-1 text-sm text-stone-400">Registra los pedidos a tus proveedores.</p>
		</div>
		<button
			type="button"
			onclick={abrirDialog}
			class="cursor-pointer rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-extrabold text-white transition-colors hover:bg-emerald-600"
		>
			Nuevo Pedido
		</button>
	</header>

	<section
		aria-labelledby="pedidos-heading"
		class="flex flex-1 flex-col gap-4 rounded-2xl bg-white p-6"
	>
		<h2 id="pedidos-heading" class="sr-only">Listado de pedidos</h2>
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-stone-100 text-left text-xs text-stone-400 uppercase">
					<th class="py-2 font-bold">Código</th>
					<th class="py-2 font-bold">Proveedor</th>
					<th class="py-2 font-bold">Fecha</th>
					<th class="py-2 font-bold">Productos</th>
					<th class="py-2 text-right font-bold">Total</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-stone-100">
				{#if pedidosLista.length === 0}
					<tr>
						<td colspan="5" class="py-8 text-center text-sm text-stone-400">
							{cargando ? 'Cargando…' : 'Todavía no hay pedidos registrados'}
						</td>
					</tr>
				{/if}
				{#each pedidosLista as pedido (pedido.id)}
					<tr>
						<td class="py-3 font-medium text-stone-700">{pedido.codigo || '—'}</td>
						<td class="py-3 text-stone-500">{pedido.proveedorNombre}</td>
						<td class="py-3 text-stone-500">{formatFechaHora(pedido.fecha)}</td>
						<td class="py-3 text-stone-500">
							{pedido.items.length} producto{pedido.items.length === 1 ? '' : 's'}
						</td>
						<td class="py-3 text-right font-bold text-stone-800">{currency(pedido.total)}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<div class="mt-auto flex items-center justify-between border-t border-stone-100 pt-4">
			<p class="text-sm text-stone-400">
				{#if total === 0}
					0 pedidos
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

<Dialog bind:open={dialogOpen} title="Nuevo Pedido" class="max-w-2xl">
	<p class="-mt-4 flex items-center gap-2 text-sm text-stone-400">
		<Truck size={16} />
		Ingreso de mercadería: al guardar, el stock de cada producto se actualiza automáticamente.
	</p>
	<form onsubmit={handleGuardar} class="flex flex-col gap-4">
		<div class="grid grid-cols-3 gap-3">
			<div class="col-span-2 flex flex-col gap-1.5">
				<label for="proveedor" class="text-sm font-bold text-stone-800">Proveedor</label>
				<Combobox
					id="proveedor"
					bind:value={nuevoProveedor}
					items={proveedorNombres}
					placeholder="Buscar o crear proveedor…"
					oncreate={crearProveedor}
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<label for="fecha" class="text-sm font-bold text-stone-800">Fecha</label>
				<input id="fecha" type="date" bind:value={nuevaFecha} class="input" />
			</div>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="codigo" class="text-sm font-bold text-stone-800">Código de pedido</label>
			<Input id="codigo" bind:value={nuevoCodigo} placeholder="Generado automáticamente" />
		</div>

		<div class="flex flex-col gap-2">
			<div class="flex items-center justify-between">
				<span class="text-sm font-bold text-stone-800">Productos</span>
				<button type="button" onclick={abrirDialogProducto} class="link text-xs">
					<Plus size={12} strokeWidth={3} />
					Crear producto nuevo
				</button>
			</div>
			<div class="relative">
				<Input bind:value={busquedaProducto} placeholder="Buscar producto para agregar…">
					{#snippet icon()}
						<Search size={16} />
					{/snippet}
				</Input>
				{#if busquedaProducto.trim() && productosFiltrados.length > 0}
					<div
						class="absolute top-full right-0 left-0 z-20 mt-1 max-h-48 overflow-auto rounded-xl bg-white p-1 shadow-xl"
					>
						{#each productosFiltrados as producto (producto.id)}
							<button
								type="button"
								onclick={() => agregarLinea(producto)}
								class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-100"
							>
								<Package size={14} class="text-stone-400" />
								{producto.nombre}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			{#if lineas.length === 0}
				<p class="rounded-xl bg-stone-100 px-4 py-6 text-center text-sm text-stone-400">
					Busca y agrega productos al pedido
				</p>
			{:else}
				<div class="flex flex-col gap-2">
					{#each lineas as linea, index (linea.productoId)}
						<div class="flex items-center gap-2 rounded-xl bg-stone-100 p-3">
							<span class="min-w-0 flex-1 truncate text-sm font-bold text-stone-800"
								>{linea.productoNombre}</span
							>
							<select bind:value={linea.presentacionId} class="input w-32 shrink-0 py-2 text-sm">
								{#each presentacionesDe(linea.productoId) as p (p.id)}
									<option value={p.id}>{p.nombre}</option>
								{/each}
							</select>
							<input
								type="number"
								min="1"
								step="1"
								inputmode="numeric"
								placeholder="Cant."
								bind:value={linea.cantidad}
								class="input w-20 shrink-0 py-2 text-sm"
							/>
							<MoneyInput bind:value={linea.costoUnitario} class="w-28 shrink-0 py-2 text-sm" />
							<button
								type="button"
								onclick={() => quitarLinea(index)}
								class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
								aria-label="Quitar producto"
							>
								<Trash2 size={16} />
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="flex items-center justify-between text-lg font-extrabold text-stone-800">
			<span>Total del pedido</span>
			<span>{currency(totalPedido)}</span>
		</div>

		<div class="flex flex-col gap-1">
			<label for="notas" class="text-xs font-medium text-stone-400">Notas (opcional)</label>
			<input
				id="notas"
				type="text"
				bind:value={nuevasNotas}
				placeholder="Ej. entregado incompleto, pagar la próxima semana…"
				class="rounded-lg border-none bg-transparent px-0 py-1 text-sm text-stone-500 outline-none placeholder:text-stone-300 focus:ring-0"
			/>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<Button type="button" variant="danger" onclick={() => (dialogOpen = false)}>Cancelar</Button>
			<Button type="submit" variant="success" disabled={guardando}>
				{guardando ? 'Guardando…' : 'Registrar Pedido'}
			</Button>
		</div>
	</form>
</Dialog>

<Dialog bind:open={productoDialogOpen} title="Nuevo producto" class="max-w-lg">
	<p class="-mt-4 text-sm text-stone-400">
		Se crea con una presentación base "Unidad" y sin stock; el stock lo agrega este mismo pedido.
	</p>
	<form onsubmit={handleGuardarProducto} class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label for="np-nombre" class="text-sm font-bold text-stone-800">Nombre del producto</label>
			<Input id="np-nombre" bind:value={npNombre} placeholder="Colocar nombre del producto" />
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div class="flex flex-col gap-1.5">
				<label for="np-marca" class="text-sm font-bold text-stone-800">Marca (opcional)</label>
				<Combobox
					id="np-marca"
					bind:value={npMarca}
					items={marcaNombres}
					placeholder="Buscar o crear marca…"
					oncreate={(nombre) => crearOpcion('marca', nombre)}
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<label for="np-categoria" class="text-sm font-bold text-stone-800">Categoría</label>
				<Combobox
					id="np-categoria"
					bind:value={npCategoria}
					items={categoriaNombres}
					placeholder="Buscar o crear categoría…"
					oncreate={(nombre) => crearOpcion('categoria', nombre)}
				/>
			</div>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="np-precio" class="text-sm font-bold text-stone-800">Precio de venta (Unidad)</label>
			<MoneyInput id="np-precio" bind:value={npPrecio} />
		</div>

		<div class="grid grid-cols-2 gap-3">
			<Button type="button" variant="danger" onclick={() => (productoDialogOpen = false)}
				>Cancelar</Button
			>
			<Button type="submit" variant="success" disabled={guardandoProducto}>
				{guardandoProducto ? 'Creando…' : 'Crear y agregar'}
			</Button>
		</div>
	</form>
</Dialog>
