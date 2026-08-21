<script lang="ts">
	import { tick } from 'svelte';
	import toast from 'svelte-french-toast';
	import { ExternalLink, Plus, Search, X, Receipt, Printer, Ban } from '@lucide/svelte';
	import { getLocalTimeZone, type DateValue } from '@internationalized/date';
	import { Breadcrumbs, Input, DateRangePicker, Dialog } from '$lib/components/ui';
	import { currency, formatHora } from '$lib/utils';
	import Button from '$lib/components/ui/Button.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type RangoFecha = { start: DateValue | undefined; end: DateValue | undefined };

	const TIPO_LABEL: Record<string, string> = {
		boleta: 'Boleta de Venta',
		nota_pedido: 'Nota de Pedido'
	};

	const ventas = $derived(
		data.ventas.map((v) => {
			const totalItems = v.items.reduce((acc, i) => acc + i.cantidad, 0);
			return {
				id: v.id,
				hora: formatHora(v.fecha),
				fecha: new Date(v.fecha),
				cliente: v.cliente ?? undefined,
				descripcion: `${totalItems} producto${totalItems === 1 ? '' : 's'}`,
				pago: v.metodo,
				total: v.total,
				tipo: TIPO_LABEL[v.tipo] ?? v.tipo,
				numeroDocumento: v.numeroDocumento,
				items: v.items
			};
		})
	);

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

	function formatearFecha(fecha: Date) {
		const dd = String(fecha.getDate()).padStart(2, '0');
		const mm = String(fecha.getMonth() + 1).padStart(2, '0');
		return `${dd}/${mm}/${fecha.getFullYear()}`;
	}

	let detalleOpen = $state(false);
	let ventaSeleccionada = $state<(typeof ventasFiltradas)[number] | null>(null);

	function verDetalle(venta: (typeof ventasFiltradas)[number]) {
		ventaSeleccionada = venta;
		detalleOpen = true;
	}

	// Anular es solo de interfaz para esta demo: no llama a ningún endpoint ni borra la venta de la BD.
	let ventasAnuladas = $state<Set<string>>(new Set());

	function anular(venta: (typeof ventasFiltradas)[number]) {
		ventasAnuladas.add(venta.id);
		ventasAnuladas = new Set(ventasAnuladas);
		toast.success('Venta anulada');
	}

	// Ticket de impresión: usa la API de impresión del navegador (window.print), así que
	// funciona con cualquier impresora instalada en el sistema, incluida una ticketera térmica.
	let ventaParaImprimir = $state<(typeof ventasFiltradas)[number] | null>(null);

	async function imprimirTicket(venta: (typeof ventasFiltradas)[number]) {
		ventaParaImprimir = venta;
		await tick();
		window.print();
	}
</script>

<svelte:head>
	<title>Ventas · La Central</title>
</svelte:head>

<main class="flex max-h-screen flex-1 flex-col gap-6 p-6">
	<Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Ventas' }]} />

	<header class="flex items-center justify-between">
		<div class="flex grow flex-col gap-1">
			<h1 class="title">Ventas</h1>
			<p class="text-sm text-stone-400">Historial completo de todas las ventas realizadas.</p>
		</div>

		<div class="flex items-center gap-6">
			<div class="shrink-0 text-right">
				<p class="text-xs font-bold text-stone-400 uppercase">
					Total {hayFiltros ? 'filtrado' : 'registrado'}
				</p>
				<p class="text-2xl font-extrabold text-stone-800">{currency(totalVentas)}</p>
			</div>
			<a href="/dashboard/venta" class="button primary">
				<Plus size={16} strokeWidth={3} />
				Nueva Venta
			</a>
		</div>
	</header>

	<div class="flex items-center gap-3">
		<div class="w-full max-w-md flex-1">
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
		<DateRangePicker bind:value={rango} class="w-auto" />
		<Button class="w-auto">
			<ExternalLink size={16} strokeWidth={2.5} />
			Exportar a PDF
		</Button>
	</div>

	<section
		aria-labelledby="ventas-heading"
		class="flex flex-1 flex-col gap-4 rounded-2xl border-2 border-stone-200 bg-white"
	>
		<h2 id="ventas-heading" class="sr-only">Listado de ventas</h2>
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-stone-100 text-left text-xs text-stone-400 uppercase">
					<th class="p-3 font-bold">Fecha</th>
					<th class="p-3 font-bold">Hora</th>
					<th class="p-3 font-bold">Cliente</th>
					<th class="p-3 font-bold">Productos</th>
					<th class="p-3 font-bold">Pago</th>
					<th class="p-3 text-right font-bold">Total</th>
					<th class="p-3"><span class="sr-only">Acciones</span></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-stone-100">
				{#if ventasFiltradas.length === 0}
					<tr>
						<td colspan="7" class="py-8 text-center text-sm text-stone-400">
							No se encontraron ventas
						</td>
					</tr>
				{/if}
				{#each ventasFiltradas as venta (venta.id)}
					{@const anulada = ventasAnuladas.has(venta.id)}
					<tr class={anulada ? 'opacity-50' : ''}>
						<td class="p-3 font-medium text-stone-800">{formatearFecha(venta.fecha)}</td>
						<td class="p-3 text-stone-500">{venta.hora}</td>
						<td class="p-3 font-medium text-stone-800">{venta.cliente ?? '—'}</td>
						<td class="p-3 font-medium text-stone-800">{venta.descripcion}</td>
						<td class="p-3">
							<div class="flex items-center gap-2">
								<span class="rounded-full px-2.5 py-0.5 text-xs font-bold {pagoStyles[venta.pago]}">
									{venta.pago}
								</span>
								{#if anulada}
									<span
										class="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700"
									>
										Anulada
									</span>
								{/if}
							</div>
						</td>
						<td class="p-3 text-right font-bold text-stone-800">{currency(venta.total)}</td>
						<td class="p-3">
							<div class="flex items-center justify-end gap-1">
								<button
									type="button"
									onclick={() => verDetalle(venta)}
									class="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
									aria-label="Ver detalle de la venta"
								>
									<Receipt size={16} />
								</button>
								<button
									type="button"
									onclick={() => imprimirTicket(venta)}
									class="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
									aria-label="Imprimir ticket"
								>
									<Printer size={16} />
								</button>
								<button
									type="button"
									onclick={() => anular(venta)}
									disabled={anulada}
									class="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
									aria-label="Anular venta"
								>
									<Ban size={16} />
								</button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</main>

<Dialog bind:open={detalleOpen} title="Detalle de venta">
	{#if ventaSeleccionada}
		<div class="flex flex-col gap-4">
			<div class="grid grid-cols-2 gap-3 text-sm">
				<div>
					<p class="text-xs font-bold text-stone-400 uppercase">Fecha</p>
					<p class="font-bold text-stone-800">
						{formatearFecha(ventaSeleccionada.fecha)} · {ventaSeleccionada.hora}
					</p>
				</div>
				<div>
					<p class="text-xs font-bold text-stone-400 uppercase">Cliente</p>
					<p class="font-bold text-stone-800">{ventaSeleccionada.cliente ?? '—'}</p>
				</div>
				<div>
					<p class="text-xs font-bold text-stone-400 uppercase">Pago</p>
					<span
						class="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold {pagoStyles[
							ventaSeleccionada.pago
						]}"
					>
						{ventaSeleccionada.pago}
					</span>
				</div>
				<div>
					<p class="text-xs font-bold text-stone-400 uppercase">Tipo</p>
					<p class="font-bold text-stone-800">
						{ventaSeleccionada.tipo}
						{#if ventaSeleccionada.numeroDocumento}
							· {ventaSeleccionada.numeroDocumento}
						{/if}
					</p>
				</div>
			</div>

			<div class="flex flex-col gap-2 rounded-xl bg-stone-50 p-3">
				{#if ventaSeleccionada.items && ventaSeleccionada.items.length > 0}
					{#each ventaSeleccionada.items as item (item.id)}
						<div class="flex items-center justify-between text-sm">
							<span class="text-stone-700">{item.cantidad} × {item.nombreProducto}</span>
							<span class="font-bold text-stone-800"
								>{currency(item.cantidad * item.precioUnitario)}</span
							>
						</div>
					{/each}
				{:else}
					<p class="text-sm text-stone-400">{ventaSeleccionada.descripcion}</p>
				{/if}
			</div>

			<div
				class="flex items-center justify-between border-t border-stone-100 pt-3 text-lg font-extrabold"
			>
				<span>Total</span>
				<span>{currency(ventaSeleccionada.total)}</span>
			</div>
		</div>
	{/if}
</Dialog>

<div id="ticket-imprimir" class="hidden">
	{#if ventaParaImprimir}
		<div class="w-full font-mono text-xs text-black">
			<p class="text-center text-sm font-bold">La Central</p>
			<p class="text-center">
				{ventaParaImprimir.tipo}
				{#if ventaParaImprimir.numeroDocumento}
					· {ventaParaImprimir.numeroDocumento}
				{/if}
			</p>
			<p class="text-center">{formatearFecha(ventaParaImprimir.fecha)} {ventaParaImprimir.hora}</p>
			<p class="mt-2">Cliente: {ventaParaImprimir.cliente ?? 'Público general'}</p>
			<div class="my-2 border-t border-dashed border-black"></div>
			{#each ventaParaImprimir.items as item (item.id)}
				<div class="flex justify-between">
					<span>{item.cantidad} {item.nombreProducto}</span>
					<span>{currency(item.cantidad * item.precioUnitario)}</span>
				</div>
			{/each}
			<div class="my-2 border-t border-dashed border-black"></div>
			<div class="flex justify-between text-sm font-bold">
				<span>TOTAL</span>
				<span>{currency(ventaParaImprimir.total)}</span>
			</div>
			<p class="mt-1">Pago: {ventaParaImprimir.pago}</p>
			<p class="mt-3 text-center">¡Gracias por su compra!</p>
		</div>
	{/if}
</div>
