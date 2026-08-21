<script lang="ts">
	import Breadcrumbs from '$lib/components/ui/Breadcrumbs.svelte';
	import { currency, formatHora } from '$lib/utils';
	import Caja from '$lib/components/Caja.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const resumen = $derived([
		{ label: 'Ventas del día', value: data.ventasDelDia, color: 'bg-yellow-400' },
		{ label: 'Ventas de la semana', value: 1572.6, color: 'bg-violet-300' },
		{ label: 'Ventas del mes', value: 8724.5, color: 'bg-sky-300' },
		{ label: 'Ventas del año', value: 45890.75, color: 'bg-emerald-300' }
	]);

	const ultimasVentas = $derived(
		data.ultimasVentas.map((venta) => {
			const cantidad = venta.items.reduce((acc, item) => acc + item.cantidad, 0);
			return {
				id: venta.id,
				hora: formatHora(venta.fecha),
				descripcion: `${cantidad} producto${cantidad === 1 ? '' : 's'}`,
				pago: venta.metodo,
				total: venta.total
			};
		})
	);

	const pagoStyles: Record<string, string> = {
		Efectivo: 'bg-emerald-100 text-emerald-700',
		Tarjeta: 'bg-sky-100 text-sky-700',
		Yape: 'bg-violet-100 text-violet-700'
	};

	let now = $state(new Date());
	$effect(() => {
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});
	const horaActual = $derived(
		now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
	);
</script>

<svelte:head>
	<title>Dashboard · La tiendita</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<Breadcrumbs items={[{ label: 'Dashboard' }]} />

	<header class="flex items-center justify-between">
		<div class="flex flex-col gap-2">
			<h1 class="title">Dashboard</h1>
			<p class="text-sm text-stone-400">El resumen de tu tienda hoy.</p>
		</div>
		<p class="mt-1 text-3xl font-bold text-stone-800 tabular-nums">{horaActual}</p>
	</header>

	<section aria-label="Resumen de ventas" class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		{#each resumen as card (card.label)}
			<div class="flex flex-col gap-4 rounded-2xl {card.color} p-5">
				<p class="font-bold text-stone-800">{card.label}</p>
				<p class="text-3xl font-extrabold tracking-tight text-stone-800">
					{currency(card.value)}
				</p>
			</div>
		{/each}
	</section>

	<div class="flex flex-col items-start gap-6 lg:flex-row">
		<section
			aria-labelledby="ventas-heading"
			class="flex flex-1 flex-col gap-4 rounded-2xl border-2 border-stone-200 bg-white p-6"
		>
			<div class="flex items-center justify-between">
				<h2 id="ventas-heading" class="text-lg font-extrabold text-stone-800">Últimas ventas</h2>
				<a href="/dashboard/ventas" class="link text-sm">Ver todas las ventas</a>
			</div>

			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-stone-100 text-left text-xs text-stone-400 uppercase">
						<th class="py-2 font-bold">Hora</th>
						<th class="py-2 font-bold">Productos</th>
						<th class="py-2 font-bold">Pago</th>
						<th class="py-2 text-right font-bold">Total</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-stone-100">
					{#each ultimasVentas as venta (venta.id)}
						<tr>
							<td class="py-3 text-stone-500">{venta.hora}</td>
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
		<Caja />
	</div>
</main>
