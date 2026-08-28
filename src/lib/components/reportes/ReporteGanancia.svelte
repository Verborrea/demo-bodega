<script lang="ts">
	import {
		FileText,
		FileSpreadsheet,
		TrendingUp,
		TrendingDown,
		Tags,
		ChevronUp,
		ChevronDown,
		ChevronsUpDown
	} from '@lucide/svelte';
	import toast from 'svelte-french-toast';
	import { currency, formatFechaSolo } from '$lib/utils';
	import { exportarPDF, exportarExcel } from '$lib/export';
	import { Select } from '$lib/components/ui';
	import type {
		ProductoMargen,
		CategoriaRentabilidad,
		ProductoVentaRango
	} from '$lib/server/reportes';
	import type { OpcionSimple } from '$lib/server/productos';

	interface Props {
		desde: string;
		hasta: string;
	}
	let { desde, hasta }: Props = $props();

	const subtitulo = $derived(`${formatFechaSolo(desde)} – ${formatFechaSolo(hasta)}`);

	// El backend (margenProductos en reportes.ts) ya devuelve esto ordenado por
	// gananciaEstimadaRango descendente.
	let filas = $state<ProductoMargen[]>([]);
	// Rollup por categoría y extremos de producto SIEMPRE sobre todo el catálogo (sin el
	// filtro de categoría de abajo) — para que las tarjetas respondan en general, no solo
	// dentro de lo que se esté filtrando en la tabla.
	let categoriasRentabilidad = $state<CategoriaRentabilidad[]>([]);
	let productoMasVendido = $state<ProductoVentaRango | null>(null);
	let productoMenosVendido = $state<ProductoVentaRango | null>(null);
	let categoriasList = $state<OpcionSimple[]>([]);
	let categoriaFiltroId = $state('');
	let cargando = $state(false);

	const categoriaTopVentas = $derived(
		categoriasRentabilidad.reduce<CategoriaRentabilidad | null>(
			(top, c) =>
				c.cantidadVendida > 0 && (!top || c.cantidadVendida > top.cantidadVendida) ? c : top,
			null
		)
	);

	async function cargarCategoriasList() {
		try {
			const res = await fetch('/api/categorias');
			if (res.ok) categoriasList = (await res.json()) as OpcionSimple[];
		} catch {
			// El filtro simplemente queda vacío si no se pudo cargar; no bloquea el reporte.
		}
	}

	async function cargar() {
		cargando = true;
		try {
			const params = new URLSearchParams({ desde, hasta });
			if (categoriaFiltroId) params.set('categoriaId', categoriaFiltroId);
			const res = await fetch(`/api/reportes/ganancia?${params}`);
			if (!res.ok) throw new Error('request failed');
			const datos = (await res.json()) as {
				productos: ProductoMargen[];
				categorias: CategoriaRentabilidad[];
				productoMasVendido: ProductoVentaRango | null;
				productoMenosVendido: ProductoVentaRango | null;
			};
			filas = datos.productos;
			categoriasRentabilidad = datos.categorias;
			productoMasVendido = datos.productoMasVendido;
			productoMenosVendido = datos.productoMenosVendido;
		} catch {
			toast.error('No se pudo cargar el reporte de ganancia');
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		cargarCategoriasList();
	});

	$effect(() => {
		void desde;
		void hasta;
		void categoriaFiltroId;
		cargar();
	});

	// Orden 100% en el cliente: a diferencia de las tablas paginadas del resto de la app,
	// acá ya se cargó TODO el rango de una vez (no hay más páginas que traer del servidor),
	// así que no vale la pena un roundtrip solo para reordenar lo que ya está en memoria.
	type ColumnaOrden =
		'nombre' | 'ventas' | 'costo' | 'precio' | 'margen' | 'margenPct' | 'ganancia';
	let columnaOrden = $state<ColumnaOrden | null>(null);
	let direccionOrden = $state<'asc' | 'desc'>('asc');

	// Tres estados por columna: asc → desc → sin orden (vuelve al orden por defecto del
	// servidor, que ya viene por gananciaEstimadaRango descendente).
	function onOrdenar(columna: ColumnaOrden) {
		if (columnaOrden === columna) {
			if (direccionOrden === 'asc') {
				direccionOrden = 'desc';
			} else {
				columnaOrden = null;
			}
		} else {
			columnaOrden = columna;
			direccionOrden = 'asc';
		}
	}

	function valorColumna(fila: ProductoMargen, columna: ColumnaOrden): string | number | null {
		switch (columna) {
			case 'nombre':
				return fila.nombre;
			case 'ventas':
				return fila.cantidadVendidaRango;
			case 'costo':
				return fila.costoUltimo;
			case 'precio':
				return fila.precioBase;
			case 'margen':
				return fila.margenMonto;
			case 'margenPct':
				return fila.margenPorcentaje;
			case 'ganancia':
				return fila.gananciaEstimadaRango;
		}
	}

	// Los nulls (sin costo/precio registrado) siempre quedan al final, sin importar la
	// dirección — mismo criterio que ya usa el orden por defecto del servidor.
	const filasOrdenadas = $derived.by(() => {
		if (!columnaOrden) return filas;
		const col = columnaOrden;
		const signo = direccionOrden === 'asc' ? 1 : -1;
		return [...filas].sort((a, b) => {
			const va = valorColumna(a, col);
			const vb = valorColumna(b, col);
			if (va == null && vb == null) return 0;
			if (va == null) return 1;
			if (vb == null) return -1;
			if (typeof va === 'string' || typeof vb === 'string') {
				return signo * String(va).localeCompare(String(vb));
			}
			return signo * (va - vb);
		});
	});

	async function onExportarPDF() {
		if (!filasOrdenadas.length) return;
		await exportarPDF({
			titulo: 'Ganancia por producto',
			subtitulo,
			resumen: [
				...(productoMasVendido
					? [{ label: 'Producto más vendido', value: productoMasVendido.nombre }]
					: []),
				...(productoMenosVendido
					? [{ label: 'Producto menos vendido', value: productoMenosVendido.nombre }]
					: []),
				...(categoriaTopVentas
					? [{ label: 'Categoría más vendida', value: categoriaTopVentas.categoria }]
					: [])
			],
			columnas: [
				'Producto',
				'Ventas',
				'Costo',
				'Precio',
				'Margen',
				'Margen %',
				'Ganancia estimada'
			],
			alineaciones: ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
			filas: filasOrdenadas.map((f) => [
				f.nombre,
				f.cantidadVendidaRango,
				f.costoUltimo != null ? currency(f.costoUltimo) : '—',
				f.precioBase != null ? currency(f.precioBase) : '—',
				f.margenMonto != null ? currency(f.margenMonto) : '—',
				f.margenPorcentaje != null ? `${f.margenPorcentaje.toFixed(1)}%` : '—',
				f.gananciaEstimadaRango != null ? currency(f.gananciaEstimadaRango) : '—'
			])
		});
	}

	async function onExportarExcel() {
		if (!filasOrdenadas.length) return;
		await exportarExcel({
			nombreArchivo: `ganancia-productos-${desde}-a-${hasta}`,
			hojaNombre: 'Ganancia',
			titulo: `Ganancia por producto — ${subtitulo}`,
			filas: filasOrdenadas.map((f) => ({
				Producto: f.nombre,
				Ventas: f.cantidadVendidaRango,
				Costo: f.costoUltimo ?? '',
				Precio: f.precioBase ?? '',
				'Margen S/': f.margenMonto ?? '',
				'Margen %': f.margenPorcentaje ?? '',
				'Ganancia estimada': f.gananciaEstimadaRango ?? ''
			}))
		});
	}
</script>

<div class="flex flex-col gap-4">
	<div class="grid gap-4 @min-[900px]:grid-cols-3">
		<div class="flex items-center gap-3 rounded-2xl bg-primary p-5">
			<span
				class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/40 text-stone-800"
			>
				<TrendingUp size={20} strokeWidth={2.5} />
			</span>
			<div class="min-w-0">
				<p class="text-xs leading-3.75 font-bold text-stone-700 uppercase">Producto más vendido</p>
				<p class="truncate text-lg font-extrabold text-stone-800">
					{productoMasVendido?.nombre ?? 'Sin datos'}
					{#if productoMasVendido}
						<span class="font-bold text-stone-700">· {productoMasVendido.cantidadVendida} und.</span
						>
					{/if}
				</p>
			</div>
		</div>
		<div class="flex items-center gap-3 rounded-2xl bg-stone-200 p-5">
			<span
				class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/60 text-stone-800"
			>
				<TrendingDown size={20} strokeWidth={2.5} />
			</span>
			<div class="min-w-0">
				<p class="text-xs leading-3.75 font-bold text-stone-700 uppercase">
					Producto menos vendido
				</p>
				<p class="truncate text-lg font-extrabold text-stone-800">
					{productoMenosVendido?.nombre ?? 'Sin datos'}
					{#if productoMenosVendido}
						<span class="font-bold text-stone-700"
							>· {productoMenosVendido.cantidadVendida} und.</span
						>
					{/if}
				</p>
			</div>
		</div>
		<div class="flex items-center gap-3 rounded-2xl bg-emerald-300 p-5">
			<span
				class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/40 text-stone-800"
			>
				<Tags size={20} strokeWidth={2.5} />
			</span>
			<div class="min-w-0">
				<p class="text-xs leading-3.75 font-bold text-stone-700 uppercase">Categoría más vendida</p>
				<p class="truncate text-lg font-extrabold text-stone-800">
					{categoriaTopVentas?.categoria ?? 'Sin datos'}
					{#if categoriaTopVentas}
						<span class="font-bold text-stone-700">· {categoriaTopVentas.cantidadVendida} und.</span
						>
					{/if}
				</p>
			</div>
		</div>
	</div>

	<div class="rounded-2xl border-2 border-stone-200 bg-white p-6">
		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<h2 class="text-lg font-extrabold text-stone-800">Productos</h2>
			<div class="flex flex-wrap items-center gap-2">
				<Select bind:value={categoriaFiltroId} class="w-44">
					<option value="">Todas las categorías</option>
					{#each categoriasList as categoria (categoria.id)}
						<option value={categoria.id}>{categoria.nombre}</option>
					{/each}
				</Select>
				<button
					type="button"
					onclick={onExportarPDF}
					disabled={!filas.length}
					class="flex items-center gap-1.5 rounded-xl bg-stone-100 px-3 py-2 text-xs leading-3.75 font-bold text-stone-600 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<FileText size={14} /> PDF
				</button>
				<button
					type="button"
					onclick={onExportarExcel}
					disabled={!filas.length}
					class="flex items-center gap-1.5 rounded-xl bg-stone-100 px-3 py-2 text-xs leading-3.75 font-bold text-stone-600 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<FileSpreadsheet size={14} /> Excel
				</button>
			</div>
		</div>
		{#snippet th(columna: ColumnaOrden, etiqueta: string, alinearDerecha = true)}
			<th class="py-2 font-bold {alinearDerecha ? 'text-right' : ''}">
				<button
					type="button"
					onclick={() => onOrdenar(columna)}
					class="inline-flex cursor-pointer items-center gap-1 uppercase hover:text-stone-700 {alinearDerecha
						? 'flex-row-reverse'
						: ''}"
				>
					{etiqueta}
					{#if columnaOrden === columna}
						{#if direccionOrden === 'asc'}
							<ChevronUp size={12} strokeWidth={3} class="text-stone-700" />
						{:else}
							<ChevronDown size={12} strokeWidth={3} class="text-stone-700" />
						{/if}
					{:else}
						<ChevronsUpDown size={12} class="text-stone-400" />
					{/if}
				</button>
			</th>
		{/snippet}

		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr
						class="border-b border-stone-100 text-left text-xs leading-3.75 text-stone-400 uppercase"
					>
						{@render th('nombre', 'Producto', false)}
						{@render th('ventas', 'Ventas')}
						{@render th('costo', 'Costo')}
						{@render th('precio', 'Precio')}
						{@render th('margen', 'Margen')}
						{@render th('margenPct', 'Margen %')}
						{@render th('ganancia', 'Ganancia estimada')}
					</tr>
				</thead>
				<tbody class="divide-y divide-stone-100">
					{#if !filasOrdenadas.length}
						<tr>
							<td colspan="7" class="py-8 text-center text-sm text-stone-400">
								{cargando ? 'Cargando…' : 'Sin productos'}
							</td>
						</tr>
					{/if}
					{#each filasOrdenadas as fila (fila.productoId)}
						<tr>
							<td class="py-3 font-medium text-stone-700">{fila.nombre}</td>
							<td class="py-3 text-right text-stone-500">{fila.cantidadVendidaRango}</td>
							<td class="py-3 text-right text-stone-500">
								{fila.costoUltimo != null ? currency(fila.costoUltimo) : '—'}
							</td>
							<td class="py-3 text-right text-stone-500">
								{fila.precioBase != null ? currency(fila.precioBase) : '—'}
							</td>
							<td class="py-3 text-right font-bold text-stone-800">
								{fila.margenMonto != null ? currency(fila.margenMonto) : '—'}
							</td>
							<td
								class="py-3 text-right {fila.margenPorcentaje != null && fila.margenPorcentaje < 0
									? 'text-error'
									: 'text-stone-500'}"
							>
								{fila.margenPorcentaje != null ? `${fila.margenPorcentaje.toFixed(1)}%` : '—'}
							</td>
							<td class="py-3 text-right font-bold text-stone-800">
								{fila.gananciaEstimadaRango != null ? currency(fila.gananciaEstimadaRango) : '—'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
