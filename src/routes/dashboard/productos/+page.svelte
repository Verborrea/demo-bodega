<script lang="ts">
	import toast from 'svelte-french-toast';
	import { Search, X, Plus, Minus } from '@lucide/svelte';
	import { Button, Select, Dialog, Input } from '$lib/components/ui';
	import { productos, proveedores, categorias } from '$lib/stores/productos.svelte';

	let busqueda = $state('');
	let categoriaFiltro = $state('');
	const productosFiltrados = $derived(
		productos.lista.filter(
			(p) =>
				p.nombre.toLowerCase().includes(busqueda.toLowerCase()) &&
				(categoriaFiltro === '' || p.categoria === categoriaFiltro)
		)
	);

	function currency(value: number) {
		return `S/ ${value.toFixed(2)}`;
	}

	let dialogOpen = $state(false);
	let nuevoNombre = $state('');
	let nuevoProveedor = $state(proveedores[0]);
	let nuevoCategoria = $state(categorias[0]);
	let nuevoPrecio = $state('');
	let nuevoStock = $state('');
	let seguirAgregando = $state(false);
	let nombreInputEl: HTMLInputElement | undefined = $state();

	function abrirDialog() {
		nuevoNombre = '';
		nuevoProveedor = proveedores[0];
		nuevoCategoria = categorias[0];
		nuevoPrecio = '';
		nuevoStock = '';
		seguirAgregando = false;
		dialogOpen = true;
	}

	function handleAgregar(event: SubmitEvent) {
		event.preventDefault();
		if (!nuevoNombre.trim() || !nuevoPrecio) {
			toast.error('Completa el nombre y el precio del producto');
			return;
		}
		productos.agregar({
			nombre: nuevoNombre.trim(),
			proveedor: nuevoProveedor,
			categoria: nuevoCategoria,
			precio: Number(nuevoPrecio),
			cantidad: Number(nuevoStock) || 0
		});
		toast.success('Producto agregado');

		if (seguirAgregando) {
			nuevoNombre = '';
			nuevoCategoria = categorias[0];
			nuevoPrecio = '';
			nuevoStock = '';
			nombreInputEl?.focus();
		} else {
			dialogOpen = false;
		}
	}
</script>

<svelte:head>
	<title>Productos · La tiendita</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<header>
		<h1 class="title text-2xl">Inventario</h1>
		<p class="mt-0.5 text-sm text-stone-400">Gestiona los productos de tu tienda</p>
	</header>

	<div class="flex items-center justify-between gap-4">
		<div class="flex flex-1 items-center gap-3">
			<div class="max-w-sm flex-1">
				<Input bind:value={busqueda} placeholder="Buscar por nombre de producto…" type="text">
					{#snippet icon()}
						<Search size={16} />
					{/snippet}
					{#snippet trailing()}
						{#if busqueda}
							<button
								type="button"
								onclick={() => (busqueda = '')}
								class="cursor-pointer text-stone-400 transition-colors hover:text-stone-600"
								aria-label="Limpiar búsqueda"
							>
								<X size={16} />
							</button>
						{/if}
					{/snippet}
				</Input>
			</div>
			<Select bind:value={categoriaFiltro} class="w-52">
				<option value="">Todas las categorías</option>
				{#each categorias as categoria (categoria)}
					<option value={categoria}>{categoria}</option>
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

	<section aria-labelledby="inventario-heading" class="flex-1 rounded-2xl bg-white p-6">
		<h2 id="inventario-heading" class="sr-only">Listado de productos</h2>
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-stone-100 text-left text-xs text-stone-400 uppercase">
					<th class="py-2 font-bold">Producto</th>
					<th class="py-2 font-bold">Categoría</th>
					<th class="py-2 font-bold">Cantidad</th>
					<th class="py-2 font-bold">Precio</th>
					<th class="py-2 font-bold">Estado</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-stone-100">
				{#if productosFiltrados.length === 0}
					<tr>
						<td colspan="5" class="py-8 text-center text-sm text-stone-400">
							No se encontraron productos
						</td>
					</tr>
				{/if}
				{#each productosFiltrados as producto (producto.id)}
					<tr>
						<td class="py-3 font-medium text-stone-700">{producto.nombre}</td>
						<td class="py-3 text-stone-500">{producto.categoria}</td>
						<td class="py-3">
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => productos.ajustarStock(producto.id, -1)}
									class="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200"
									aria-label="Reducir stock"
								>
									<Minus size={14} strokeWidth={3} />
								</button>
								<span class="w-6 text-center font-bold tabular-nums">{producto.cantidad}</span>
								<button
									type="button"
									onclick={() => productos.ajustarStock(producto.id, 1)}
									class="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200"
									aria-label="Aumentar stock"
								>
									<Plus size={14} strokeWidth={3} />
								</button>
							</div>
						</td>
						<td class="py-3 font-bold text-stone-800">{currency(producto.precio)}</td>
						<td class="py-3">
							<span
								class="rounded-full px-2.5 py-0.5 text-xs font-bold {producto.cantidad > 0
									? 'bg-emerald-100 text-emerald-700'
									: 'bg-red-100 text-red-700'}"
							>
								{producto.cantidad > 0 ? 'Disponible' : 'Agotado'}
							</span>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</main>

<Dialog bind:open={dialogOpen} title="Nuevo producto">
	<p class="-mt-4 text-sm text-stone-400">Completa los datos del producto</p>
	<form onsubmit={handleAgregar} class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label for="proveedor" class="text-sm font-bold text-stone-800">Proveedor</label>
			<Select id="proveedor" bind:value={nuevoProveedor}>
				{#each proveedores as proveedor (proveedor)}
					<option value={proveedor}>{proveedor}</option>
				{/each}
			</Select>
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

		<div class="flex gap-3">
			<div class="flex flex-1 flex-col gap-1.5">
				<label for="precio" class="text-sm font-bold text-stone-800">Precio</label>
				<input
					id="precio"
					type="number"
					min="0"
					step="0.10"
					inputmode="decimal"
					placeholder="0.00"
					bind:value={nuevoPrecio}
					class="input"
				/>
			</div>
			<div class="flex flex-1 flex-col gap-1.5">
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
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="categoria" class="text-sm font-bold text-stone-800">Categoría</label>
			<Select id="categoria" bind:value={nuevoCategoria}>
				{#each categorias as categoria (categoria)}
					<option value={categoria}>{categoria}</option>
				{/each}
			</Select>
		</div>

		<label class="flex items-center gap-2 text-sm font-bold text-stone-700">
			<input
				type="checkbox"
				bind:checked={seguirAgregando}
				class="size-4 rounded border-stone-300 accent-yellow-400"
			/>
			Seguir añadiendo
		</label>

		<div class="grid grid-cols-2 gap-3">
			<Button type="button" variant="danger" onclick={() => (dialogOpen = false)}>Cancelar</Button>
			<Button type="submit" variant="success">Agregar</Button>
		</div>
	</form>
</Dialog>
