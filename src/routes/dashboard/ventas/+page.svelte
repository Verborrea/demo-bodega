<script lang="ts">
	import { ExternalLink, ScanBarcode, Search, X, Receipt } from '@lucide/svelte';
	import { getLocalTimeZone, type DateValue } from '@internationalized/date';
	import { Breadcrumbs, Input, DateRangePicker, Dialog } from '$lib/components/ui';
	import { caja, type ItemVenta, type TipoComprobante } from '$lib/stores/caja.svelte';
	import { currency } from '$lib/utils';
	import Button from '$lib/components/ui/Button.svelte';

	type RangoFecha = { start: DateValue | undefined; end: DateValue | undefined };

	const ventasMock = [
		{
			hora: '08:12 p. m.',
			fecha: new Date(2026, 7, 10, 20, 12),
			cliente: undefined,
			descripcion: '3 productos',
			pago: 'Efectivo',
			total: 45.0,
			comprobante: 'Boleta' as TipoComprobante,
			items: [{ nombre: 'Menú del día', cantidad: 3, precioUnitario: 15.0 }] as ItemVenta[]
		},
		{
			hora: '07:58 p. m.',
			fecha: new Date(2026, 7, 10, 19, 58),
			cliente: undefined,
			descripcion: '1 producto',
			pago: 'Yape',
			total: 12.5,
			comprobante: 'Boleta' as TipoComprobante,
			items: [{ nombre: 'Combo desayuno', cantidad: 1, precioUnitario: 12.5 }] as ItemVenta[]
		},
		{
			hora: '07:40 p. m.',
			fecha: new Date(2026, 7, 9, 19, 40),
			cliente: undefined,
			descripcion: '5 productos',
			pago: 'Tarjeta',
			total: 96.3,
			comprobante: 'Factura' as TipoComprobante,
			items: [
				{ nombre: 'Arroz 1kg', cantidad: 4, precioUnitario: 20.0 },
				{ nombre: 'Aceite 1L', cantidad: 1, precioUnitario: 16.3 }
			] as ItemVenta[]
		},
		{
			hora: '07:15 p. m.',
			fecha: new Date(2026, 7, 9, 19, 15),
			cliente: undefined,
			descripcion: '2 productos',
			pago: 'Efectivo',
			total: 28.0,
			comprobante: 'Boleta' as TipoComprobante,
			items: [{ nombre: 'Detergente', cantidad: 2, precioUnitario: 14.0 }] as ItemVenta[]
		},
		{
			hora: '06:52 p. m.',
			fecha: new Date(2026, 7, 8, 18, 52),
			cliente: undefined,
			descripcion: '4 productos',
			pago: 'Yape',
			total: 56.3,
			comprobante: 'Factura' as TipoComprobante,
			items: [
				{ nombre: 'Cerveza 620ml', cantidad: 3, precioUnitario: 15.0 },
				{ nombre: 'Cigarros', cantidad: 1, precioUnitario: 11.3 }
			] as ItemVenta[]
		},
		{
			hora: '07:16 p. m.',
			fecha: new Date(2026, 7, 9, 19, 15),
			cliente: undefined,
			descripcion: '2 productos',
			pago: 'Efectivo',
			total: 28.0,
			comprobante: 'Boleta' as TipoComprobante,
			items: [{ nombre: 'Detergente', cantidad: 2, precioUnitario: 14.0 }] as ItemVenta[]
		},
		{
			hora: '12:52 p. m.',
			fecha: new Date(2026, 7, 8, 18, 52),
			cliente: undefined,
			descripcion: '4 productos',
			pago: 'Yape',
			total: 56.3,
			comprobante: 'Factura' as TipoComprobante,
			items: [
				{ nombre: 'Cerveza 620ml', cantidad: 3, precioUnitario: 15.0 },
				{ nombre: 'Cigarros', cantidad: 1, precioUnitario: 11.3 }
			] as ItemVenta[]
		}
	];

	const ventasLive = $derived(
		caja.ventas.map((v) => ({
			hora: v.hora,
			fecha: v.fecha,
			cliente: v.cliente,
			descripcion: v.descripcion,
			pago: v.metodo,
			total: v.monto,
			comprobante: v.comprobante,
			items: v.items
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
</script>

<svelte:head>
	<title>Ventas · La tiendita</title>
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
				<ScanBarcode size={16} strokeWidth={2.5} />
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
					<th class="p-3"><span class="sr-only">Detalle</span></th>
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
				{#each ventasFiltradas as venta (venta.hora + venta.total)}
					<tr>
						<td class="p-3 font-medium text-stone-800">{formatearFecha(venta.fecha)}</td>
						<td class="p-3 text-stone-500">{venta.hora}</td>
						<td class="p-3 font-medium text-stone-800">{venta.cliente ?? '—'}</td>
						<td class="p-3 font-medium text-stone-800">{venta.descripcion}</td>
						<td class="p-3">
							<span class="rounded-full px-2.5 py-0.5 text-xs font-bold {pagoStyles[venta.pago]}">
								{venta.pago}
							</span>
						</td>
						<td class="p-3 text-right font-bold text-stone-800">{currency(venta.total)}</td>
						<td class="p-3 text-right">
							<button
								type="button"
								onclick={() => verDetalle(venta)}
								class="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
								aria-label="Ver detalle de la venta"
							>
								<Receipt size={16} />
							</button>
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
					<p class="text-xs font-bold text-stone-400 uppercase">Comprobante</p>
					<p class="font-bold text-stone-800">{ventaSeleccionada.comprobante ?? 'Boleta'}</p>
				</div>
			</div>

			<div class="flex flex-col gap-2 rounded-xl bg-stone-50 p-3">
				{#if ventaSeleccionada.items && ventaSeleccionada.items.length > 0}
					{#each ventaSeleccionada.items as item (item.nombre)}
						<div class="flex items-center justify-between text-sm">
							<span class="text-stone-700">{item.cantidad} × {item.nombre}</span>
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
