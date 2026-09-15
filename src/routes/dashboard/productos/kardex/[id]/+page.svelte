<script lang="ts">
	import toast from 'svelte-french-toast';
	import { parseDate } from '@internationalized/date';
	import { ArrowDownLeft, ArrowUpRight, Package } from '@lucide/svelte';
	import { Breadcrumbs, DateRangePicker, DataTable, type ColumnaTabla } from '$lib/components/ui';
	import type { DateRangeValue } from '$lib/components/ui/DateRangePicker.svelte';
	import { formatFechaHora } from '$lib/utils';
	import type { PageData } from './$types';
	import type { Kardex, MovimientoDTO, TipoMovimiento } from '$lib/server/movimientos';

	let { data }: { data: PageData } = $props();

	const producto = data.producto;

	let kardex = $state<Kardex>(data.kardex);
	let cargando = $state(false);

	let rangoFecha = $state<DateRangeValue>({
		start: parseDate(data.desde),
		end: parseDate(data.hasta)
	});

	const desde = $derived(rangoFecha.start?.toString() ?? data.desde);
	const hasta = $derived(rangoFecha.end?.toString() ?? data.hasta);

	// Igual que en Inventario: descarta la respuesta de un rango que el usuario ya cambió.
	let cargaId = 0;
	async function cargarKardex() {
		const miCarga = ++cargaId;
		cargando = true;
		try {
			const params = new URLSearchParams({ desde, hasta });
			const res = await fetch(`/api/movimientos/${producto.id}?${params}`);
			if (!res.ok) throw new Error('request failed');
			const resultado = (await res.json()) as Kardex;
			if (miCarga !== cargaId) return;
			kardex = resultado;
			pagina = 1;
		} catch {
			if (miCarga === cargaId) toast.error('No se pudo cargar el kardex');
		} finally {
			if (miCarga === cargaId) cargando = false;
		}
	}

	// El primer render ya trae el mes en curso desde el load; solo se vuelve a pedir cuando
	// el rango cambia de verdad.
	let rangoCargado = `${data.desde}|${data.hasta}`;
	$effect(() => {
		const actual = `${desde}|${hasta}`;
		if (actual === rangoCargado) return;
		rangoCargado = actual;
		cargarKardex();
	});

	const PAGE_SIZE = 20;
	let pagina = $state(1);
	const total = $derived(kardex.movimientos.length);
	const totalPaginas = $derived(Math.max(1, Math.ceil(total / PAGE_SIZE)));
	const movimientosPagina = $derived(
		kardex.movimientos.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)
	);

	function irAPagina(n: number) {
		if (n < 1 || n > totalPaginas || n === pagina) return;
		pagina = n;
	}

	const ETIQUETA_TIPO: Record<TipoMovimiento, string> = {
		inicial: 'Saldo inicial',
		venta: 'Venta',
		anulacion: 'Anulación',
		ingreso: 'Ingreso',
		ajuste: 'Ajuste',
		edicion: 'Edición'
	};

	const CLASE_TIPO: Record<TipoMovimiento, string> = {
		inicial: 'bg-primary/30 text-stone-700',
		venta: 'bg-red-100 text-red-700',
		anulacion: 'bg-badge-green-bg text-badge-green-fg',
		ingreso: 'bg-badge-green-bg text-badge-green-fg',
		ajuste: 'bg-stone-200 text-stone-600',
		edicion: 'bg-stone-200 text-stone-600'
	};

	// Las unidades sueltas son la moneda común del saldo: una Caja de 6 entra como 6.
	function unidades(n: number) {
		return `${n} ${Math.abs(n) === 1 ? 'unidad' : 'unidades'}`;
	}
</script>

<svelte:head>
	<title>Kardex · La Central</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<Breadcrumbs
		items={[
			{ label: 'Dashboard', href: '/dashboard' },
			{ label: 'Inventario', href: '/dashboard/productos' },
			{ label: 'Kardex' }
		]}
	/>

	<header
		class="flex flex-col gap-4 @min-[768px]:flex-row @min-[768px]:items-start @min-[768px]:justify-between"
	>
		<div class="flex min-w-0 items-center gap-3">
			<span
				class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-600"
			>
				<Package size={20} strokeWidth={2.5} />
			</span>
			<div class="min-w-0">
				<h1 class="title truncate">{producto.nombre}</h1>
				<p class="mt-1 truncate text-sm text-stone-400">
					{producto.marca ?? 'Sin marca'} · {producto.categoria ?? 'Sin categoría'} · {unidades(
						producto.cantidad
					)} en stock
				</p>
			</div>
		</div>
		<DateRangePicker bind:value={rangoFecha} class="@min-[768px]:shrink-0" />
	</header>

	<div class="grid grid-cols-2 gap-3 @min-[1024px]:grid-cols-4">
		<div class="rounded-2xl border-2 border-stone-200 bg-white p-4">
			<p class="text-xs leading-3.75 text-stone-400">Saldo inicial</p>
			<p class="mt-1 text-xl font-extrabold text-stone-800">{kardex.saldoInicial}</p>
		</div>
		<div class="rounded-2xl border-2 border-stone-200 bg-white p-4">
			<p class="text-xs leading-3.75 text-stone-400">Entradas</p>
			<p class="mt-1 text-xl font-extrabold text-success-dark">+{kardex.entradas}</p>
		</div>
		<div class="rounded-2xl border-2 border-stone-200 bg-white p-4">
			<p class="text-xs leading-3.75 text-stone-400">Salidas</p>
			<p class="mt-1 text-xl font-extrabold text-error">−{kardex.salidas}</p>
		</div>
		<div class="rounded-2xl border-2 border-primary bg-white p-4">
			<p class="text-xs leading-3.75 text-stone-400">Saldo final</p>
			<p class="mt-1 text-xl font-extrabold text-stone-800">{kardex.saldoFinal}</p>
		</div>
	</div>

	{#snippet celdaFecha(m: MovimientoDTO)}
		<span class="whitespace-nowrap text-stone-500">{formatFechaHora(m.fecha)}</span>
	{/snippet}
	{#snippet celdaTipo(m: MovimientoDTO)}
		<span
			class="rounded-full px-2.5 py-0.5 text-xs leading-3.75 font-bold whitespace-nowrap {CLASE_TIPO[
				m.tipo
			]}"
		>
			{ETIQUETA_TIPO[m.tipo]}
		</span>
	{/snippet}
	{#snippet celdaDetalle(m: MovimientoDTO)}
		<span class="text-stone-500">
			{m.detalle ?? '—'}
			{#if m.usuarioNombre}
				<span class="text-xs leading-3.75 text-stone-400">· {m.usuarioNombre}</span>
			{/if}
		</span>
	{/snippet}
	{#snippet celdaPresentacion(m: MovimientoDTO)}
		<span class="whitespace-nowrap text-stone-500">
			{Math.abs(m.cantidad)} × {m.nombrePresentacion}
		</span>
	{/snippet}
	{#snippet celdaEntrada(m: MovimientoDTO)}
		{#if m.unidadesBase > 0}
			<span class="font-bold text-success-dark">+{m.unidadesBase}</span>
		{:else}
			<span class="text-stone-300">—</span>
		{/if}
	{/snippet}
	{#snippet celdaSalida(m: MovimientoDTO)}
		{#if m.unidadesBase < 0}
			<span class="font-bold text-error">−{Math.abs(m.unidadesBase)}</span>
		{:else}
			<span class="text-stone-300">—</span>
		{/if}
	{/snippet}
	{#snippet celdaSaldo(m: MovimientoDTO)}
		<span class="font-bold text-stone-800 tabular-nums">{m.saldo}</span>
	{/snippet}

	{#snippet tarjetaMovimiento(m: MovimientoDTO)}
		<div class="flex flex-col gap-3 rounded-2xl border-2 border-stone-200 bg-white p-4">
			<div class="flex items-start justify-between gap-2">
				<div class="min-w-0">
					<p class="truncate font-extrabold text-stone-800">
						{Math.abs(m.cantidad)} × {m.nombrePresentacion}
					</p>
					<p class="text-xs leading-3.75 text-stone-400">{formatFechaHora(m.fecha)}</p>
				</div>
				{@render celdaTipo(m)}
			</div>
			<div class="grid grid-cols-2 gap-3 text-sm">
				<div>
					<p class="text-xs leading-3.75 text-stone-400">Movimiento</p>
					<p class="font-bold {m.unidadesBase > 0 ? 'text-success-dark' : 'text-error'}">
						{m.unidadesBase > 0 ? '+' : '−'}{Math.abs(m.unidadesBase)}
					</p>
				</div>
				<div>
					<p class="text-xs leading-3.75 text-stone-400">Saldo</p>
					<p class="font-bold text-stone-800">{m.saldo}</p>
				</div>
			</div>
			{#if m.detalle || m.usuarioNombre}
				<p class="truncate border-t border-stone-100 pt-3 text-xs leading-4 text-stone-400">
					{m.detalle ?? ''}{m.detalle && m.usuarioNombre ? ' · ' : ''}{m.usuarioNombre ?? ''}
				</p>
			{/if}
		</div>
	{/snippet}

	<DataTable
		columnas={[
			{ id: 'fecha', etiqueta: 'Fecha', celda: celdaFecha },
			{ id: 'tipo', etiqueta: 'Movimiento', celda: celdaTipo },
			{ id: 'detalle', etiqueta: 'Detalle', celda: celdaDetalle },
			{ id: 'presentacion', etiqueta: 'Presentación', celda: celdaPresentacion },
			{ id: 'entrada', etiqueta: 'Entrada', alinear: 'derecha', celda: celdaEntrada },
			{ id: 'salida', etiqueta: 'Salida', alinear: 'derecha', celda: celdaSalida },
			{ id: 'saldo', etiqueta: 'Saldo', alinear: 'derecha', celda: celdaSaldo }
		] as ColumnaTabla<MovimientoDTO>[]}
		filas={movimientosPagina}
		claveFila={(m) => m.id}
		{cargando}
		mensajeVacio="Sin movimientos en este rango"
		tarjetaMovil={tarjetaMovimiento}
		{pagina}
		{totalPaginas}
		{total}
		pageSize={PAGE_SIZE}
		onCambiarPagina={irAPagina}
	/>

	<p class="flex items-start gap-2 text-xs leading-4 text-stone-400">
		<ArrowUpRight size={14} class="mt-0.5 shrink-0 text-success-dark" />
		<span>
			Entradas: ingresos de mercadería y devoluciones por anular una venta.
			<ArrowDownLeft size={14} class="mb-0.5 inline text-error" /> Salidas: ventas, sueltas o dentro de
			una promo. Los ajustes manuales de stock y las ediciones del producto también quedan acá. El saldo
			va en unidades sueltas y solo incluye movimientos registrados desde que esta pantalla existe: lo
			anterior a eso no quedó guardado.
		</span>
	</p>
</main>
