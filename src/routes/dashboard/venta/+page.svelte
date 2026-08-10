<script lang="ts">
	import { goto } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import { Plus, Minus, Trash2, ShoppingCart } from '@lucide/svelte';
	import { Button, Select } from '$lib/components/ui';
	import { caja, type MetodoPago } from '$lib/stores/caja.svelte';
	import { productos } from '$lib/stores/productos.svelte';
	import { currency } from '$lib/utils';

	$effect(() => {
		if (!caja.abierta) {
			toast.error('Abre la caja antes de registrar una venta');
			goto('/dashboard');
		}
	});

	let now = $state(new Date());
	$effect(() => {
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});
	const fechaHora = $derived.by(() => {
		const fecha = now.toLocaleDateString('es-PE', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
		const hora = now.toLocaleTimeString('es-PE', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
		return `${fecha[0].toUpperCase()}${fecha.slice(1)} · ${hora}`;
	});

	let carrito = $state<Record<string, number>>({});

	const items = $derived(
		productos.lista
			.filter((p) => carrito[p.id] > 0)
			.map((p) => ({ ...p, cantidad: carrito[p.id], subtotal: carrito[p.id] * p.precio }))
	);
	const totalItems = $derived(items.reduce((acc, i) => acc + i.cantidad, 0));
	const total = $derived(items.reduce((acc, i) => acc + i.subtotal, 0));

	function agregar(id: string) {
		const producto = productos.lista.find((p) => p.id === id);
		if (!producto) return;
		const enCarrito = carrito[id] ?? 0;
		if (enCarrito >= producto.cantidad) {
			toast.error('No hay más stock disponible');
			return;
		}
		carrito[id] = enCarrito + 1;
	}

	function quitarUno(id: string) {
		if (!carrito[id]) return;
		carrito[id] -= 1;
		if (carrito[id] <= 0) delete carrito[id];
	}

	function eliminar(id: string) {
		delete carrito[id];
	}

	let metodoPago: MetodoPago = $state('Efectivo');
	let cliente = $state('');

	function handleCobrar(event: SubmitEvent) {
		event.preventDefault();
		if (items.length === 0) {
			toast.error('Agrega al menos un producto');
			return;
		}
		const descripcion = `${totalItems} producto${totalItems === 1 ? '' : 's'}`;
		caja.registrarVenta(metodoPago, total, descripcion, cliente.trim() || undefined);
		for (const item of items) {
			productos.descontar(item.id, item.cantidad);
		}
		toast.success(`Venta registrada: ${currency(total)}`);
		carrito = {};
		cliente = '';
	}
</script>

<svelte:head>
	<title>Nueva venta · La tiendita</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<header class="flex items-center justify-between">
		<div>
			<h1 class="title text-2xl">Nueva Venta</h1>
			<p class="mt-0.5 text-sm text-stone-400">Selecciona los productos y cobra</p>
		</div>
		<p class="text-sm font-bold text-stone-500">{fechaHora}</p>
	</header>

	<div class="flex flex-1 gap-6">
		<section aria-labelledby="productos-heading" class="flex-1 rounded-2xl bg-white p-6">
			<h2 id="productos-heading" class="mb-4 text-lg font-extrabold text-stone-800">Productos</h2>
			<div class="grid grid-cols-4 gap-3">
				{#each productos.lista as producto (producto.id)}
					<button
						type="button"
						disabled={producto.cantidad === 0}
						onclick={() => agregar(producto.id)}
						class="flex flex-col items-start gap-3 rounded-xl bg-stone-100 p-4 text-left transition-colors {producto.cantidad ===
						0
							? 'cursor-not-allowed opacity-40'
							: 'cursor-pointer hover:bg-yellow-100'}"
					>
						<span class="font-bold text-stone-800">{producto.nombre}</span>
						<span class="text-sm font-bold text-stone-500">{currency(producto.precio)}</span>
					</button>
				{/each}
			</div>
		</section>

		<aside
			aria-labelledby="carrito-heading"
			class="flex w-96 shrink-0 flex-col gap-4 rounded-2xl bg-stone-800 p-6 text-stone-50"
		>
			<h2 id="carrito-heading" class="flex items-center gap-2 text-lg font-extrabold">
				<ShoppingCart size={20} strokeWidth={2.5} />
				Carrito
			</h2>

			<div class="flex flex-1 flex-col gap-2 overflow-auto">
				{#if items.length === 0}
					<p class="mt-8 text-center text-sm text-stone-400">
						Toca un producto para agregarlo al carrito
					</p>
				{:else}
					{#each items as item (item.id)}
						<div class="flex items-center gap-3 rounded-xl bg-stone-800 p-3">
							<div class="flex-1">
								<p class="font-bold">{item.nombre}</p>
								<p class="text-xs text-stone-400">{currency(item.precio)} c/u</p>
							</div>
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => quitarUno(item.id)}
									class="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-stone-700 hover:bg-stone-600"
									aria-label="Quitar uno"
								>
									<Minus size={14} strokeWidth={3} />
								</button>
								<span class="w-4 text-center text-sm font-bold tabular-nums">{item.cantidad}</span>
								<button
									type="button"
									onclick={() => agregar(item.id)}
									class="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-stone-700 hover:bg-stone-600"
									aria-label="Agregar uno"
								>
									<Plus size={14} strokeWidth={3} />
								</button>
							</div>
							<p class="w-16 text-right text-sm font-bold">{currency(item.subtotal)}</p>
							<button
								type="button"
								onclick={() => eliminar(item.id)}
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
					<label for="cliente" class="text-sm font-bold">Cliente (opcional)</label>
					<input
						id="cliente"
						type="text"
						placeholder="Nombre del cliente"
						bind:value={cliente}
						class="input"
					/>
				</div>

				<Select bind:value={metodoPago}>
					<option value="Efectivo">Efectivo</option>
					<option value="Yape">Yape</option>
					<option value="Tarjeta">Tarjeta</option>
				</Select>

				<div class="flex items-center justify-between text-lg font-extrabold">
					<span>Total</span>
					<span>{currency(total)}</span>
				</div>

				<Button type="submit" variant="success">Cobrar {currency(total)}</Button>
			</form>
		</aside>
	</div>
</main>
