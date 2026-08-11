<script lang="ts">
	import { goto } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import {
		Plus,
		Minus,
		Trash2,
		ShoppingCart,
		Search,
		Banknote,
		Smartphone,
		CreditCard
	} from '@lucide/svelte';
	import { Button, Input } from '$lib/components/ui';
	import { caja, type MetodoPago, type TipoComprobante } from '$lib/stores/caja.svelte';
	import { currency } from '$lib/utils';
	import Breadcrumbs from '$lib/components/ui/Breadcrumbs.svelte';
	import type { PageData } from './$types';
	import type { ProductoDTO } from '$lib/server/productos';

	let { data }: { data: PageData } = $props();

	let productos = $state<ProductoDTO[]>(data.productos);

	$effect(() => {
		if (!caja.abierta) {
			toast.error('Abre la caja antes de registrar una venta');
			goto('/dashboard');
		}
	});

	let busquedaProducto = $state('');
	const productosFiltrados = $derived(
		productos.filter((p) => {
			const q = busquedaProducto.trim().toLowerCase();
			if (!q) return true;
			return p.nombre.toLowerCase().includes(q) || (p.codigoBarras ?? '').toLowerCase().includes(q);
		})
	);

	const metodosPago: { valor: MetodoPago; icon: typeof Banknote }[] = [
		{ valor: 'Efectivo', icon: Banknote },
		{ valor: 'Yape', icon: Smartphone },
		{ valor: 'Tarjeta', icon: CreditCard }
	];
	const tiposComprobante: TipoComprobante[] = ['Boleta', 'Factura'];

	// key del carrito: `${productoId}::${precioId}`, así cada tarifa de precio es su propia línea.
	let carrito = $state<Record<string, number>>({});
	let precioSeleccionado = $state<Record<string, string>>({});

	function precioActivo(producto: ProductoDTO) {
		const seleccionadoId = precioSeleccionado[producto.id];
		return producto.precios.find((p) => p.id === seleccionadoId) ?? producto.precios[0];
	}

	function stockEnCarrito(productoId: string) {
		const prefijo = `${productoId}::`;
		return Object.entries(carrito).reduce(
			(acc, [key, cantidad]) => (key.startsWith(prefijo) ? acc + cantidad : acc),
			0
		);
	}

	const items = $derived(
		Object.entries(carrito)
			.filter(([, cantidad]) => cantidad > 0)
			.map(([key, cantidad]) => {
				const [productoId, precioId] = key.split('::');
				const producto = productos.find((p) => p.id === productoId);
				const precio = producto?.precios.find((p) => p.id === precioId);
				if (!producto || !precio) return null;
				return {
					key,
					productoId,
					nombre: producto.nombre + (producto.precios.length > 1 ? ` (${precio.nombre})` : ''),
					precioUnitario: precio.valor,
					cantidad,
					subtotal: cantidad * precio.valor
				};
			})
			.filter((item) => item !== null)
	);
	const totalItems = $derived(items.reduce((acc, i) => acc + i.cantidad, 0));
	const total = $derived(items.reduce((acc, i) => acc + i.subtotal, 0));

	function agregar(producto: ProductoDTO) {
		const precio = precioActivo(producto);
		if (!precio) {
			toast.error('Este producto no tiene un precio configurado');
			return;
		}
		if (stockEnCarrito(producto.id) >= producto.cantidad) {
			toast.error('No hay más stock disponible');
			return;
		}
		const key = `${producto.id}::${precio.id}`;
		carrito[key] = (carrito[key] ?? 0) + 1;
	}

	function quitarUno(key: string) {
		if (!carrito[key]) return;
		carrito[key] -= 1;
		if (carrito[key] <= 0) delete carrito[key];
	}

	function eliminarItem(key: string) {
		delete carrito[key];
	}

	let metodoPago: MetodoPago = $state('Efectivo');
	let comprobante: TipoComprobante = $state('Boleta');
	let cliente = $state('');
	let documento = $state('');

	async function handleCobrar(event: SubmitEvent) {
		event.preventDefault();
		if (items.length === 0) {
			toast.error('Agrega al menos un producto');
			return;
		}

		const descripcion = `${totalItems} producto${totalItems === 1 ? '' : 's'}`;
		const itemsVenta = items.map((item) => ({
			nombre: item.nombre,
			cantidad: item.cantidad,
			precioUnitario: item.precioUnitario
		}));

		caja.registrarVenta({
			metodo: metodoPago,
			monto: total,
			descripcion,
			cliente: cliente.trim() || undefined,
			comprobante,
			numeroDocumento: documento.trim() || undefined,
			items: itemsVenta
		});

		try {
			await fetch('/api/ventas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					metodo: metodoPago,
					comprobante,
					numeroDocumento: documento.trim() || null,
					cliente: cliente.trim() || null,
					total,
					items: itemsVenta
				})
			});
		} catch {
			toast.error('La venta se registró en caja, pero no se pudo guardar en la base de datos');
		}

		const cantidadPorProducto = new Map<string, number>();
		for (const item of items) {
			cantidadPorProducto.set(
				item.productoId,
				(cantidadPorProducto.get(item.productoId) ?? 0) + item.cantidad
			);
		}
		await Promise.all(
			[...cantidadPorProducto.entries()].map(([productoId, cantidad]) =>
				fetch(`/api/productos/${productoId}/stock`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ delta: -cantidad })
				})
			)
		);
		for (const [productoId, cantidad] of cantidadPorProducto) {
			const producto = productos.find((p) => p.id === productoId);
			if (producto) producto.cantidad = Math.max(0, producto.cantidad - cantidad);
		}

		toast.success(`Venta registrada: ${currency(total)}`);
		carrito = {};
		cliente = '';
		documento = '';
	}

	// --- Escáner de código de barras USB (emula teclado: escribe rápido y termina con Enter) ---
	let bufferCodigo = '';
	let ultimaTeclaTs = 0;
	const INTERVALO_MAX_MS = 50;

	async function manejarCodigoEscaneado(codigo: string) {
		const local = productos.find((p) => p.codigoBarras === codigo);
		if (local) {
			agregar(local);
			toast.success(`Escaneado: ${local.nombre}`);
			return;
		}
		try {
			const res = await fetch(`/api/productos/buscar-codigo?codigo=${encodeURIComponent(codigo)}`);
			if (!res.ok) {
				toast.error(`Sin coincidencias para el código ${codigo}`);
				return;
			}
			const producto = (await res.json()) as ProductoDTO;
			productos = [...productos, producto];
			agregar(producto);
			toast.success(`Escaneado: ${producto.nombre}`);
		} catch {
			toast.error('No se pudo buscar el código escaneado');
		}
	}

	function handleKeydownGlobal(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		const escribiendoEnCampo =
			target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
		if (escribiendoEnCampo) return;

		const ahora = Date.now();
		if (ahora - ultimaTeclaTs > INTERVALO_MAX_MS) bufferCodigo = '';
		ultimaTeclaTs = ahora;

		if (event.key === 'Enter') {
			const codigo = bufferCodigo;
			bufferCodigo = '';
			if (codigo.length >= 4) {
				event.preventDefault();
				manejarCodigoEscaneado(codigo);
			}
			return;
		}

		if (event.key.length === 1) {
			bufferCodigo += event.key;
		}
	}
</script>

<svelte:head>
	<title>Nueva venta · La tiendita</title>
</svelte:head>

<svelte:window onkeydown={handleKeydownGlobal} />

<main class="flex max-h-screen flex-1 flex-col gap-6 p-6">
	<Breadcrumbs
		items={[
			{ label: 'Dashboard', href: '/dashboard' },
			{ label: 'Ventas', href: '/dashboard/ventas' },
			{ label: 'Nueva Venta' }
		]}
	/>

	<header class="flex items-center justify-between">
		<div class="flex grow flex-col gap-1">
			<h1 class="title">Nueva Venta</h1>
			<p class="text-sm text-stone-400">Selecciona los productos, escanea o cobra.</p>
		</div>
	</header>

	<div class="flex flex-1 gap-6">
		<section
			aria-labelledby="productos-heading"
			class="flex flex-1 flex-col gap-4 rounded-2xl bg-white p-6"
		>
			<div class="flex items-center justify-between">
				<h2 id="productos-heading" class="text-lg font-extrabold text-stone-800">Productos</h2>
				<div class="w-64">
					<Input
						bind:value={busquedaProducto}
						placeholder="Buscar por nombre o código…"
						type="text"
					>
						{#snippet icon()}
							<Search size={16} />
						{/snippet}
					</Input>
				</div>
			</div>
			<div class="grid grid-cols-4 gap-3 overflow-auto">
				{#each productosFiltrados as producto (producto.id)}
					{@const precio = precioActivo(producto)}
					{@const sinStock =
						producto.cantidad === 0 || stockEnCarrito(producto.id) >= producto.cantidad}
					<div
						class="flex flex-col gap-2 rounded-xl bg-stone-100 p-4 {sinStock ? 'opacity-40' : ''}"
					>
						<button
							type="button"
							disabled={sinStock}
							onclick={() => agregar(producto)}
							class="flex flex-col items-start gap-1 text-left {sinStock
								? 'cursor-not-allowed'
								: 'cursor-pointer'}"
						>
							<span class="font-bold text-stone-800">{producto.nombre}</span>
							<span class="text-sm font-bold text-stone-500">{currency(precio?.valor ?? 0)}</span>
						</button>
						{#if producto.precios.length > 1}
							<select
								value={precioSeleccionado[producto.id] ?? producto.precios[0].id}
								onchange={(event) => (precioSeleccionado[producto.id] = event.currentTarget.value)}
								class="w-full cursor-pointer rounded-lg bg-stone-200 px-2 py-1 text-xs font-bold text-stone-700"
							>
								{#each producto.precios as p (p.id)}
									<option value={p.id}>{p.nombre} — {currency(p.valor)}</option>
								{/each}
							</select>
						{/if}
					</div>
				{/each}
			</div>
		</section>

		<aside
			aria-labelledby="carrito-heading"
			class="flex w-96 shrink-0 flex-col gap-4 rounded-2xl bg-stone-800 p-6 text-stone-50"
		>
			<h2 id="carrito-heading" class="flex items-center gap-2 text-lg font-extrabold">
				<ShoppingCart size={20} strokeWidth={2.5} />
				Resumen de la venta
			</h2>

			<div class="flex flex-1 flex-col gap-2 overflow-auto">
				{#if items.length === 0}
					<p class="mt-8 text-center text-sm text-stone-400">
						Toca o escanea un producto para agregarlo
					</p>
				{:else}
					{#each items as item (item.key)}
						<div class="flex items-center gap-3 rounded-xl bg-stone-800 p-3">
							<div class="flex-1">
								<p class="font-bold">{item.nombre}</p>
								<p class="text-xs text-stone-400">{currency(item.precioUnitario)} c/u</p>
							</div>
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => quitarUno(item.key)}
									class="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-stone-700 hover:bg-stone-600"
									aria-label="Quitar uno"
								>
									<Minus size={14} strokeWidth={3} />
								</button>
								<span class="w-4 text-center text-sm font-bold tabular-nums">{item.cantidad}</span>
								<button
									type="button"
									onclick={() => {
										const producto = productos.find((p) => p.id === item.productoId);
										if (producto) agregar(producto);
									}}
									class="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-stone-700 hover:bg-stone-600"
									aria-label="Agregar uno"
								>
									<Plus size={14} strokeWidth={3} />
								</button>
							</div>
							<p class="w-16 text-right text-sm font-bold">{currency(item.subtotal)}</p>
							<button
								type="button"
								onclick={() => eliminarItem(item.key)}
								class="cursor-pointer text-stone-500 hover:text-red-400"
								aria-label="Eliminar producto"
							>
								<Trash2 size={16} />
							</button>
						</div>
					{/each}
				{/if}
			</div>

			<form onsubmit={handleCobrar} class="flex flex-col gap-3 border-t border-stone-700 pt-4">
				<div class="flex flex-col gap-1.5">
					<span class="text-sm font-bold">Método de pago</span>
					<div class="grid grid-cols-3 gap-2">
						{#each metodosPago as metodo (metodo.valor)}
							<button
								type="button"
								onclick={() => (metodoPago = metodo.valor)}
								class="flex cursor-pointer flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-xs font-bold transition-colors {metodoPago ===
								metodo.valor
									? 'bg-yellow-400 text-stone-900'
									: 'bg-stone-700 text-stone-300 hover:bg-stone-600'}"
							>
								<metodo.icon size={16} strokeWidth={2.5} />
								{metodo.valor}
							</button>
						{/each}
					</div>
				</div>

				<div class="flex flex-col gap-1.5">
					<span class="text-sm font-bold">Comprobante</span>
					<div class="grid grid-cols-2 gap-2">
						{#each tiposComprobante as tipo (tipo)}
							<button
								type="button"
								onclick={() => (comprobante = tipo)}
								class="cursor-pointer rounded-xl px-2 py-2.5 text-xs font-bold transition-colors {comprobante ===
								tipo
									? 'bg-yellow-400 text-stone-900'
									: 'bg-stone-700 text-stone-300 hover:bg-stone-600'}"
							>
								{tipo}
							</button>
						{/each}
					</div>
				</div>

				<div class="flex flex-col gap-1.5">
					<label for="cliente" class="text-sm font-bold">Cliente</label>
					<input
						id="cliente"
						type="text"
						placeholder={comprobante === 'Boleta' ? 'Nombre del cliente' : 'Razón Social'}
						bind:value={cliente}
						class="input"
					/>
				</div>

				{#if cliente}
					<div class="flex flex-col gap-1.5">
						<label for="cliente" class="text-sm font-bold">
							{comprobante === 'Boleta' ? 'DNI' : 'RUC'}
						</label>
						<input
							id="documento"
							type="text"
							placeholder="Número de documento"
							bind:value={documento}
							class="input"
						/>
					</div>
				{/if}

				<div class="flex items-center justify-between text-lg font-extrabold">
					<span>Total</span>
					<span>{currency(total)}</span>
				</div>

				<Button type="submit" variant="success">Cobrar {currency(total)}</Button>
			</form>
		</aside>
	</div>
</main>
