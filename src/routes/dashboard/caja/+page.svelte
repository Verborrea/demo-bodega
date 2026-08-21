<script lang="ts">
	import toast from 'svelte-french-toast';
	import { Banknote, Smartphone, CreditCard, Clock, User, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { getLocalTimeZone } from '@internationalized/date';
	import { Breadcrumbs, Select, DateRangePicker } from '$lib/components/ui';
	import type { DateRangeValue } from '$lib/components/ui/DateRangePicker.svelte';
	import type { SesionCajaDTO, MetodoCaja } from '$lib/server/caja';
	import { currency, formatFechaHora } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const pageSize = data.pageSize;

	let historial = $state<SesionCajaDTO[]>(data.historial);
	let total = $state(data.total);
	let pagina = $state(1);
	let cargando = $state(false);

	const totalPaginas = $derived(Math.max(1, Math.ceil(total / pageSize)));

	const METODOS: { metodo: MetodoCaja; label: string; icon: typeof Banknote }[] = [
		{ metodo: 'Efectivo', label: 'Efectivo', icon: Banknote },
		{ metodo: 'Yape', label: 'Yape', icon: Smartphone },
		{ metodo: 'Tarjeta', label: 'Tarjeta', icon: CreditCard }
	];

	let cajeroFiltroId = $state('');
	let rangoFecha = $state<DateRangeValue>({ start: undefined, end: undefined });

	function onCajeroFiltroChange() {
		aplicarFiltros();
	}

	let montado = false;
	$effect(() => {
		// Se dispara cuando cambia el rango de fechas (incluido limpiarlo); se omite en el montaje inicial.
		void rangoFecha.start;
		void rangoFecha.end;
		if (montado) aplicarFiltros();
		montado = true;
	});

	function diferencia(sesion: SesionCajaDTO, metodo: MetodoCaja) {
		return (
			Math.round(((sesion.montosFinales?.[metodo] ?? 0) - sesion.esperados[metodo]) * 100) / 100
		);
	}

	function diffBadgeClass(diff: number) {
		if (diff === 0) return 'bg-stone-100 text-stone-500';
		return diff > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
	}

	function diffLabel(diff: number) {
		if (diff === 0) return 'Cuadrado';
		return `${diff > 0 ? '+' : '-'}${currency(Math.abs(diff))}`;
	}

	const diferenciaAcumulada = $derived(
		historial.reduce(
			(acc, sesion) => acc + METODOS.reduce((suma, m) => suma + diferencia(sesion, m.metodo), 0),
			0
		)
	);

	async function cargarHistorial() {
		cargando = true;
		try {
			const params = new URLSearchParams({ page: String(pagina), pageSize: String(pageSize) });
			if (cajeroFiltroId) params.set('cajeroId', cajeroFiltroId);
			if (rangoFecha.start) {
				params.set('fechaInicio', rangoFecha.start.toDate(getLocalTimeZone()).toISOString());
			}
			if (rangoFecha.end) {
				params.set('fechaFin', rangoFecha.end.toDate(getLocalTimeZone()).toISOString());
			}
			const res = await fetch(`/api/caja/historial?${params}`);
			if (!res.ok) throw new Error('request failed');
			const resultado = (await res.json()) as { sesiones: SesionCajaDTO[]; total: number };
			historial = resultado.sesiones;
			total = resultado.total;
		} catch {
			toast.error('No se pudo cargar el historial de caja');
		} finally {
			cargando = false;
		}
	}

	function aplicarFiltros() {
		pagina = 1;
		cargarHistorial();
	}

	function irAPagina(n: number) {
		if (n < 1 || n > totalPaginas || n === pagina) return;
		pagina = n;
		cargarHistorial();
	}
</script>

<svelte:head>
	<title>Caja · La Central</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Caja' }]} />

	<header class="flex items-center justify-between">
		<div class="flex flex-col gap-1">
			<h1 class="title">Registros de Caja</h1>
			<p class="text-sm text-stone-400">Historial de aperturas y cierres de caja.</p>
		</div>
		<div class="text-right">
			<p class="text-xs font-bold text-stone-400 uppercase">Diferencia acumulada</p>
			<p
				class="text-2xl font-extrabold {diferenciaAcumulada >= 0
					? 'text-emerald-600'
					: 'text-red-600'}"
			>
				{diferenciaAcumulada >= 0 ? '+' : '-'}{currency(Math.abs(diferenciaAcumulada))}
			</p>
		</div>
	</header>

	<div class="flex flex-wrap items-center gap-3">
		<Select bind:value={cajeroFiltroId} onchange={onCajeroFiltroChange} class="w-56">
			<option value="">Todos los cajeros</option>
			{#each data.cajeros as cajero (cajero.id)}
				<option value={cajero.id}>{cajero.nombre}</option>
			{/each}
		</Select>
		<DateRangePicker bind:value={rangoFecha} class="w-64" />
	</div>

	<div class="flex flex-col gap-4">
		{#if data.sesionActual}
			{@const sesion = data.sesionActual}
			<article class="flex flex-col gap-4 rounded-2xl border-2 border-yellow-400 bg-white p-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<Clock size={18} class="text-stone-400" />
						<p class="font-bold text-stone-800">{formatFechaHora(sesion.aperturaEn)} – en curso</p>
					</div>
					<div class="flex items-center gap-3">
						<span class="flex items-center gap-2 text-sm text-stone-500">
							<User size={16} />
							{sesion.cajeroNombre}
						</span>
						<span
							class="rounded-full bg-yellow-400 px-3 py-1 text-xs font-extrabold text-stone-900 uppercase"
						>
							En curso
						</span>
					</div>
				</div>

				<div class="grid grid-cols-3 gap-6">
					{#each METODOS as m (m.metodo)}
						<div class="flex flex-col gap-2">
							<p class="flex items-center gap-2 text-sm font-bold text-stone-800">
								<m.icon size={16} />
								{m.label}
							</p>
							<div class="grid grid-cols-2 gap-2 text-xs text-stone-400">
								<p>
									Inicial<br />
									<span class="text-sm font-bold text-stone-600"
										>{currency(sesion.montosIniciales[m.metodo])}</span
									>
								</p>
								<p>
									Esperado ahora<br />
									<span class="text-sm font-bold text-stone-600"
										>{currency(sesion.esperados[m.metodo])}</span
									>
								</p>
							</div>
						</div>
					{/each}
				</div>
			</article>
		{/if}

		{#if historial.length === 0}
			<p class="rounded-2xl bg-white p-8 text-center text-sm text-stone-400">
				{cargando ? 'Cargando…' : 'No se encontraron sesiones de caja con esos filtros.'}
			</p>
		{/if}

		{#each historial as sesion (sesion.id)}
			<article class="flex flex-col gap-4 rounded-2xl border-2 border-stone-200 bg-white p-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<Clock size={18} class="text-stone-400" />
						<p class="font-bold text-stone-800">
							{formatFechaHora(sesion.aperturaEn)} – {sesion.cierreEn
								? formatFechaHora(sesion.cierreEn)
								: '—'}
						</p>
					</div>
					<div class="flex items-center gap-2 text-sm text-stone-500">
						<User size={16} />
						{sesion.cajeroNombre}
					</div>
				</div>

				<div class="grid grid-cols-3 gap-6">
					{#each METODOS as m (m.metodo)}
						{@const diff = diferencia(sesion, m.metodo)}
						<div class="flex flex-col gap-2">
							<p class="flex items-center gap-2 text-sm font-bold text-stone-800">
								<m.icon size={16} />
								{m.label}
							</p>
							<div class="grid grid-cols-3 gap-2 text-xs text-stone-400">
								<p>
									Inicial<br />
									<span class="text-sm font-bold text-stone-600"
										>{currency(sesion.montosIniciales[m.metodo])}</span
									>
								</p>
								<p>
									Esperado<br />
									<span class="text-sm font-bold text-stone-600"
										>{currency(sesion.esperados[m.metodo])}</span
									>
								</p>
								<p>
									Contado<br />
									<span class="text-sm font-bold text-stone-600"
										>{currency(sesion.montosFinales?.[m.metodo] ?? 0)}</span
									>
								</p>
							</div>
							<span class="w-fit rounded-full px-2.5 py-0.5 text-xs font-bold {diffBadgeClass(diff)}">
								{diffLabel(diff)}
							</span>
						</div>
					{/each}
				</div>
			</article>
		{/each}

		{#if total > 0}
			<div class="flex items-center justify-between rounded-2xl bg-white p-4">
				<p class="text-sm text-stone-400">
					Mostrando {(pagina - 1) * pageSize + 1}–{Math.min(pagina * pageSize, total)} de {total}
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
		{/if}
	</div>
</main>
