<script lang="ts">
	import { FileText, FileSpreadsheet } from '@lucide/svelte';
	import toast from 'svelte-french-toast';
	import { exportarPDF, exportarExcel } from '$lib/export';
	import type { ProductoStock } from '$lib/server/reportes';

	let agotados = $state<ProductoStock[]>([]);
	let disponibles = $state<ProductoStock[]>([]);
	let cargando = $state(false);

	async function cargar() {
		cargando = true;
		try {
			const res = await fetch('/api/reportes/stock');
			if (!res.ok) throw new Error('request failed');
			const datos = (await res.json()) as {
				agotados: ProductoStock[];
				disponibles: ProductoStock[];
			};
			agotados = datos.agotados;
			disponibles = datos.disponibles;
		} catch {
			toast.error('No se pudo cargar el reporte de stock');
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		cargar();
	});

	async function exportarListaPDF(titulo: string, lista: ProductoStock[]) {
		if (!lista.length) return;
		await exportarPDF({
			titulo,
			columnas: ['Producto', 'Categoría', 'Cantidad'],
			alineaciones: ['left', 'left', 'right'],
			filas: lista.map((p) => [p.nombre, p.categoria ?? '—', p.cantidad])
		});
	}

	async function exportarListaExcel(
		nombreArchivo: string,
		hojaNombre: string,
		lista: ProductoStock[]
	) {
		if (!lista.length) return;
		await exportarExcel({
			nombreArchivo,
			hojaNombre,
			titulo: hojaNombre,
			filas: lista.map((p) => ({
				Producto: p.nombre,
				Categoría: p.categoria ?? '',
				Cantidad: p.cantidad
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

{#snippet tablaStock(lista: ProductoStock[], mensajeVacio: string)}
	<table class="w-full text-sm">
		<thead>
			<tr class="border-b border-stone-100 text-left text-xs text-stone-400 uppercase">
				<th class="py-2 font-bold">Producto</th>
				<th class="py-2 font-bold">Categoría</th>
				<th class="py-2 text-right font-bold">Cantidad</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-stone-100">
			{#if !lista.length}
				<tr>
					<td colspan="3" class="py-8 text-center text-sm text-stone-400">
						{cargando ? 'Cargando…' : mensajeVacio}
					</td>
				</tr>
			{/if}
			{#each lista as producto (producto.id)}
				<tr>
					<td class="py-3 font-medium text-stone-700">{producto.nombre}</td>
					<td class="py-3 text-stone-500">{producto.categoria ?? '—'}</td>
					<td class="py-3 text-right font-bold text-stone-800 tabular-nums">{producto.cantidad}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/snippet}

<div class="flex flex-col gap-4">
	<div class="grid gap-4 @min-[640px]:grid-cols-2">
		<div class="flex flex-col gap-2 rounded-2xl bg-primary p-5">
			<p class="font-bold text-stone-800">Agotados</p>
			<p class="text-2xl font-extrabold text-stone-800">{agotados.length}</p>
			<p class="text-xs font-medium text-stone-700">Sin stock disponible</p>
		</div>
		<div class="flex flex-col gap-2 rounded-2xl bg-emerald-300 p-5">
			<p class="font-bold text-stone-800">Disponibles</p>
			<p class="text-2xl font-extrabold text-stone-800">{disponibles.length}</p>
			<p class="text-xs font-medium text-stone-700">Con stock actualmente</p>
		</div>
	</div>

	<div class="flex flex-col items-stretch gap-4 @min-[900px]:flex-row">
		<div class="flex flex-1 flex-col gap-4 rounded-2xl border-2 border-stone-200 bg-white p-6">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<h2 class="text-lg font-extrabold text-stone-800">Agotados</h2>
				{@render exportBtns(
					() => exportarListaPDF('Productos agotados', agotados),
					() => exportarListaExcel('productos-agotados', 'Agotados', agotados),
					!agotados.length
				)}
			</div>
			<div class="max-h-[28rem] overflow-y-auto">
				{@render tablaStock(agotados, 'No hay productos agotados 🎉')}
			</div>
		</div>

		<div class="flex flex-1 flex-col gap-4 rounded-2xl border-2 border-stone-200 bg-white p-6">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<h2 class="text-lg font-extrabold text-stone-800">Disponibles</h2>
				{@render exportBtns(
					() => exportarListaPDF('Productos disponibles', disponibles),
					() => exportarListaExcel('productos-disponibles', 'Disponibles', disponibles),
					!disponibles.length
				)}
			</div>
			<div class="max-h-[28rem] overflow-y-auto">
				{@render tablaStock(disponibles, 'Sin productos disponibles')}
			</div>
		</div>
	</div>
</div>
