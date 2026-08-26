<script lang="ts">
	import { tick } from 'svelte';
	import { invalidate } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import {
		Plus,
		Search,
		X,
		Receipt,
		Printer,
		Ban,
		User,
		Pencil,
		Trash2,
		Package,
		Clock,
		CreditCard
	} from '@lucide/svelte';
	import { getLocalTimeZone, type DateValue } from '@internationalized/date';
	import {
		Breadcrumbs,
		Input,
		DateRangePicker,
		Dialog,
		ConfirmDialog,
		Select,
		MoneyInput,
		DataTable,
		type ColumnaTabla
	} from '$lib/components/ui';
	import type { OrdenVenta } from '$lib/server/ventas';
	import {
		currency,
		formatFecha,
		formatHora,
		esperarImagenesListas,
		formatPagos
	} from '$lib/utils';
	import Button from '$lib/components/ui/Button.svelte';
	import TicketImpresion from '$lib/components/TicketImpresion.svelte';
	import type { PageData } from './$types';
	import type { VentaDTO } from '$lib/server/ventas';
	import type { MetodoCaja } from '$lib/server/caja';

	const METODOS_PAGO: MetodoCaja[] = ['Efectivo', 'Yape', 'Tarjeta'];

	function colorPago(metodo: string) {
		return metodo === 'Efectivo'
			? 'bg-emerald-100 text-emerald-700'
			: metodo === 'Tarjeta'
				? 'bg-sky-100 text-sky-700'
				: 'bg-violet-100 text-violet-700';
	}

	let { data }: { data: PageData } = $props();

	type RangoFecha = { start: DateValue | undefined; end: DateValue | undefined };

	const TIPO_LABEL: Record<string, string> = {
		boleta: 'Boleta de Venta',
		nota_pedido: 'Nota de Pedido'
	};

	const pageSize = data.pageSize;
	let ventasRaw = $state<VentaDTO[]>(data.ventas);
	let total = $state(data.total);
	let sumaTotal = $state(data.sumaTotal);
	let pagina = $state(1);
	let cargando = $state(false);

	const totalPaginas = $derived(Math.max(1, Math.ceil(total / pageSize)));

	const ventas = $derived(
		ventasRaw.map((v) => {
			const totalItems = v.items.reduce((acc, i) => acc + i.cantidad, 0);
			return {
				id: v.id,
				hora: formatHora(v.fecha),
				fecha: new Date(v.fecha),
				cliente: v.cliente ?? undefined,
				cajero: v.cajeroNombre,
				descripcion: `${totalItems} producto${totalItems === 1 ? '' : 's'}`,
				pago: v.metodo,
				pagos: v.pagos,
				total: v.total,
				estado: v.estado,
				tipo: TIPO_LABEL[v.tipo] ?? v.tipo,
				esBoleta: v.tipo === 'boleta',
				numeroComprobante:
					v.serie && v.correlativo ? `${v.serie}-${String(v.correlativo).padStart(8, '0')}` : null,
				sunatEstado: v.sunatEstado,
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

	let ordenPor = $state<OrdenVenta | null>('fecha');
	let ordenDireccion = $state<'asc' | 'desc'>('desc');
	// Tres estados por columna: asc → desc → sin orden (vuelve al orden por defecto del servidor).
	function onOrdenar(columnaId: string) {
		if (ordenPor === columnaId) {
			if (ordenDireccion === 'asc') {
				ordenDireccion = 'desc';
			} else {
				ordenPor = null;
			}
		} else {
			ordenPor = columnaId as OrdenVenta;
			ordenDireccion = 'asc';
		}
		pagina = 1;
		cargarVentas();
	}

	// Evita que una respuesta vieja (filtro/página ya reemplazados) llegue después de una
	// más nueva y pise el resultado correcto en pantalla.
	let cargaId = 0;
	async function cargarVentas() {
		const miCarga = ++cargaId;
		cargando = true;
		try {
			const params = new URLSearchParams({
				page: String(pagina),
				pageSize: String(pageSize),
				orderBy: ordenPor ?? 'fecha',
				orderDir: ordenPor ? ordenDireccion : 'desc'
			});
			if (busqueda.trim()) params.set('search', busqueda.trim());
			if (rango.start)
				params.set('fechaInicio', rango.start.toDate(getLocalTimeZone()).toISOString());
			if (rango.end) params.set('fechaFin', rango.end.toDate(getLocalTimeZone()).toISOString());
			const res = await fetch(`/api/ventas?${params}`);
			if (!res.ok) throw new Error('request failed');
			const resultado = (await res.json()) as {
				ventas: VentaDTO[];
				total: number;
				sumaTotal: number;
			};
			if (miCarga !== cargaId) return;
			ventasRaw = resultado.ventas;
			total = resultado.total;
			sumaTotal = resultado.sumaTotal;
		} catch {
			if (miCarga === cargaId) toast.error('No se pudo cargar las ventas');
		} finally {
			if (miCarga === cargaId) cargando = false;
		}
	}

	let debounceHandle: ReturnType<typeof setTimeout> | undefined;
	function onBusquedaInput() {
		pagina = 1;
		clearTimeout(debounceHandle);
		debounceHandle = setTimeout(cargarVentas, 300);
	}

	let montado = false;
	$effect(() => {
		void rango.start;
		void rango.end;
		if (montado) {
			pagina = 1;
			cargarVentas();
		}
		montado = true;
	});

	function irAPagina(n: number) {
		if (n < 1 || n > totalPaginas || n === pagina) return;
		pagina = n;
		cargarVentas();
	}

	/** Fecha del ticket impreso: dd/mm/aaaa a propósito, formato de recibo, no la fecha humana de la UI. */
	function formatearFechaTicket(fecha: Date) {
		const dd = String(fecha.getDate()).padStart(2, '0');
		const mm = String(fecha.getMonth() + 1).padStart(2, '0');
		return `${dd}/${mm}/${fecha.getFullYear()}`;
	}

	let detalleOpen = $state(false);
	let ventaSeleccionada = $state<(typeof ventas)[number] | null>(null);

	function verDetalle(venta: (typeof ventas)[number]) {
		ventaSeleccionada = venta;
		editandoPago = false;
		detalleOpen = true;
	}

	// --- Corregir método(s) de pago de una venta ya registrada (p.ej. la cajera se
	// equivocó de método). A diferencia de "Anular" (solo de interfaz), esto sí persiste. ---
	let editandoPago = $state(false);
	let pagosEdicion = $state<{ metodo: MetodoCaja; monto: string }[]>([]);
	let guardandoPago = $state(false);

	const sumaPagosEdicion = $derived(
		pagosEdicion.reduce((acc, p) => acc + (Number(p.monto) || 0), 0)
	);
	const restantePagoEdicion = $derived(
		ventaSeleccionada ? Math.round((ventaSeleccionada.total - sumaPagosEdicion) * 100) / 100 : 0
	);

	function iniciarEdicionPago() {
		if (!ventaSeleccionada) return;
		pagosEdicion =
			ventaSeleccionada.pagos.length > 0
				? ventaSeleccionada.pagos.map((p) => ({ metodo: p.metodo, monto: String(p.monto) }))
				: [{ metodo: 'Efectivo', monto: String(ventaSeleccionada.total) }];
		editandoPago = true;
	}

	function agregarPagoEdicion() {
		const usados = new Set(pagosEdicion.map((p) => p.metodo));
		const disponible = METODOS_PAGO.find((m) => !usados.has(m)) ?? 'Efectivo';
		pagosEdicion = [...pagosEdicion, { metodo: disponible, monto: '' }];
	}

	function quitarPagoEdicion(index: number) {
		if (pagosEdicion.length <= 1) return;
		pagosEdicion = pagosEdicion.filter((_, i) => i !== index);
	}

	async function guardarPagoEdicion() {
		if (!ventaSeleccionada) return;
		if (Math.abs(restantePagoEdicion) > 0.01) {
			toast.error('Los montos no cuadran con el total de la venta');
			return;
		}
		guardandoPago = true;
		try {
			const res = await fetch(`/api/ventas/${ventaSeleccionada.id}/pago`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pagos: pagosEdicion.map((p) => ({ metodo: p.metodo, monto: Number(p.monto) || 0 }))
				})
			});
			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo actualizar el pago');
				return;
			}
			toast.success('Pago corregido');
			editandoPago = false;
			await cargarVentas();
			const actualizada = ventas.find((v) => v.id === ventaSeleccionada!.id);
			if (actualizada) ventaSeleccionada = actualizada;
		} finally {
			guardandoPago = false;
		}
	}

	let confirmAnularOpen = $state(false);
	let ventaAAnular = $state<(typeof ventas)[number] | null>(null);
	let anulando = $state(false);

	function pedirAnular(venta: (typeof ventas)[number]) {
		ventaAAnular = venta;
		confirmAnularOpen = true;
	}

	async function confirmarAnular() {
		if (!ventaAAnular) return;
		anulando = true;
		try {
			const res = await fetch(`/api/ventas/${ventaAAnular.id}/anular`, { method: 'PATCH' });
			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo anular la venta');
				return;
			}
			toast.success('Venta anulada');
			confirmAnularOpen = false;
			await Promise.all([cargarVentas(), invalidate('caja:sesion')]);
		} finally {
			anulando = false;
		}
	}

	// Ticket de impresión: usa la API de impresión del navegador (window.print), así que
	// funciona con cualquier impresora instalada en el sistema, incluida una ticketera térmica.
	let ventaParaImprimir = $state<(typeof ventas)[number] | null>(null);
	let ticketImpresionRef: ReturnType<typeof TicketImpresion> | undefined;
	const ticketParaImprimir = $derived(
		ventaParaImprimir
			? {
					tipo: ventaParaImprimir.tipo,
					esBoleta: ventaParaImprimir.esBoleta,
					numeroComprobante: ventaParaImprimir.numeroComprobante,
					sunatEstado: ventaParaImprimir.sunatEstado,
					numeroDocumento: ventaParaImprimir.numeroDocumento,
					cliente: ventaParaImprimir.cliente,
					fechaLabel: formatearFechaTicket(ventaParaImprimir.fecha),
					horaLabel: ventaParaImprimir.hora,
					pago: formatPagos(ventaParaImprimir.pagos),
					items: ventaParaImprimir.items,
					total: ventaParaImprimir.total
				}
			: null
	);

	async function imprimirTicket(venta: (typeof ventas)[number]) {
		ventaParaImprimir = venta;
		await tick();
		await ticketImpresionRef?.esperarQrListo();
		await esperarImagenesListas('#ticket-imprimir');
		window.print();
	}
</script>

<svelte:head>
	<title>Ventas · La Central</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Ventas' }]} />

	<header
		class="flex flex-col gap-4 @min-[768px]:flex-row @min-[768px]:items-center @min-[768px]:justify-between"
	>
		<div class="flex grow flex-col gap-1">
			<h1 class="title">Ventas</h1>
			<p class="text-sm text-stone-400">Historial completo de todas las ventas realizadas.</p>
		</div>

		<div class="flex items-center justify-between gap-6 @min-[768px]:justify-end">
			<div class="shrink-0">
				<p class="text-xs font-bold text-stone-400 uppercase">
					Total {hayFiltros ? 'filtrado' : 'registrado'}
				</p>
				<p class="text-2xl font-extrabold text-stone-800">{currency(sumaTotal)}</p>
			</div>
			<a href="/dashboard/venta" class="button primary w-auto shrink-0 px-6">
				<Plus size={16} strokeWidth={3} />
				Nueva Venta
			</a>
		</div>
	</header>

	<div class="flex flex-col gap-3 @min-[640px]:flex-row @min-[640px]:items-center">
		<div class="w-full max-w-md flex-1">
			<Input
				bind:value={busqueda}
				oninput={onBusquedaInput}
				placeholder="Buscar por cliente, cajero, producto o método…"
				type="text"
			>
				{#snippet icon()}
					<Search size={16} />
				{/snippet}
				{#snippet trailing()}
					{#if busqueda}
						<button
							type="button"
							onclick={() => {
								busqueda = '';
								onBusquedaInput();
							}}
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
	</div>

	{#snippet celdaPago(venta: (typeof ventas)[number])}
		{@const anulada = venta.estado === 'anulada'}
		<div class="flex flex-wrap items-center gap-1">
			{#each venta.pagos as pago (pago.metodo)}
				<span class="rounded-full px-2.5 py-0.5 text-xs font-bold {colorPago(pago.metodo)}">
					{pago.metodo}{#if venta.pagos.length > 1}
						· {currency(pago.monto)}{/if}
				</span>
			{:else}
				<span class="rounded-full px-2.5 py-0.5 text-xs font-bold {colorPago(venta.pago)}">
					{venta.pago}
				</span>
			{/each}
			{#if anulada}
				<span class="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
					Anulada
				</span>
			{/if}
		</div>
	{/snippet}

	{#snippet celdaAcciones(venta: (typeof ventas)[number])}
		{@const anulada = venta.estado === 'anulada'}
		<div class="flex items-center justify-end gap-1">
			<button
				type="button"
				onclick={() => verDetalle(venta)}
				class="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
				aria-label="Ver detalle de la venta"
			>
				<Receipt size={16} />
			</button>
			<button
				type="button"
				onclick={() => imprimirTicket(venta)}
				class="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
				aria-label="Imprimir ticket"
			>
				<Printer size={16} />
			</button>
			<button
				type="button"
				onclick={() => pedirAnular(venta)}
				disabled={anulada}
				class="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
				aria-label="Anular venta"
			>
				<Ban size={16} />
			</button>
		</div>
	{/snippet}

	{#snippet tarjetaVenta(venta: (typeof ventas)[number])}
		{@const anulada = venta.estado === 'anulada'}
		<div
			class="flex flex-col gap-3 rounded-2xl border-2 border-stone-200 bg-white p-4 {anulada
				? 'opacity-60'
				: ''}"
		>
			<div class="flex items-start justify-between gap-2">
				<div class="min-w-0">
					<p class="truncate font-extrabold text-stone-800">{venta.cliente ?? venta.tipo}</p>
					<p class="flex items-center gap-1.5 text-xs text-stone-400">
						<User size={12} />
						{venta.cajero}
					</p>
				</div>
				<p class="shrink-0 text-lg font-extrabold text-stone-800">{currency(venta.total)}</p>
			</div>
			<div class="flex flex-col gap-1.5 text-sm text-stone-500">
				<span class="flex items-center gap-2">
					<Package size={14} class="text-stone-400" />
					{venta.descripcion}
				</span>
				<span class="flex items-center gap-2">
					<Clock size={14} class="text-stone-400" />
					{formatFecha(venta.fecha)} · {venta.hora}
				</span>
				<span class="flex flex-wrap items-center gap-1.5">
					<CreditCard size={14} class="text-stone-400" />
					{@render celdaPago(venta)}
				</span>
			</div>
			<div class="flex items-center gap-2 border-t border-stone-100 pt-3">
				<button
					type="button"
					onclick={() => verDetalle(venta)}
					class="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-stone-100 text-sm font-bold text-stone-700"
				>
					<Receipt size={16} />
					Ver
				</button>
				<button
					type="button"
					onclick={() => imprimirTicket(venta)}
					class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-stone-100 text-stone-500"
					aria-label="Imprimir ticket"
				>
					<Printer size={16} />
				</button>
				<button
					type="button"
					onclick={() => pedirAnular(venta)}
					disabled={anulada}
					class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-stone-100 text-red-500 disabled:opacity-30"
					aria-label="Anular venta"
				>
					<Ban size={16} />
				</button>
			</div>
		</div>
	{/snippet}

	{#snippet celdaFecha(venta: (typeof ventas)[number])}
		<span class="font-medium text-stone-800">{formatFecha(venta.fecha)}</span>
	{/snippet}
	{#snippet celdaHora(venta: (typeof ventas)[number])}
		<span class="text-stone-500">{venta.hora}</span>
	{/snippet}
	{#snippet celdaCliente(venta: (typeof ventas)[number])}
		<span class="font-medium text-stone-800">{venta.cliente ?? '—'}</span>
	{/snippet}
	{#snippet celdaCajero(venta: (typeof ventas)[number])}
		<span class="flex items-center gap-1.5 text-stone-500">
			<User size={13} class="text-stone-400" />
			{venta.cajero}
		</span>
	{/snippet}
	{#snippet celdaProductos(venta: (typeof ventas)[number])}
		<span class="font-medium text-stone-800">{venta.descripcion}</span>
	{/snippet}
	{#snippet celdaTotal(venta: (typeof ventas)[number])}
		<span class="font-bold text-stone-800">{currency(venta.total)}</span>
	{/snippet}

	<DataTable
		columnas={[
			{ id: 'fecha', etiqueta: 'Fecha', ordenable: true, celda: celdaFecha },
			{ id: 'hora', etiqueta: 'Hora', celda: celdaHora },
			{ id: 'cliente', etiqueta: 'Cliente', ordenable: true, celda: celdaCliente },
			{ id: 'cajero', etiqueta: 'Cajero', ordenable: true, celda: celdaCajero },
			{ id: 'productos', etiqueta: 'Productos', celda: celdaProductos },
			{ id: 'pago', etiqueta: 'Pago', celda: celdaPago },
			{ id: 'total', etiqueta: 'Total', ordenable: true, alinear: 'derecha', celda: celdaTotal },
			{ id: 'acciones', etiqueta: '', celda: celdaAcciones }
		] as ColumnaTabla<(typeof ventas)[number]>[]}
		filas={ventas}
		claveFila={(v) => v.id}
		{cargando}
		mensajeVacio="No se encontraron ventas"
		{ordenPor}
		{ordenDireccion}
		{onOrdenar}
		tarjetaMovil={tarjetaVenta}
		{pagina}
		{totalPaginas}
		{total}
		{pageSize}
		onCambiarPagina={irAPagina}
	/>
</main>

<Dialog bind:open={detalleOpen} title="Detalle de venta">
	{#if ventaSeleccionada}
		<div class="flex flex-col gap-4">
			<div class="grid grid-cols-2 gap-3 text-sm">
				<div class="col-span-2">
					<p class="text-xs font-bold text-stone-400 uppercase">Fecha</p>
					<p class="font-bold text-stone-800">
						{formatFecha(ventaSeleccionada.fecha)} · {ventaSeleccionada.hora}
					</p>
				</div>
				<div>
					<p class="text-xs font-bold text-stone-400 uppercase">Cliente</p>
					<p class="font-bold text-stone-800">{ventaSeleccionada.cliente ?? '—'}</p>
				</div>
				<div>
					<p class="text-xs font-bold text-stone-400 uppercase">Cajero</p>
					<p class="font-bold text-stone-800">{ventaSeleccionada.cajero}</p>
				</div>
				<div class="col-span-2">
					<p class="text-xs font-bold text-stone-400 uppercase">Tipo</p>
					<p class="font-bold text-stone-800">
						{ventaSeleccionada.tipo}
						{#if ventaSeleccionada.numeroDocumento}
							· {ventaSeleccionada.numeroDocumento}
						{/if}
					</p>
				</div>
				<div class="col-span-2">
					<div class="flex items-center justify-between">
						<p class="text-xs font-bold text-stone-400 uppercase">Pago</p>
						{#if !editandoPago}
							<button
								type="button"
								onclick={iniciarEdicionPago}
								class="flex cursor-pointer items-center gap-1 text-xs font-bold text-stone-400 hover:text-stone-700"
							>
								<Pencil size={12} strokeWidth={2.5} />
								Corregir
							</button>
						{/if}
					</div>
					{#if editandoPago}
						<div class="mt-1 flex flex-col gap-2">
							{#each pagosEdicion as pago, index (index)}
								<div class="flex items-center gap-2">
									<Select bind:value={pago.metodo} class="flex-1">
										{#each METODOS_PAGO as metodo (metodo)}
											<option value={metodo}>{metodo}</option>
										{/each}
									</Select>
									<MoneyInput bind:value={pago.monto} class="w-28 shrink-0" />
									<button
										type="button"
										onclick={() => quitarPagoEdicion(index)}
										disabled={pagosEdicion.length <= 1}
										class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
										aria-label="Quitar método de pago"
									>
										<Trash2 size={16} />
									</button>
								</div>
							{/each}
							<div class="flex items-center justify-between">
								<button
									type="button"
									onclick={agregarPagoEdicion}
									disabled={pagosEdicion.length >= METODOS_PAGO.length}
									class="link text-xs"
								>
									<Plus size={12} strokeWidth={3} />
									Agregar método
								</button>
								<p
									class="text-xs font-bold {Math.abs(restantePagoEdicion) < 0.01
										? 'text-emerald-600'
										: 'text-red-500'}"
								>
									{Math.abs(restantePagoEdicion) < 0.01
										? 'Cuadra ✓'
										: restantePagoEdicion > 0
											? `Falta ${currency(restantePagoEdicion)}`
											: `Sobra ${currency(-restantePagoEdicion)}`}
								</p>
							</div>
							<div class="grid grid-cols-2 gap-2">
								<Button type="button" variant="danger" onclick={() => (editandoPago = false)}>
									Cancelar
								</Button>
								<Button
									type="button"
									variant="success"
									disabled={guardandoPago}
									onclick={guardarPagoEdicion}
								>
									{guardandoPago ? 'Guardando…' : 'Guardar'}
								</Button>
							</div>
						</div>
					{:else}
						<div class="mt-1 flex flex-wrap items-center gap-1">
							{#each ventaSeleccionada.pagos as pago (pago.metodo)}
								<span
									class="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold {colorPago(
										pago.metodo
									)}"
								>
									{pago.metodo}{#if ventaSeleccionada.pagos.length > 1}
										· {currency(pago.monto)}{/if}
								</span>
							{:else}
								<span
									class="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold {colorPago(
										ventaSeleccionada.pago
									)}"
								>
									{ventaSeleccionada.pago}
								</span>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<div class="flex flex-col gap-2 rounded-xl bg-stone-50 py-3">
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

<TicketImpresion venta={ticketParaImprimir} bind:this={ticketImpresionRef} />

<ConfirmDialog
	bind:open={confirmAnularOpen}
	title="Anular venta"
	message={`¿Anular la venta de ${currency(ventaAAnular?.total ?? 0)}${ventaAAnular?.cliente ? ` a ${ventaAAnular.cliente}` : ''}?`}
	confirmLabel="Anular"
	confirmando={anulando}
	onConfirm={confirmarAnular}
/>
