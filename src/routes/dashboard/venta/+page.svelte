<script lang="ts">
	import { tick } from 'svelte';
	import { goto, invalidate } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import {
		Plus,
		Minus,
		Trash2,
		ShoppingCart,
		Search,
		Banknote,
		Smartphone,
		CreditCard,
		Printer,
		CircleCheck,
		Tag
	} from '@lucide/svelte';
	import { Button, Input, Dialog } from '$lib/components/ui';
	import { currency } from '$lib/utils';
	import Breadcrumbs from '$lib/components/ui/Breadcrumbs.svelte';
	import TicketImpresion from '$lib/components/TicketImpresion.svelte';
	import type { VentaTicket } from '$lib/types/ticket';
	import type { PageData } from './$types';
	import type { ProductoDTO } from '$lib/server/productos';
	import type { PromoDTO } from '$lib/server/promos';
	import type { TipoVenta } from '$lib/server/ventas';

	type MetodoPago = 'Efectivo' | 'Yape' | 'Tarjeta';

	let { data }: { data: PageData } = $props();

	let productos = $state<ProductoDTO[]>(data.productos);
	let promos = $state<PromoDTO[]>(data.promos);

	$effect(() => {
		if (!data.sesionActual) {
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
	const tiposVenta: { valor: TipoVenta; label: string }[] = [
		{ valor: 'nota_pedido', label: 'Nota de Pedido' },
		{ valor: 'boleta', label: 'Boleta de Venta' }
	];

	// key del carrito: `${productoId}::${presentacionId}` para productos, `promo::${promoId}` para promos.
	let carrito = $state<
		Record<string, { tipo: 'producto' | 'promo'; cantidad: number; precioUnitario: number }>
	>({});
	let presentacionSeleccionada = $state<Record<string, string>>({});

	function presentacionActiva(producto: ProductoDTO) {
		const seleccionadaId = presentacionSeleccionada[producto.id];
		return (
			producto.presentaciones.find((p) => p.id === seleccionadaId) ?? producto.presentaciones[0]
		);
	}

	function stockDisponible(producto: ProductoDTO, presentacionId: string) {
		const presentacion = producto.presentaciones.find((p) => p.id === presentacionId);
		if (!presentacion) return 0;
		const enCarrito = carrito[`${producto.id}::${presentacionId}`]?.cantidad ?? 0;
		return presentacion.cantidad - enCarrito;
	}

	function promoDisponible(promo: PromoDTO) {
		const enCarrito = carrito[`promo::${promo.id}`]?.cantidad ?? 0;
		return promo.stockDisponible - enCarrito;
	}

	const items = $derived(
		Object.entries(carrito)
			.filter(([, linea]) => linea.cantidad > 0)
			.map(([key, linea]) => {
				if (linea.tipo === 'promo') {
					const promoId = key.slice('promo::'.length);
					const promo = promos.find((p) => p.id === promoId);
					if (!promo) return null;
					return {
						key,
						tipo: 'promo' as const,
						promoId,
						nombre: promo.nombre,
						cantidad: linea.cantidad,
						precioUnitario: linea.precioUnitario,
						subtotal: linea.cantidad * linea.precioUnitario
					};
				}
				const [productoId, presentacionId] = key.split('::');
				const producto = productos.find((p) => p.id === productoId);
				const presentacion = producto?.presentaciones.find((p) => p.id === presentacionId);
				if (!producto || !presentacion) return null;
				return {
					key,
					tipo: 'producto' as const,
					productoId,
					presentacionId,
					nombre:
						producto.nombre +
						(producto.presentaciones.length > 1 ? ` (${presentacion.nombre})` : ''),
					cantidad: linea.cantidad,
					precioUnitario: linea.precioUnitario,
					subtotal: linea.cantidad * linea.precioUnitario
				};
			})
			.filter((item) => item !== null)
	);
	const total = $derived(items.reduce((acc, i) => acc + i.subtotal, 0));

	function agregar(producto: ProductoDTO) {
		const presentacion = presentacionActiva(producto);
		if (!presentacion) {
			toast.error('Este producto no tiene una presentación configurada');
			return;
		}
		if (stockDisponible(producto, presentacion.id) <= 0) {
			toast.error('No hay más stock disponible en esa presentación');
			return;
		}
		const key = `${producto.id}::${presentacion.id}`;
		if (carrito[key]) {
			carrito[key].cantidad += 1;
		} else {
			carrito[key] = { tipo: 'producto', cantidad: 1, precioUnitario: presentacion.precio };
		}
	}

	function agregarPromo(promo: PromoDTO) {
		if (promoDisponible(promo) <= 0) {
			toast.error('No hay más stock disponible para esta promo');
			return;
		}
		const key = `promo::${promo.id}`;
		if (carrito[key]) {
			carrito[key].cantidad += 1;
		} else {
			carrito[key] = { tipo: 'promo', cantidad: 1, precioUnitario: promo.precio };
		}
	}

	function quitarUno(key: string) {
		if (!carrito[key]) return;
		carrito[key].cantidad -= 1;
		if (carrito[key].cantidad <= 0) delete carrito[key];
	}

	function sumarUno(key: string) {
		if (key.startsWith('promo::')) {
			const promoId = key.slice('promo::'.length);
			const promo = promos.find((p) => p.id === promoId);
			if (!promo || promoDisponible(promo) <= 0) {
				toast.error('No hay más stock disponible para esta promo');
				return;
			}
			carrito[key].cantidad += 1;
			return;
		}
		const [productoId, presentacionId] = key.split('::');
		const producto = productos.find((p) => p.id === productoId);
		if (!producto || stockDisponible(producto, presentacionId) <= 0) {
			toast.error('No hay más stock disponible en esa presentación');
			return;
		}
		carrito[key].cantidad += 1;
	}

	function eliminarItem(key: string) {
		delete carrito[key];
	}

	let metodoPago: MetodoPago = $state('Efectivo');
	let tipoVenta: TipoVenta = $state('nota_pedido');
	let cliente = $state('');
	let documento = $state('');
	let enviando = $state(false);

	const TIPO_LABEL: Record<TipoVenta, string> = {
		boleta: 'Boleta de Venta',
		nota_pedido: 'Nota de Pedido'
	};

	let ventaExitosaOpen = $state(false);
	let ventaRegistrada = $state<VentaTicket | null>(null);

	async function handleCobrar(event: SubmitEvent) {
		event.preventDefault();
		if (items.length === 0) {
			toast.error('Agrega al menos un producto');
			return;
		}

		const itemsVenta = items.map((item) =>
			item.tipo === 'promo'
				? {
						tipo: 'promo' as const,
						promoId: item.promoId,
						cantidad: item.cantidad,
						precioUnitario: item.precioUnitario
					}
				: {
						tipo: 'producto' as const,
						productoId: item.productoId,
						presentacionId: item.presentacionId,
						cantidad: item.cantidad,
						precioUnitario: item.precioUnitario
					}
		);

		enviando = true;
		try {
			const res = await fetch('/api/ventas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tipo: tipoVenta,
					metodo: metodoPago,
					numeroDocumento: documento.trim() || null,
					cliente: cliente.trim() || null,
					total,
					items: itemsVenta
				})
			});
			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo registrar la venta');
				return;
			}
			await Promise.all([invalidate('caja:sesion'), invalidate('productos:stock')]);

			const ahora = new Date();
			ventaRegistrada = {
				tipo: TIPO_LABEL[tipoVenta],
				numeroDocumento: documento.trim() || null,
				cliente: cliente.trim() || null,
				fechaLabel: ahora.toLocaleDateString('es-PE', {
					day: '2-digit',
					month: '2-digit',
					year: 'numeric'
				}),
				horaLabel: ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
				pago: metodoPago,
				items: items.map((item) => ({
					id: item.key,
					cantidad: item.cantidad,
					nombreProducto: item.nombre,
					precioUnitario: item.precioUnitario
				})),
				total
			};
			ventaExitosaOpen = true;
			carrito = {};
			cliente = '';
			documento = '';
		} catch {
			toast.error('No se pudo registrar la venta');
		} finally {
			enviando = false;
		}
	}

	async function imprimirVentaRegistrada() {
		await tick();
		window.print();
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
	<title>Nueva venta · La Central</title>
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
			<p class="text-sm text-stone-400">Elige una promo, busca un producto o escanea.</p>
		</div>
	</header>

	<div class="flex flex-1 gap-6">
		<section
			aria-labelledby="productos-heading"
			class="flex flex-1 flex-col gap-4 rounded-2xl bg-white p-6"
		>
			<div class="flex items-center justify-between">
				<h2 id="productos-heading" class="text-lg font-extrabold text-stone-800">
					{busquedaProducto.trim() ? 'Productos' : 'Promos'}
				</h2>
				<div class="w-64">
					<Input
						bind:value={busquedaProducto}
						placeholder="Buscar producto o escanea un código…"
						type="text"
					>
						{#snippet icon()}
							<Search size={16} />
						{/snippet}
					</Input>
				</div>
			</div>

			{#if busquedaProducto.trim()}
				<div class="grid grid-cols-4 gap-3 overflow-auto">
					{#each productosFiltrados as producto (producto.id)}
						{@const presentacion = presentacionActiva(producto)}
						{@const sinStock = !presentacion || stockDisponible(producto, presentacion.id) <= 0}
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
								<span class="text-sm font-bold text-stone-500"
									>{currency(presentacion?.precio ?? 0)}</span
								>
							</button>
							{#if producto.presentaciones.length > 1}
								<select
									value={presentacionSeleccionada[producto.id] ?? producto.presentaciones[0].id}
									onchange={(event) =>
										(presentacionSeleccionada[producto.id] = event.currentTarget.value)}
									class="w-full cursor-pointer rounded-lg bg-stone-200 px-2 py-1 text-xs font-bold text-stone-700"
								>
									{#each producto.presentaciones as p (p.id)}
										<option value={p.id}
											>{p.nombre} — {currency(p.precio)} ({p.cantidad} disp.)</option
										>
									{/each}
								</select>
							{/if}
						</div>
					{/each}
				</div>
			{:else if promos.length === 0}
				<p class="mt-8 text-center text-sm text-stone-400">
					No hay promos creadas todavía. Puedes crear una desde Inventario → Promos, o buscar un
					producto arriba.
				</p>
			{:else}
				<div class="grid grid-cols-4 gap-3 overflow-auto">
					{#each promos as promo (promo.id)}
						{@const sinStock = promoDisponible(promo) <= 0}
						<button
							type="button"
							disabled={sinStock}
							onclick={() => agregarPromo(promo)}
							class="flex flex-col items-start gap-1 rounded-xl bg-yellow-50 p-4 text-left ring-2 ring-yellow-200 {sinStock
								? 'cursor-not-allowed opacity-40'
								: 'cursor-pointer hover:bg-yellow-100'}"
						>
							<span class="flex items-center gap-1.5 text-xs font-bold text-yellow-600 uppercase">
								<Tag size={12} strokeWidth={3} />
								Promo
							</span>
							<span class="font-bold text-stone-800">{promo.nombre}</span>
							<span class="text-sm font-bold text-stone-500">{currency(promo.precio)}</span>
						</button>
					{/each}
				</div>
			{/if}
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
								<p class="flex items-center gap-1.5 font-bold">
									{#if item.tipo === 'promo'}
										<Tag size={13} class="shrink-0 text-yellow-400" />
									{/if}
									{item.nombre}
								</p>
								<div class="mt-1 flex items-center gap-1 text-xs text-stone-400">
									<span>S/</span>
									<input
										type="number"
										min="0"
										step="0.10"
										value={item.precioUnitario}
										onchange={(event) =>
											(carrito[item.key].precioUnitario = Number(event.currentTarget.value) || 0)}
										class="w-16 rounded bg-stone-700 px-1.5 py-0.5 text-stone-100 outline-none focus:ring-2 focus:ring-yellow-400"
									/>
									<span>c/u</span>
								</div>
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
									onclick={() => sumarUno(item.key)}
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
					<span class="text-sm font-bold">Tipo de venta</span>
					<div class="grid grid-cols-2 gap-2">
						{#each tiposVenta as tipo (tipo.valor)}
							<button
								type="button"
								onclick={() => (tipoVenta = tipo.valor)}
								class="cursor-pointer rounded-xl px-2 py-2.5 text-xs font-bold transition-colors {tipoVenta ===
								tipo.valor
									? 'bg-yellow-400 text-stone-900'
									: 'bg-stone-700 text-stone-300 hover:bg-stone-600'}"
							>
								{tipo.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="flex flex-col gap-1.5">
					<label for="cliente" class="text-sm font-bold">Cliente</label>
					<input
						id="cliente"
						type="text"
						placeholder={tipoVenta === 'boleta' ? 'Nombre del cliente' : 'Nombre o razón social'}
						bind:value={cliente}
						class="input"
					/>
				</div>

				{#if cliente}
					<div class="flex flex-col gap-1.5">
						<label for="documento" class="text-sm font-bold">
							{tipoVenta === 'boleta' ? 'DNI' : 'RUC / DNI'}
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

				<Button type="submit" variant="success" disabled={enviando}>
					{enviando ? 'Procesando…' : `Cobrar ${currency(total)}`}
				</Button>
			</form>
		</aside>
	</div>
</main>

<Dialog bind:open={ventaExitosaOpen} title="Venta registrada">
	<div class="-mt-2 flex items-start gap-3">
		<span
			class="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-500"
		>
			<CircleCheck size={18} strokeWidth={2.5} />
		</span>
		<p class="mt-1.5 text-sm text-stone-500">
			Se registró la venta por {currency(ventaRegistrada?.total ?? 0)}.
		</p>
	</div>
	<div class="grid grid-cols-2 gap-3">
		<Button type="button" variant="secondary" onclick={() => (ventaExitosaOpen = false)}>
			Cerrar
		</Button>
		<Button type="button" variant="success" onclick={imprimirVentaRegistrada}>
			<Printer size={16} />
			Imprimir
		</Button>
	</div>
</Dialog>

<TicketImpresion venta={ventaRegistrada} />
