<script lang="ts">
	import { FileText, FileSpreadsheet } from '@lucide/svelte';
	import toast from 'svelte-french-toast';
	import { currency, formatFechaSolo } from '$lib/utils';
	import { exportarPDF, exportarExcel } from '$lib/export';
	import { Select } from '$lib/components/ui';
	import type { ProductoVentaRango } from '$lib/server/reportes';
	import type { OpcionSimple } from '$lib/server/productos';

	interface Props {
		desde: string;
		hasta: string;
	}
	let { desde, hasta }: Props = $props();

	const subtitulo = $derived(`${formatFechaSolo(desde)} – ${formatFechaSolo(hasta)}`);

	interface Datos {
		masVendidos: ProductoVentaRango[];
		menosVendidos: ProductoVentaRango[];
	}

	let datos = $state<Datos | null>(null);
	let cargando = $state(false);
	let categorias = $state<OpcionSimple[]>([]);
	let categoriaFiltroId = $state('');

	async function cargarCategorias() {
		try {
			const res = await fetch('/api/categorias');
			if (res.ok) categorias = (await res.json()) as OpcionSimple[];
		} catch {
			// El filtro simplemente queda vacío si no se pudo cargar; no bloquea el reporte.
		}
	}

	async function cargar() {
		cargando = true;
		try {
			const params = new URLSearchParams({ desde, hasta });
			if (categoriaFiltroId) params.set('categoriaId', categoriaFiltroId);
			const res = await fetch(`/api/reportes/productos?${params}`);
			if (!res.ok) throw new Error('request failed');
			datos = (await res.json()) as Datos;
		} catch {
			toast.error('No se pudo cargar el reporte de productos');
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		cargarCategorias();
	});

	$effect(() => {
		void desde;
		void hasta;
		void categoriaFiltroId;
		cargar();
	});

	async function exportarRankingPDF(titulo: string, filas: ProductoVentaRango[]) {
		if (!filas.length) return;
		await exportarPDF({
			titulo,
			subtitulo,
			columnas: ['Producto', 'Categoría', 'Cantidad', 'Total'],
			alineaciones: ['left', 'left', 'right', 'right'],
			filas: filas.map((f) => [
				f.nombre,
				f.categoria ?? '—',
				f.cantidadVendida,
				currency(f.totalVendido)
			])
		});
	}

	async function exportarRankingExcel(nombreArchivo: string, titulo: string, filas: ProductoVentaRango[]) {
		if (!filas.length) return;
		await exportarExcel({
			nombreArchivo,
			hojaNombre: titulo,
			titulo: `${titulo} — ${subtitulo}`,
			filas: filas.map((f) => ({
				Producto: f.nombre,
				Categoría: f.categoria ?? '',
				Cantidad: f.cantidadVendida,
				Total: f.totalVendido
			}))
		});
	}
</script>

{#snippet exportBtns(onPdf: () => void, onExcel: () => void, disabled: boolean)}
	<div class="flex gap-2">
		<button
			type="button"
			onclick={onPdf}
			{disabled}
			class="flex items-center gap-1.5 rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40"
		>
			<FileText size={14} /> PDF
		</button>
		<button
			type="button"
			onclick={onExcel}
			{disabled}
			class="flex items-center gap-1.5 rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40"
		>
			<FileSpreadsheet size={14} /> Excel
		</button>
	</div>
{/snippet}

{#snippet tablaRanking(titulo: string, filas: ProductoVentaRango[], onPdf: () => void, onExcel: () => void)}
	<div class="flex flex-1 flex-col gap-4 rounded-2xl border-2 border-stone-200 bg-white p-6">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h2 class="text-lg font-extrabold text-stone-800">{titulo}</h2>
			{@render exportBtns(onPdf, onExcel, !filas.length)}
		</div>
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-stone-100 text-left text-xs text-stone-400 uppercase">
					<th class="py-2 font-bold">Producto</th>
					<th class="py-2 text-right font-bold">Cant.</th>
					<th class="py-2 text-right font-bold">Total</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-stone-100">
				{#if !filas.length}
					<tr>
						<td colspan="3" class="py-8 text-center text-sm text-stone-400">
							{cargando ? 'Cargando…' : 'Sin datos en este rango'}
						</td>
					</tr>
				{/if}
				{#each filas as fila (fila.productoId)}
					<tr>
						<td class="py-3 font-medium text-stone-700">{fila.nombre}</td>
						<td class="py-3 text-right text-stone-500">{fila.cantidadVendida}</td>
						<td class="py-3 text-right font-bold text-stone-800">{currency(fila.totalVendido)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-center gap-3">
		<Select bind:value={categoriaFiltroId} class="w-full @min-[480px]:w-56">
			<option value="">Todas las categorías</option>
			{#each categorias as categoria (categoria.id)}
				<option value={categoria.id}>{categoria.nombre}</option>
			{/each}
		</Select>
	</div>

	<div class="flex flex-col items-stretch gap-4 @min-[900px]:flex-row">
		{@render tablaRanking(
			'Más vendidos',
			datos?.masVendidos ?? [],
			() => exportarRankingPDF(`Más vendidos`, datos?.masVendidos ?? []),
			() => exportarRankingExcel(`mas-vendidos-${desde}-a-${hasta}`, 'Más vendidos', datos?.masVendidos ?? [])
		)}
		{@render tablaRanking(
			'Menos vendidos',
			datos?.menosVendidos ?? [],
			() => exportarRankingPDF(`Menos vendidos`, datos?.menosVendidos ?? []),
			() =>
				exportarRankingExcel(`menos-vendidos-${desde}-a-${hasta}`, 'Menos vendidos', datos?.menosVendidos ?? [])
		)}
	</div>
</div>
