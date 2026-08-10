<script lang="ts">
	import { caja } from '$lib/stores/caja.svelte';

	const ventasMock = [
		{
			hora: '08:12 p. m.',
			cliente: undefined,
			descripcion: '3 productos',
			pago: 'Efectivo',
			total: 45.0
		},
		{
			hora: '07:58 p. m.',
			cliente: undefined,
			descripcion: '1 producto',
			pago: 'Yape',
			total: 12.5
		},
		{
			hora: '07:40 p. m.',
			cliente: undefined,
			descripcion: '5 productos',
			pago: 'Tarjeta',
			total: 96.3
		},
		{
			hora: '07:15 p. m.',
			cliente: undefined,
			descripcion: '2 productos',
			pago: 'Efectivo',
			total: 28.0
		},
		{
			hora: '06:52 p. m.',
			cliente: undefined,
			descripcion: '4 productos',
			pago: 'Yape',
			total: 56.3
		}
	];

	const ventasLive = $derived(
		caja.ventas.map((v) => ({
			hora: v.hora,
			cliente: v.cliente,
			descripcion: v.descripcion,
			pago: v.metodo,
			total: v.monto
		}))
	);
	const ventas = $derived([...ventasLive, ...ventasMock]);
	const totalVentas = $derived(ventas.reduce((acc, v) => acc + v.total, 0));

	const pagoStyles: Record<string, string> = {
		Efectivo: 'bg-emerald-100 text-emerald-700',
		Tarjeta: 'bg-sky-100 text-sky-700',
		Yape: 'bg-violet-100 text-violet-700'
	};

	function currency(value: number) {
		return `S/ ${value.toFixed(2)}`;
	}
</script>

<svelte:head>
	<title>Ventas · La tiendita</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<header class="flex items-center justify-between">
		<div>
			<h1 class="title text-2xl">Ventas</h1>
			<p class="mt-0.5 text-sm text-stone-400">Historial completo de ventas registradas</p>
		</div>
		<div class="text-right">
			<p class="text-xs font-bold text-stone-400 uppercase">Total registrado</p>
			<p class="text-2xl font-extrabold text-stone-800">{currency(totalVentas)}</p>
		</div>
	</header>

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
				{#each ventas as venta (venta.hora + venta.total)}
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
