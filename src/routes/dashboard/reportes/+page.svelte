<script lang="ts">
	import { ChartLine, PackageX, Calculator } from '@lucide/svelte';
	import { today, getLocalTimeZone } from '@internationalized/date';
	import { Breadcrumbs, DateRangePicker } from '$lib/components/ui';
	import type { DateRangeValue } from '$lib/components/ui/DateRangePicker.svelte';
	import ReporteGanancia from '$lib/components/reportes/ReporteGanancia.svelte';
	import ReporteStock from '$lib/components/reportes/ReporteStock.svelte';
	import ReporteCaja from '$lib/components/reportes/ReporteCaja.svelte';

	// 'ganancia' fusiona lo que antes eran dos reportes separados (ranking de más/menos
	// vendidos + margen por producto): ahora es una sola tabla ordenable con ventas y
	// ganancia juntas, así que ya no hace falta una sección "Productos" aparte.
	type Seccion = 'ganancia' | 'stock' | 'caja';

	const secciones: { valor: Seccion; label: string; icon: typeof ChartLine }[] = [
		{ valor: 'ganancia', label: 'Productos', icon: ChartLine },
		{ valor: 'stock', label: 'Stock', icon: PackageX },
		{ valor: 'caja', label: 'Caja', icon: Calculator }
	];

	let seccion: Seccion = $state('ganancia');

	const hoy = today(getLocalTimeZone());
	let rangoFecha = $state<DateRangeValue>({ start: hoy.set({ day: 1 }), end: hoy });

	const desde = $derived(rangoFecha.start?.toString() ?? hoy.set({ day: 1 }).toString());
	const hasta = $derived(rangoFecha.end?.toString() ?? hoy.toString());
</script>

<svelte:head>
	<title>Reportes · La Central</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reportes' }]} />

	<div class="flex flex-col gap-2">
		<h1 class="title">Reportes</h1>
		<p class="text-sm text-stone-400">Productos, ganancia, stock y caja de un vistazo.</p>
	</div>

	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex flex-wrap gap-2">
			{#each secciones as s (s.valor)}
				<button
					type="button"
					onclick={() => (seccion = s.valor)}
					class="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition-colors {seccion ===
					s.valor
						? 'bg-primary text-stone-900'
						: 'bg-white text-stone-500 ring-2 ring-stone-200 hover:bg-stone-200'}"
				>
					<s.icon size={16} strokeWidth={2.5} />
					{s.label}
				</button>
			{/each}
		</div>

		{#if seccion !== 'stock'}
			<DateRangePicker bind:value={rangoFecha} />
		{/if}
	</div>

	{#if seccion === 'ganancia'}
		<ReporteGanancia {desde} {hasta} />
	{:else if seccion === 'stock'}
		<ReporteStock />
	{:else if seccion === 'caja'}
		<ReporteCaja {desde} {hasta} />
	{/if}
</main>
