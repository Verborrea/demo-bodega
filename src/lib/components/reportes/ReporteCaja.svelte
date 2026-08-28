<script lang="ts">
	import { FileText, FileSpreadsheet } from '@lucide/svelte';
	import toast from 'svelte-french-toast';
	import { currency, formatFecha, formatHora } from '$lib/utils';
	import { exportarPDF, exportarExcel } from '$lib/export';
	import type { ResumenCajaRango } from '$lib/server/reportes';
	import type { SesionCajaDTO } from '$lib/server/caja';

	interface Props {
		desde: string;
		hasta: string;
	}
	let { desde, hasta }: Props = $props();

	let resumen = $state<ResumenCajaRango | null>(null);
	let sesiones = $state<SesionCajaDTO[]>([]);
	let cargando = $state(false);

	function totalSesion(sesion: SesionCajaDTO, campo: 'esperados' | 'montosFinales') {
		const montos = sesion[campo];
		if (!montos) return 0;
		return montos.Efectivo + montos.Yape + montos.Tarjeta;
	}

	function diferencia(sesion: SesionCajaDTO) {
		return totalSesion(sesion, 'montosFinales') - totalSesion(sesion, 'esperados');
	}

	async function cargar() {
		cargando = true;
		try {
			const res = await fetch(`/api/reportes/caja?desde=${desde}&hasta=${hasta}`);
			if (!res.ok) throw new Error('request failed');
			const datos = (await res.json()) as { resumen: ResumenCajaRango; sesiones: SesionCajaDTO[] };
			resumen = datos.resumen;
			sesiones = datos.sesiones;
		} catch {
			toast.error('No se pudo cargar el reporte de caja');
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		void desde;
		void hasta;
		cargar();
	});

	async function onExportarPDF() {
		if (!sesiones.length) return;
		await exportarPDF({
			titulo: 'Reporte de Caja',
			subtitulo: `${formatFecha(desde)} – ${formatFecha(hasta)}`,
			resumen: resumen
				? [
						{ label: 'Sesiones', value: String(resumen.sesiones) },
						{ label: 'Total esperado', value: currency(resumen.totalEsperado) },
						{ label: 'Total contado', value: currency(resumen.totalFinal) },
						{ label: 'Diferencia', value: currency(resumen.totalDiferencia) }
					]
				: undefined,
			columnas: [
				'Cajero',
				'Fecha',
				'Apertura',
				'Cierre',
				'Esp. Efectivo',
				'Esp. Yape',
				'Esp. Tarjeta',
				'Final',
				'Diferencia'
			],
			alineaciones: ['left', 'left', 'left', 'left', 'right', 'right', 'right', 'right', 'right'],
			filas: sesiones.map((s) => [
				s.cajeroNombre,
				formatFecha(s.aperturaEn),
				formatHora(s.aperturaEn),
				s.cierreEn ? formatHora(s.cierreEn) : '—',
				currency(s.esperados?.Efectivo ?? 0),
				currency(s.esperados?.Yape ?? 0),
				currency(s.esperados?.Tarjeta ?? 0),
				currency(totalSesion(s, 'montosFinales')),
				currency(diferencia(s))
			])
		});
	}

	async function onExportarExcel() {
		if (!sesiones.length) return;
		await exportarExcel({
			nombreArchivo: `reporte-caja-${desde}-a-${hasta}`,
			hojaNombre: 'Sesiones',
			titulo: `Reporte de Caja — ${formatFecha(desde)} a ${formatFecha(hasta)}`,
			filas: sesiones.map((s) => ({
				Cajero: s.cajeroNombre,
				Fecha: formatFecha(s.aperturaEn),
				Apertura: formatHora(s.aperturaEn),
				Cierre: s.cierreEn ? formatHora(s.cierreEn) : '',
				'Esperado Efectivo': s.esperados?.Efectivo ?? 0,
				'Esperado Yape': s.esperados?.Yape ?? 0,
				'Esperado Tarjeta': s.esperados?.Tarjeta ?? 0,
				Final: totalSesion(s, 'montosFinales'),
				Diferencia: diferencia(s)
			}))
		});
	}
</script>

<div class="flex flex-col gap-4">
	<div class="grid gap-4 @min-[768px]:grid-cols-2 @min-[900px]:grid-cols-4">
		<div class="flex flex-col gap-2 rounded-2xl bg-primary p-5">
			<p class="font-bold text-stone-800">Sesiones cerradas</p>
			<p class="text-2xl font-extrabold text-stone-800">{resumen?.sesiones ?? 0}</p>
		</div>
		<div class="flex flex-col gap-2 rounded-2xl bg-violet-300 p-5">
			<p class="font-bold text-stone-800">Total esperado</p>
			<p class="text-2xl font-extrabold text-stone-800">{currency(resumen?.totalEsperado ?? 0)}</p>
		</div>
		<div class="flex flex-col gap-2 rounded-2xl bg-sky-300 p-5">
			<p class="font-bold text-stone-800">Total contado</p>
			<p class="text-2xl font-extrabold text-stone-800">{currency(resumen?.totalFinal ?? 0)}</p>
		</div>
		<div
			class="flex flex-col gap-2 rounded-2xl p-5 {(resumen?.totalDiferencia ?? 0) < 0
				? 'bg-red-300'
				: 'bg-emerald-300'}"
		>
			<p class="font-bold text-stone-800">Diferencia acumulada</p>
			<p class="text-2xl font-extrabold text-stone-800">
				{currency(resumen?.totalDiferencia ?? 0)}
			</p>
		</div>
	</div>

	<div class="rounded-2xl border-2 border-stone-200 bg-white p-6">
		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<h2 class="text-lg font-extrabold text-stone-800">Sesiones de caja</h2>
			<div class="flex gap-2">
				<button
					type="button"
					onclick={onExportarPDF}
					disabled={!sesiones.length}
					class="flex items-center gap-1.5 rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<FileText size={14} /> PDF
				</button>
				<button
					type="button"
					onclick={onExportarExcel}
					disabled={!sesiones.length}
					class="flex items-center gap-1.5 rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<FileSpreadsheet size={14} /> Excel
				</button>
			</div>
		</div>

		<div class="hidden overflow-x-auto lg:block">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-stone-100 text-left text-xs text-stone-400 uppercase">
						<th class="py-2 font-bold">Cajero</th>
						<th class="py-2 font-bold">Fecha</th>
						<th class="py-2 font-bold">Apertura</th>
						<th class="py-2 font-bold">Cierre</th>
						<th class="py-2 text-right font-bold">Esp. Efectivo</th>
						<th class="py-2 text-right font-bold">Esp. Yape</th>
						<th class="py-2 text-right font-bold">Esp. Tarjeta</th>
						<th class="py-2 text-right font-bold">Final</th>
						<th class="py-2 text-right font-bold">Diferencia</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-stone-100">
					{#if !sesiones.length}
						<tr>
							<td colspan="9" class="py-8 text-center text-sm text-stone-400">
								{cargando ? 'Cargando…' : 'Sin sesiones cerradas en este rango'}
							</td>
						</tr>
					{/if}
					{#each sesiones as sesion (sesion.id)}
						{@const diff = diferencia(sesion)}
						<tr>
							<td class="py-3 font-medium text-stone-700">{sesion.cajeroNombre}</td>
							<td class="py-3 text-stone-500">{formatFecha(sesion.aperturaEn)}</td>
							<td class="py-3 text-stone-500">{formatHora(sesion.aperturaEn)}</td>
							<td class="py-3 text-stone-500">
								{sesion.cierreEn ? formatHora(sesion.cierreEn) : '—'}
							</td>
							<td class="py-3 text-right text-stone-500"
								>{currency(sesion.esperados?.Efectivo ?? 0)}</td
							>
							<td class="py-3 text-right text-stone-500">{currency(sesion.esperados?.Yape ?? 0)}</td
							>
							<td class="py-3 text-right text-stone-500"
								>{currency(sesion.esperados?.Tarjeta ?? 0)}</td
							>
							<td class="py-3 text-right text-stone-500">
								{currency(totalSesion(sesion, 'montosFinales'))}
							</td>
							<td
								class="py-3 text-right font-bold {diff === 0
									? 'text-stone-800'
									: diff > 0
										? 'text-success-dark'
										: 'text-error'}"
							>
								{currency(diff)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="flex flex-col gap-3 lg:hidden">
			{#if !sesiones.length}
				<p class="py-8 text-center text-sm text-stone-400">
					{cargando ? 'Cargando…' : 'Sin sesiones cerradas en este rango'}
				</p>
			{/if}
			{#each sesiones as sesion (sesion.id)}
				{@const diff = diferencia(sesion)}
				<div class="flex flex-col gap-3 rounded-2xl border-2 border-stone-200 p-4">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="truncate font-extrabold text-stone-800">{sesion.cajeroNombre}</p>
							<p class="text-xs text-stone-400">{formatFecha(sesion.aperturaEn)}</p>
						</div>
						<span
							class="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold {diff === 0
								? 'bg-stone-100 text-stone-600'
								: diff > 0
									? 'bg-emerald-100 text-emerald-700'
									: 'text-error-dark bg-red-100'}"
						>
							{currency(diff)}
						</span>
					</div>
					<div class="grid grid-cols-2 gap-3 text-sm">
						<div>
							<p class="text-xs text-stone-400">Apertura</p>
							<p class="font-medium text-stone-700">{formatHora(sesion.aperturaEn)}</p>
						</div>
						<div>
							<p class="text-xs text-stone-400">Cierre</p>
							<p class="font-medium text-stone-700">
								{sesion.cierreEn ? formatHora(sesion.cierreEn) : '—'}
							</p>
						</div>
					</div>
					<div class="grid grid-cols-3 gap-2 border-t border-stone-100 pt-3 text-sm">
						<div>
							<p class="text-xs text-stone-400">Efectivo</p>
							<p class="font-bold text-stone-800">{currency(sesion.esperados?.Efectivo ?? 0)}</p>
						</div>
						<div>
							<p class="text-xs text-stone-400">Yape</p>
							<p class="font-bold text-stone-800">{currency(sesion.esperados?.Yape ?? 0)}</p>
						</div>
						<div>
							<p class="text-xs text-stone-400">Tarjeta</p>
							<p class="font-bold text-stone-800">{currency(sesion.esperados?.Tarjeta ?? 0)}</p>
						</div>
					</div>
					<div class="flex items-center justify-between border-t border-stone-100 pt-3 text-sm">
						<span class="text-stone-400">Final contado</span>
						<span class="font-bold text-stone-800"
							>{currency(totalSesion(sesion, 'montosFinales'))}</span
						>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
