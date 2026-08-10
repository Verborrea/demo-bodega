<script lang="ts">
	import { Banknote, Smartphone, Clock } from '@lucide/svelte';
	import { Breadcrumbs } from '$lib/components/ui';
	import { caja, type SesionCaja, type MetodoCaja } from '$lib/stores/caja.svelte';
	import { currency } from '$lib/utils';

	function diferencia(sesion: SesionCaja, metodo: MetodoCaja) {
		return Math.round((sesion.montosFinales[metodo] - sesion.esperados[metodo]) * 100) / 100;
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
		caja.historial.reduce(
			(acc, sesion) => acc + diferencia(sesion, 'Efectivo') + diferencia(sesion, 'Yape'),
			0
		)
	);
</script>

<svelte:head>
	<title>Caja · La tiendita</title>
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

	<div class="flex flex-col gap-4">
		{#if caja.abierta}
			<article class="flex flex-col gap-4 rounded-2xl border-2 border-yellow-400 bg-white p-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<Clock size={18} class="text-stone-400" />
						<p class="font-bold text-stone-800">
							{caja.fechaApertura} · {caja.horaApertura} – en curso
						</p>
					</div>
					<span
						class="rounded-full bg-yellow-400 px-3 py-1 text-xs font-extrabold text-stone-900 uppercase"
					>
						En curso
					</span>
				</div>

				<div class="grid grid-cols-2 gap-6">
					<div class="flex flex-col gap-2">
						<p class="flex items-center gap-2 text-sm font-bold text-stone-800">
							<Banknote size={16} /> Efectivo
						</p>
						<div class="grid grid-cols-2 gap-2 text-xs text-stone-400">
							<p>
								Inicial<br />
								<span class="text-sm font-bold text-stone-600"
									>{currency(caja.montosIniciales.Efectivo)}</span
								>
							</p>
							<p>
								Esperado ahora<br />
								<span class="text-sm font-bold text-stone-600"
									>{currency(caja.montoEsperado('Efectivo'))}</span
								>
							</p>
						</div>
					</div>
					<div class="flex flex-col gap-2">
						<p class="flex items-center gap-2 text-sm font-bold text-stone-800">
							<Smartphone size={16} /> Yape
						</p>
						<div class="grid grid-cols-2 gap-2 text-xs text-stone-400">
							<p>
								Inicial<br />
								<span class="text-sm font-bold text-stone-600"
									>{currency(caja.montosIniciales.Yape)}</span
								>
							</p>
							<p>
								Esperado ahora<br />
								<span class="text-sm font-bold text-stone-600"
									>{currency(caja.montoEsperado('Yape'))}</span
								>
							</p>
						</div>
					</div>
				</div>
			</article>
		{/if}

		{#if caja.historial.length === 0}
			<p class="rounded-2xl bg-white p-8 text-center text-sm text-stone-400">
				Todavía no hay sesiones de caja cerradas.
			</p>
		{/if}

		{#each caja.historial as sesion (sesion.id)}
			{@const diffEfectivo = diferencia(sesion, 'Efectivo')}
			{@const diffYape = diferencia(sesion, 'Yape')}
			<article class="flex flex-col gap-4 rounded-2xl border-2 border-stone-200 bg-white p-6">
				<div class="flex items-center gap-3">
					<Clock size={18} class="text-stone-400" />
					<p class="font-bold text-stone-800">
						{sesion.fechaApertura} · {sesion.horaApertura} – {sesion.horaCierre}
					</p>
				</div>

				<div class="grid grid-cols-2 gap-6">
					<div class="flex flex-col gap-2">
						<p class="flex items-center gap-2 text-sm font-bold text-stone-800">
							<Banknote size={16} /> Efectivo
						</p>
						<div class="grid grid-cols-3 gap-2 text-xs text-stone-400">
							<p>
								Inicial<br />
								<span class="text-sm font-bold text-stone-600"
									>{currency(sesion.montosIniciales.Efectivo)}</span
								>
							</p>
							<p>
								Esperado<br />
								<span class="text-sm font-bold text-stone-600"
									>{currency(sesion.esperados.Efectivo)}</span
								>
							</p>
							<p>
								Contado<br />
								<span class="text-sm font-bold text-stone-600"
									>{currency(sesion.montosFinales.Efectivo)}</span
								>
							</p>
						</div>
						<span
							class="w-fit rounded-full px-2.5 py-0.5 text-xs font-bold {diffBadgeClass(
								diffEfectivo
							)}"
						>
							{diffLabel(diffEfectivo)}
						</span>
					</div>

					<div class="flex flex-col gap-2">
						<p class="flex items-center gap-2 text-sm font-bold text-stone-800">
							<Smartphone size={16} /> Yape
						</p>
						<div class="grid grid-cols-3 gap-2 text-xs text-stone-400">
							<p>
								Inicial<br />
								<span class="text-sm font-bold text-stone-600"
									>{currency(sesion.montosIniciales.Yape)}</span
								>
							</p>
							<p>
								Esperado<br />
								<span class="text-sm font-bold text-stone-600"
									>{currency(sesion.esperados.Yape)}</span
								>
							</p>
							<p>
								Contado<br />
								<span class="text-sm font-bold text-stone-600"
									>{currency(sesion.montosFinales.Yape)}</span
								>
							</p>
						</div>
						<span
							class="w-fit rounded-full px-2.5 py-0.5 text-xs font-bold {diffBadgeClass(diffYape)}"
						>
							{diffLabel(diffYape)}
						</span>
					</div>
				</div>
			</article>
		{/each}
	</div>
</main>
