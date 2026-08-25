<script lang="ts">
	import { tick } from 'svelte';
	import toast from 'svelte-french-toast';
	import {
		Plus,
		Search,
		X,
		Receipt,
		Printer,
		Ban,
		ChevronLeft,
		ChevronRight,
		User,
		Pencil,
		Trash2
	} from '@lucide/svelte';
	import { getLocalTimeZone, type DateValue } from '@internationalized/date';
	import {
		Breadcrumbs,
		Input,
		DateRangePicker,
		Dialog,
		ConfirmDialog,
		Select,
		MoneyInput
	} from '$lib/components/ui';
	import { currency, formatHora, esperarImagenesListas, formatPagos } from '$lib/utils';
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

	async function cargarVentas() {
		cargando = true;
		try {
			const params = new URLSearchParams({ page: String(pagina), pageSize: String(pageSize) });
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
			ventasRaw = resultado.ventas;
			total = resultado.total;
			sumaTotal = resultado.sumaTotal;
		} catch {
			toast.error('No se pudo cargar las ventas');
		} finally {
			cargando = false;
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

	function formatearFecha(fecha: Date) {
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

	// Anular es solo de interfaz para esta demo: no llama a ningún endpoint ni borra la venta de la BD.
	let ventasAnuladas = $state<Set<string>>(new Set());
	let confirmAnularOpen = $state(false);
	let ventaAAnular = $state<(typeof ventas)[number] | null>(null);

	function pedirAnular(venta: (typeof ventas)[number]) {
		ventaAAnular = venta;
		confirmAnularOpen = true;
	}

	function confirmarAnular() {
		if (!ventaAAnular) return;
		ventasAnuladas.add(ventaAAnular.id);
		ventasAnuladas = new Set(ventasAnuladas);
		confirmAnularOpen = false;
		toast.success('Venta anulada');
	}

	// Ticket de impresión: usa la API de impresión del navegador (window.print), así que
	// funciona con cualquier impresora instalada en el sistema, incluida una ticketera térmica.
	let ventaParaImprimir = $state<(typeof ventas)[number] | null>(null);
	const ticketParaImprimir = $derived(
		ventaParaImprimir
			? {
					tipo: ventaParaImprimir.tipo,
					numeroDocumento: ventaParaImprimir.numeroDocumento,
					cliente: ventaParaImprimir.cliente,
					fechaLabel: formatearFecha(ventaParaImprimir.fecha),
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
		await esperarImagenesListas('#ticket-imprimir');
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
				<p class="text-2xl font-extrabold text-stone-800">{currency(sumaTotal)}</p>
			</div>
			<a href="/dashboard/venta" class="button primary">
				<Plus size={16} strokeWidth={3} />
				Nueva Venta
			</a>
		</div>
	</header>

	<div class="flex items-center gap-3">
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
					<th class="p-3 font-bold">Cajero</th>
					<th class="p-3 font-bold">Productos</th>
					<th class="p-3 font-bold">Pago</th>
					<th class="p-3 text-right font-bold">Total</th>
					<th class="p-3"><span class="sr-only">Acciones</span></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-stone-100">
				{#if ventas.length === 0}
					<tr>
						<td colspan="8" class="py-8 text-center text-sm text-stone-400">
							{cargando ? 'Cargando…' : 'No se encontraron ventas'}
						</td>
					</tr>
				{/if}
				{#each ventas as venta (venta.id)}
					{@const anulada = ventasAnuladas.has(venta.id)}
					<tr class={anulada ? 'opacity-50' : ''}>
						<td class="p-3 font-medium text-stone-800">{formatearFecha(venta.fecha)}</td>
						<td class="p-3 text-stone-500">{venta.hora}</td>
						<td class="p-3 font-medium text-stone-800">{venta.cliente ?? '—'}</td>
						<td class="p-3 text-stone-500">
							<span class="flex items-center gap-1.5">
								<User size={13} class="text-stone-400" />
								{venta.cajero}
							</span>
						</td>
						<td class="p-3 font-medium text-stone-800">{venta.descripcion}</td>
						<td class="p-3">
							<div class="flex flex-wrap items-center gap-1">
								{#each venta.pagos as pago (pago.metodo)}
									<span
										class="rounded-full px-2.5 py-0.5 text-xs font-bold {colorPago(pago.metodo)}"
									>
										{pago.metodo}{#if venta.pagos.length > 1}
											· {currency(pago.monto)}{/if}
									</span>
								{:else}
									<span
										class="rounded-full px-2.5 py-0.5 text-xs font-bold {colorPago(venta.pago)}"
									>
										{venta.pago}
									</span>
								{/each}
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
									onclick={() => pedirAnular(venta)}
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

		<div class="mt-auto flex items-center justify-between border-t border-stone-100 p-4">
			<p class="text-sm text-stone-400">
				{#if total === 0}
					0 ventas
				{:else}
					Mostrando {(pagina - 1) * pageSize + 1}–{Math.min(pagina * pageSize, total)} de {total}
				{/if}
			</p>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => irAPagina(pagina - 1)}
					disabled={pagina <= 1}
					class="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40"
					aria-label="Página anterior"
				>
					<ChevronLeft size={16} />
				</button>
				<span class="px-2 text-sm font-bold text-stone-700">Página {pagina} de {totalPaginas}</span>
				<button
					type="button"
					onclick={() => irAPagina(pagina + 1)}
					disabled={pagina >= totalPaginas}
					class="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40"
					aria-label="Página siguiente"
				>
					<ChevronRight size={16} />
				</button>
			</div>
		</div>
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
					<p class="text-xs font-bold text-stone-400 uppercase">Cajero</p>
					<p class="font-bold text-stone-800">{ventaSeleccionada.cajero}</p>
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
				<div class="col-span-2">
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

<TicketImpresion venta={ticketParaImprimir} />

<ConfirmDialog
	bind:open={confirmAnularOpen}
	title="Anular venta"
	message={`¿Anular la venta de ${currency(ventaAAnular?.total ?? 0)}${ventaAAnular?.cliente ? ` a ${ventaAAnular.cliente}` : ''}?`}
	confirmLabel="Anular"
	onConfirm={confirmarAnular}
/>
