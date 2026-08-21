<script lang="ts">
	import toast from 'svelte-french-toast';
	import { Search, Trash2, ChevronLeft, ChevronRight, Package, Truck } from '@lucide/svelte';
	import { Button, Dialog, Input, Combobox, MoneyInput, Breadcrumbs } from '$lib/components/ui';
	import { currency, formatFechaHora } from '$lib/utils';
	import type { PageData } from './$types';
	import type { PedidoDTO } from '$lib/server/pedidos';
	import type { ProductoDTO, OpcionSimple } from '$lib/server/productos';

	let { data }: { data: PageData } = $props();

	const pageSize = data.pageSize;
	const productos = data.productos;

	let pedidosLista = $state<PedidoDTO[]>(data.pedidos);
	let total = $state(data.total);
	let proveedoresList = $state<OpcionSimple[]>(data.proveedores);
	let pagina = $state(1);
	let cargando = $state(false);

	const totalPaginas = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const proveedorNombres = $derived(proveedoresList.map((p) => p.nombre));

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
		nuevoCodigo = '';
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

			const resPedido = await fetch('/api/pedidos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					codigo: nuevoCodigo.trim() || null,
					proveedorId: proveedor.id,
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
</script>

<svelte:head>
	<title>Pedidos · La tiendita</title>
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

<Dialog bind:open={dialogOpen} title="Nuevo Pedido">
	<p class="-mt-4 flex items-center gap-2 text-sm text-stone-400">
		<Truck size={16} />
		Ingreso de mercadería: al guardar, el stock de cada producto se actualiza automáticamente.
	</p>
	<form onsubmit={handleGuardar} class="flex flex-col gap-4">
		<div class="grid grid-cols-2 gap-3">
			<div class="flex flex-col gap-1.5">
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
				<label for="codigo" class="text-sm font-bold text-stone-800">Código de pedido</label>
				<Input id="codigo" bind:value={nuevoCodigo} placeholder="Opcional" />
			</div>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="notas" class="text-sm font-bold text-stone-800">Notas (opcional)</label>
			<textarea id="notas" bind:value={nuevasNotas} rows="2" class="input resize-none"></textarea>
		</div>

		<div class="flex flex-col gap-2">
			<span class="text-sm font-bold text-stone-800">Productos</span>
			<div class="relative">
				<Input bind:value={busquedaProducto} placeholder="Buscar producto para agregar…">
					{#snippet icon()}
						<Search size={16} />
					{/snippet}
				</Input>
				{#if productosFiltrados.length > 0}
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
							<span class="flex-1 text-sm font-bold text-stone-800">{linea.productoNombre}</span>
							<select bind:value={linea.presentacionId} class="input w-32 py-2 text-sm">
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
								class="input w-20 py-2 text-sm"
							/>
							<MoneyInput bind:value={linea.costoUnitario} class="w-28 py-2 text-sm" />
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

		<div class="grid grid-cols-2 gap-3">
			<Button type="button" variant="danger" onclick={() => (dialogOpen = false)}>Cancelar</Button>
			<Button type="submit" variant="success" disabled={guardando}>
				{guardando ? 'Guardando…' : 'Registrar Pedido'}
			</Button>
		</div>
	</form>
</Dialog>
