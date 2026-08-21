<script lang="ts">
	import toast from 'svelte-french-toast';
	import { Search, Trash2, Package, Tag, Eye } from '@lucide/svelte';
	import {
		Button,
		Dialog,
		Input,
		MoneyInput,
		Breadcrumbs,
		ConfirmDialog
	} from '$lib/components/ui';
	import { currency } from '$lib/utils';
	import type { PageData } from './$types';
	import type { PromoDTO } from '$lib/server/promos';
	import type { ProductoDTO } from '$lib/server/productos';

	let { data }: { data: PageData } = $props();

	const productos = data.productos;
	let promosLista = $state<PromoDTO[]>(data.promos);

	async function cargarPromos() {
		try {
			const res = await fetch('/api/promos');
			if (!res.ok) throw new Error('request failed');
			promosLista = (await res.json()) as PromoDTO[];
		} catch {
			toast.error('No se pudo cargar las promos');
		}
	}

	interface LineaPromo {
		productoId: string;
		productoNombre: string;
		presentacionId: string;
		precioReferencia: number;
		cantidad: string;
	}

	let dialogOpen = $state(false);
	let guardando = $state(false);
	let nuevoNombre = $state('');
	let nuevoPrecio = $state('');
	let lineas = $state<LineaPromo[]>([]);
	let busquedaProducto = $state('');

	const productosFiltrados = $derived(
		busquedaProducto.trim()
			? productos.filter((p) =>
					p.nombre.toLowerCase().includes(busquedaProducto.trim().toLowerCase())
				)
			: []
	);

	function presentacionesDe(productoId: string) {
		return productos.find((p) => p.id === productoId)?.presentaciones ?? [];
	}

	function abrirDialog() {
		nuevoNombre = '';
		nuevoPrecio = '';
		lineas = [];
		busquedaProducto = '';
		dialogOpen = true;
	}

	function agregarLinea(producto: ProductoDTO) {
		if (lineas.some((l) => l.productoId === producto.id)) {
			toast.error('Ese producto ya está en la promo');
			return;
		}
		const base = producto.presentaciones[0];
		lineas = [
			...lineas,
			{
				productoId: producto.id,
				productoNombre: producto.nombre,
				presentacionId: base?.id ?? '',
				precioReferencia: base?.precio ?? 0,
				cantidad: '1'
			}
		];
		busquedaProducto = '';
	}

	function onPresentacionCambiada(linea: LineaPromo) {
		const presentacion = presentacionesDe(linea.productoId).find(
			(p) => p.id === linea.presentacionId
		);
		linea.precioReferencia = presentacion?.precio ?? 0;
	}

	function quitarLinea(index: number) {
		lineas = lineas.filter((_, i) => i !== index);
	}

	const valorReferencia = $derived(
		lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 0) * l.precioReferencia, 0)
	);

	async function handleGuardar(event: SubmitEvent) {
		event.preventDefault();

		const items = lineas
			.map((l) => ({
				productoId: l.productoId,
				presentacionId: l.presentacionId,
				cantidad: Math.floor(Number(l.cantidad))
			}))
			.filter((i) => i.presentacionId && i.cantidad > 0);

		if (!nuevoNombre.trim() || !nuevoPrecio || Number(nuevoPrecio) < 0 || items.length === 0) {
			toast.error('Completa el nombre, el precio y al menos un producto');
			return;
		}

		guardando = true;
		try {
			const res = await fetch('/api/promos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					nombre: nuevoNombre.trim(),
					precio: Number(nuevoPrecio),
					items
				})
			});

			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo crear la promo');
				return;
			}

			toast.success('Promo creada');
			dialogOpen = false;
			await cargarPromos();
		} finally {
			guardando = false;
		}
	}

	let detalleOpen = $state(false);
	let promoSeleccionada = $state<PromoDTO | null>(null);

	function verDetalle(promo: PromoDTO) {
		promoSeleccionada = promo;
		detalleOpen = true;
	}

	let confirmEliminarOpen = $state(false);
	let promoAEliminar = $state<PromoDTO | null>(null);
	let eliminando = $state(false);

	function pedirEliminar(promo: PromoDTO) {
		promoAEliminar = promo;
		confirmEliminarOpen = true;
	}

	async function confirmarEliminar() {
		if (!promoAEliminar) return;
		eliminando = true;
		try {
			const res = await fetch(`/api/promos/${promoAEliminar.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('request failed');
			toast.success('Promo eliminada');
			confirmEliminarOpen = false;
			detalleOpen = false;
			await cargarPromos();
		} catch {
			toast.error('No se pudo eliminar la promo');
		} finally {
			eliminando = false;
		}
	}
</script>

<svelte:head>
	<title>Promos · La Central</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<Breadcrumbs
		items={[
			{ label: 'Dashboard', href: '/dashboard' },
			{ label: 'Inventario', href: '/dashboard/productos' },
			{ label: 'Promos' }
		]}
	/>

	<header class="flex items-center justify-between">
		<div>
			<h1 class="title">Promos</h1>
			<p class="mt-1 text-sm text-stone-400">
				Combos de productos con un precio fijo, listos para vender en un solo toque.
			</p>
		</div>
		<button
			type="button"
			onclick={abrirDialog}
			class="cursor-pointer rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-extrabold text-white transition-colors hover:bg-emerald-600"
		>
			Nueva Promo
		</button>
	</header>

	{#if promosLista.length === 0}
		<p class="rounded-2xl bg-white p-10 text-center text-sm text-stone-400">
			Todavía no hay promos. Crea la primera con el botón de arriba.
		</p>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each promosLista as promo (promo.id)}
				<div class="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-2 ring-stone-100">
					<div class="flex items-start justify-between gap-2">
						<div class="flex items-center gap-2">
							<span
								class="flex size-9 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600"
							>
								<Tag size={16} strokeWidth={2.5} />
							</span>
							<p class="font-extrabold text-stone-800">{promo.nombre}</p>
						</div>
					</div>

					<p class="text-2xl font-extrabold text-stone-800">{currency(promo.precio)}</p>

					<div class="flex flex-col gap-1 text-sm text-stone-500">
						{#each promo.items.slice(0, 3) as item (item.id)}
							<p class="truncate">{item.cantidad}× {item.nombreProducto}</p>
						{/each}
						{#if promo.items.length > 3}
							<p class="text-xs text-stone-400">+{promo.items.length - 3} más</p>
						{/if}
					</div>

					<span
						class="w-fit rounded-full px-2.5 py-0.5 text-xs font-bold {promo.stockDisponible > 0
							? 'bg-emerald-100 text-emerald-700'
							: 'bg-red-100 text-red-700'}"
					>
						{promo.stockDisponible > 0 ? `${promo.stockDisponible} disponibles` : 'Sin stock'}
					</span>

					<div class="mt-auto flex items-center gap-2 border-t border-stone-100 pt-3">
						<Button variant="secondary" onclick={() => verDetalle(promo)} class="flex-1">
							<Eye size={15} />
							Ver
						</Button>
						<button
							type="button"
							onclick={() => pedirEliminar(promo)}
							class="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
							aria-label="Eliminar promo {promo.nombre}"
						>
							<Trash2 size={16} />
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</main>

<Dialog bind:open={dialogOpen} title="Nueva Promo" class="max-w-xl">
	<p class="-mt-4 text-sm text-stone-400">
		Elige los productos que forman el combo y el precio final de venta.
	</p>
	<form onsubmit={handleGuardar} class="flex flex-col gap-4">
		<div class="grid grid-cols-2 gap-3">
			<div class="flex flex-col gap-1.5">
				<label for="promo-nombre" class="text-sm font-bold text-stone-800">Nombre de la promo</label
				>
				<Input id="promo-nombre" bind:value={nuevoNombre} placeholder="Ej. Coca Cola + Oreos" />
			</div>
			<div class="flex flex-col gap-1.5">
				<label for="promo-precio" class="text-sm font-bold text-stone-800">Precio de venta</label>
				<MoneyInput id="promo-precio" bind:value={nuevoPrecio} />
			</div>
		</div>

		<div class="flex flex-col gap-2">
			<span class="text-sm font-bold text-stone-800">Productos de la promo</span>
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
					Busca y agrega los productos que forman la promo
				</p>
			{:else}
				<div class="flex items-center gap-2 px-3 text-xs font-bold text-stone-400 uppercase">
					<span class="min-w-0 flex-1">Producto</span>
					<span class="w-32 shrink-0">Presentación</span>
					<span class="w-20 shrink-0 text-right">Cant.</span>
					<span class="size-8 shrink-0"></span>
				</div>
				<div class="flex flex-col gap-2">
					{#each lineas as linea, index (linea.productoId)}
						<div class="flex items-center gap-2 rounded-xl bg-stone-100 p-3">
							<span class="min-w-0 flex-1 truncate text-sm font-bold text-stone-800"
								>{linea.productoNombre}</span
							>
							<select
								bind:value={linea.presentacionId}
								onchange={() => onPresentacionCambiada(linea)}
								class="input w-32 shrink-0 py-2 text-sm"
							>
								{#each presentacionesDe(linea.productoId) as p (p.id)}
									<option value={p.id}>{p.nombre}</option>
								{/each}
							</select>
							<input
								type="number"
								min="1"
								step="1"
								inputmode="numeric"
								bind:value={linea.cantidad}
								class="input w-20 shrink-0 py-2 text-sm"
							/>
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

		{#if lineas.length > 0}
			<div class="flex items-center justify-between text-sm text-stone-400">
				<span>Valor normal (referencia)</span>
				<span class="font-bold text-stone-600">{currency(valorReferencia)}</span>
			</div>
		{/if}

		<div class="grid grid-cols-2 gap-3">
			<Button type="button" variant="danger" onclick={() => (dialogOpen = false)}>Cancelar</Button>
			<Button type="submit" variant="success" disabled={guardando}>
				{guardando ? 'Guardando…' : 'Crear Promo'}
			</Button>
		</div>
	</form>
</Dialog>

<Dialog bind:open={detalleOpen} title="Detalle de la promo" class="max-w-md">
	{#if promoSeleccionada}
		<div class="-mt-2 flex flex-col gap-4">
			<div class="flex items-center justify-between">
				<p class="text-xl font-extrabold text-stone-800">{promoSeleccionada.nombre}</p>
				<p class="text-xl font-extrabold text-stone-800">{currency(promoSeleccionada.precio)}</p>
			</div>

			<div class="flex flex-col gap-2 rounded-xl bg-stone-50 p-3">
				{#each promoSeleccionada.items as item (item.id)}
					<div class="flex items-center justify-between text-sm">
						<span class="text-stone-700">{item.cantidad} × {item.nombreProducto}</span>
						<span class="text-xs text-stone-400">{item.nombrePresentacion}</span>
					</div>
				{/each}
			</div>

			<span
				class="w-fit rounded-full px-2.5 py-0.5 text-xs font-bold {promoSeleccionada.stockDisponible >
				0
					? 'bg-emerald-100 text-emerald-700'
					: 'bg-red-100 text-red-700'}"
			>
				{promoSeleccionada.stockDisponible > 0
					? `${promoSeleccionada.stockDisponible} disponibles`
					: 'Sin stock'}
			</span>

			<Button
				type="button"
				variant="danger"
				onclick={() => promoSeleccionada && pedirEliminar(promoSeleccionada)}
			>
				<Trash2 size={16} />
				Eliminar promo
			</Button>
		</div>
	{/if}
</Dialog>

<ConfirmDialog
	bind:open={confirmEliminarOpen}
	title="Eliminar promo"
	message={`¿Eliminar la promo "${promoAEliminar?.nombre ?? ''}"? Esta acción no se puede deshacer.`}
	confirmando={eliminando}
	onConfirm={confirmarEliminar}
/>
