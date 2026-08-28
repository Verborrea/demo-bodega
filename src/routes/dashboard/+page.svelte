<script lang="ts">
	import Breadcrumbs from '$lib/components/ui/Breadcrumbs.svelte';
	import { currency, formatHora } from '$lib/utils';
	import Caja from '$lib/components/Caja.svelte';
	import RecargoPrecioSwitch from '$lib/components/RecargoPrecioSwitch.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// La sesión de caja abierta (con sus movimientos) ya llega vía el layout de /dashboard
	// (depends('caja:sesion')); "Ventas del turno" se deriva de ahí en vez de pedir una
	// query nueva al servidor.
	const ventasTurno = $derived(
		(data.sesionActual?.movimientos ?? [])
			.filter((m) => m.tipo === 'venta')
			.reduce((acc, m) => acc + m.monto, 0)
	);

	const esAdmin = $derived(data.user?.rol === 'admin');

	// Cajeras solo necesitan el pulso del turno y del día; mes/año son métricas de
	// negocio que le corresponden a la administradora.
	const tarjetasResumen = $derived(
		esAdmin
			? [
					{ label: 'Venta del turno', value: ventasTurno, color: 'bg-card-1 text-stone-50' },
					{ label: 'Ventas del día', value: data.resumen.dia, color: 'bg-card-2 text-stone-800' },
					{ label: 'Ventas del mes', value: data.resumen.mes, color: 'bg-card-3 text-stone-800' },
					{ label: 'Ventas del año', value: data.resumen.anio, color: 'bg-card-4 text-stone-800' }
				]
			: [
					{ label: 'Venta del turno', value: ventasTurno, color: 'bg-orange-300' },
					{ label: 'Ventas del día', value: data.resumen.dia, color: 'bg-primary' }
				]
	);

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
	<title>Dashboard · La Central</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-4 p-4 sm:p-6">
	<Breadcrumbs items={[{ label: 'Dashboard' }]} />

	<header class="hidden items-center justify-between @min-[768px]:flex">
		<div class="flex flex-col gap-2">
			<h1 class="title">Dashboard</h1>
			<p class="text-sm text-stone-400">El resumen de tu tienda hoy.</p>
		</div>
		<p class="mt-1 text-3xl font-bold text-stone-800 tabular-nums">{horaActual}</p>
	</header>

	<section
		aria-label="Resumen de ventas"
		class="grid gap-4 @min-[768px]:grid-cols-2 {esAdmin ? '@min-[900px]:grid-cols-4' : ''}"
	>
		{#each tarjetasResumen as card (card.label)}
			<div class="flex flex-col items-end gap-10 rounded-3xl {card.color} p-6">
				<p class="leading-none font-extrabold tracking-tight">{card.label}</p>
				<p class="text-3xl font-extrabold tracking-tighter">
					{currency(card.value)}
				</p>
			</div>
		{/each}
	</section>

	<div class="flex flex-col items-stretch gap-4 @min-[900px]:flex-row @min-[900px]:items-start">
		<div class="flex flex-1 flex-col gap-4">
			<RecargoPrecioSwitch />

			<section
				aria-labelledby="ventas-heading"
				class="flex flex-col gap-4 rounded-2xl border-2 border-stone-200 bg-white p-6"
			>
				<div class="flex items-center justify-between">
					<h2 id="ventas-heading" class="text-lg font-extrabold text-stone-800">Últimas ventas</h2>
					<a href="/dashboard/ventas" class="link text-sm">Ver todas las ventas</a>
				</div>

				<div class="hidden @min-[900px]:block">
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
										<span
											class="rounded-full px-2.5 py-0.5 text-xs font-bold {pagoStyles[venta.pago]}"
										>
											{venta.pago}
										</span>
									</td>
									<td class="py-3 text-right font-bold text-stone-800">{currency(venta.total)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="flex flex-col gap-2 @min-[900px]:hidden">
					{#if ultimasVentas.length === 0}
						<p class="rounded-xl bg-stone-50 p-6 text-center text-sm text-stone-400">
							Sin ventas todavía
						</p>
					{/if}
					{#each ultimasVentas as venta (venta.id)}
						<div class="flex items-center justify-between gap-3 rounded-xl bg-stone-50 p-3">
							<div class="min-w-0">
								<p class="truncate font-bold text-stone-800">{venta.descripcion}</p>
								<p class="text-xs text-stone-400">{venta.hora}</p>
							</div>
							<div class="flex shrink-0 items-center gap-2">
								<span class="rounded-full px-2.5 py-0.5 text-xs font-bold {pagoStyles[venta.pago]}">
									{venta.pago}
								</span>
								<span class="font-bold text-stone-800">{currency(venta.total)}</span>
							</div>
						</div>
					{/each}
				</div>
			</section>
		</div>
		<Caja />
	</div>
</main>
