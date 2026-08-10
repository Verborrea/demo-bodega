<script lang="ts">
	import { ScanBarcode, Search, X } from '@lucide/svelte';
	import { getLocalTimeZone, type DateValue } from '@internationalized/date';
	import { Breadcrumbs, Input, DateRangePicker } from '$lib/components/ui';
	import { caja } from '$lib/stores/caja.svelte';
	import { currency } from '$lib/utils';

	type RangoFecha = { start: DateValue | undefined; end: DateValue | undefined };

	const ventasMock = [
		{
			hora: '08:12 p. m.',
			fecha: new Date(2026, 7, 10, 20, 12),
			cliente: undefined,
			descripcion: '3 productos',
			pago: 'Efectivo',
			total: 45.0
		},
		{
			hora: '07:58 p. m.',
			fecha: new Date(2026, 7, 10, 19, 58),
			cliente: undefined,
			descripcion: '1 producto',
			pago: 'Yape',
			total: 12.5
		},
		{
			hora: '07:40 p. m.',
			fecha: new Date(2026, 7, 9, 19, 40),
			cliente: undefined,
			descripcion: '5 productos',
			pago: 'Tarjeta',
			total: 96.3
		},
		{
			hora: '07:15 p. m.',
			fecha: new Date(2026, 7, 9, 19, 15),
			cliente: undefined,
			descripcion: '2 productos',
			pago: 'Efectivo',
			total: 28.0
		},
		{
			hora: '06:52 p. m.',
			fecha: new Date(2026, 7, 8, 18, 52),
			cliente: undefined,
			descripcion: '4 productos',
			pago: 'Yape',
			total: 56.3
		}
	];

	const ventasLive = $derived(
		caja.ventas.map((v) => ({
			hora: v.hora,
			fecha: v.fecha,
			cliente: v.cliente,
			descripcion: v.descripcion,
			pago: v.metodo,
			total: v.monto
		}))
	);
	const ventas = $derived([...ventasLive, ...ventasMock]);

	let busqueda = $state('');
	let rango = $state<RangoFecha>({ start: undefined, end: undefined });
	const hayFiltros = $derived(
		busqueda !== '' || (rango.start !== undefined && rango.end !== undefined)
	);

	const ventasFiltradas = $derived(
		ventas.filter((venta) => {
			const texto = `${venta.cliente ?? ''} ${venta.descripcion} ${venta.pago}`.toLowerCase();
			if (!texto.includes(busqueda.toLowerCase())) return false;

			if (rango.start && rango.end) {
				const desde = rango.start.toDate(getLocalTimeZone());
				desde.setHours(0, 0, 0, 0);
				const hasta = rango.end.toDate(getLocalTimeZone());
				hasta.setHours(23, 59, 59, 999);
				if (venta.fecha < desde || venta.fecha > hasta) return false;
			}

			return true;
		})
	);
	const totalVentas = $derived(ventasFiltradas.reduce((acc, venta) => acc + venta.total, 0));

	const pagoStyles: Record<string, string> = {
		Efectivo: 'bg-emerald-100 text-emerald-700',
		Tarjeta: 'bg-sky-100 text-sky-700',
		Yape: 'bg-violet-100 text-violet-700'
	};
</script>

<svelte:head>
	<title>Ventas · La tiendita</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Ventas' }]} />

	<header class="flex items-center justify-between">
		<div class="flex flex-col gap-1">
			<h1 class="title">Ventas</h1>
			<p class="text-sm text-stone-400">Historial completo de todas las ventas realizadas.</p>
		</div>

		<div class="flex items-center gap-6">
			<div class="text-right">
				<p class="text-xs font-bold text-stone-400 uppercase">
					Total {hayFiltros ? 'filtrado' : 'registrado'}
				</p>
				<p class="text-2xl font-extrabold text-stone-800">{currency(totalVentas)}</p>
			</div>
			<a
				href="/dashboard/venta"
				class="flex items-center gap-2 rounded-xl bg-yellow-400 px-6 py-3.5 text-sm font-extrabold text-stone-800 transition-colors hover:bg-yellow-500"
			>
				<ScanBarcode size={16} strokeWidth={2.5} />
				Nueva Venta
			</a>
		</div>
	</header>

	<div class="flex items-center gap-3">
		<div class="max-w-sm flex-1">
			<Input bind:value={busqueda} placeholder="Buscar por cliente, producto o método…" type="text">
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
		<DateRangePicker bind:value={rango} class="w-64" />
	</div>

	<section
		aria-labelledby="ventas-heading"
		class="flex flex-1 flex-col gap-4 rounded-2xl bg-white p-6"
	>
		<h2 id="ventas-heading" class="sr-only">Listado de ventas</h2>
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-stone-100 text-left text-xs text-stone-400 uppercase">
					<th class="py-2 font-bold">Hora</th>
					<th class="py-2 font-bold">Cliente</th>
					<th class="py-2 font-bold">Productos</th>
					<th class="py-2 font-bold">Pago</th>
					<th class="py-2 text-right font-bold">Total</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-stone-100">
				{#if ventasFiltradas.length === 0}
					<tr>
						<td colspan="5" class="py-8 text-center text-sm text-stone-400">
							No se encontraron ventas
						</td>
					</tr>
				{/if}
				{#each ventasFiltradas as venta (venta.hora + venta.total)}
					<tr>
						<td class="py-3 text-stone-500">{venta.hora}</td>
						<td class="py-3 text-stone-500">{venta.cliente ?? '—'}</td>
						<td class="py-3 font-medium text-stone-700">{venta.descripcion}</td>
						<td class="py-3">
							<span class="rounded-full px-2.5 py-0.5 text-xs font-bold {pagoStyles[venta.pago]}">
								{venta.pago}
							</span>
						</td>
						<td class="py-3 text-right font-bold text-stone-800">{currency(venta.total)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</main>
