<script lang="ts">
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import { currency, formatFecha, formatHora } from '$lib/utils';
	import { ExternalLink, User, Banknote, Smartphone, CreditCard, Clock } from '@lucide/svelte';
	import CashCountInput from './ui/CashCountInput.svelte';
	import Dialog from './ui/Dialog.svelte';
	import toast from 'svelte-french-toast';
	import Button from './ui/Button.svelte';
	import MoneyInput from './ui/MoneyInput.svelte';
	import Select from './ui/Select.svelte';
	import type { MetodoCaja, SesionCajaDTO } from '$lib/server/caja';

	interface Props {
		variant?: 'vertical' | 'horizontal';
	}
	let { variant = 'vertical' }: Props = $props();
	const horizontal = $derived(variant === 'horizontal');

	const sesion = $derived(page.data.sesionActual as SesionCajaDTO | null);

	// Yape y Tarjeta nunca arrancan con un monto en caja (no hay "fondo de cambio" digital),
	// así que el formulario de apertura solo pide el efectivo inicial.
	let efectivoInicial = $state('');
	let abriendo = $state(false);
	let cerrando = $state(false);

	// El conteo muestra lo que debería haber por defecto; una vez el cajero lo
	// edita, deja de seguir los movimientos automáticos y queda como su conteo real.
	let conteoEfectivo = $state('');
	let conteoEfectivoTocado = $state(false);
	let conteoYape = $state('');
	let conteoYapeTocado = $state(false);
	let conteoTarjeta = $state('');
	let conteoTarjetaTocado = $state(false);

	$effect(() => {
		if (!conteoEfectivoTocado) conteoEfectivo = (sesion?.esperados.Efectivo ?? 0).toFixed(2);
	});
	$effect(() => {
		if (!conteoYapeTocado) conteoYape = (sesion?.esperados.Yape ?? 0).toFixed(2);
	});
	$effect(() => {
		if (!conteoTarjetaTocado) conteoTarjeta = (sesion?.esperados.Tarjeta ?? 0).toFixed(2);
	});

	async function handleAbrirCaja(event: SubmitEvent) {
		event.preventDefault();
		if (!efectivoInicial) {
			toast.error('Ingresa el monto inicial en efectivo');
			return;
		}
		abriendo = true;
		try {
			const res = await fetch('/api/caja/sesion', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ efectivo: Number(efectivoInicial) || 0, yape: 0, tarjeta: 0 })
			});
			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo abrir la caja');
				return;
			}
			await invalidate('caja:sesion');
			efectivoInicial = '';
			conteoEfectivoTocado = false;
			conteoYapeTocado = false;
			conteoTarjetaTocado = false;
			toast.success('Caja abierta');
		} finally {
			abriendo = false;
		}
	}

	async function handleCerrarCaja() {
		cerrando = true;
		try {
			const res = await fetch('/api/caja/sesion/cerrar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					efectivo: Number(conteoEfectivo) || 0,
					yape: Number(conteoYape) || 0,
					tarjeta: Number(conteoTarjeta) || 0
				})
			});
			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo cerrar la caja');
				return;
			}
			await invalidate('caja:sesion');
			conteoEfectivoTocado = false;
			conteoYapeTocado = false;
			conteoTarjetaTocado = false;
			toast.success('Caja cerrada');
		} finally {
			cerrando = false;
		}
	}

	function openMovDialog(tipo: 'ingreso' | 'egreso') {
		movTipo = tipo;
		movMetodo = 'Efectivo';
		movMonto = '';
		movDialogOpen = true;
	}

	const diffEfectivo = $derived(
		Math.round(((Number(conteoEfectivo) || 0) - (sesion?.esperados.Efectivo ?? 0)) * 100) / 100
	);
	const diffYape = $derived(
		Math.round(((Number(conteoYape) || 0) - (sesion?.esperados.Yape ?? 0)) * 100) / 100
	);
	const diffTarjeta = $derived(
		Math.round(((Number(conteoTarjeta) || 0) - (sesion?.esperados.Tarjeta ?? 0)) * 100) / 100
	);

	let movDialogOpen = $state(false);
	let movTipo: 'ingreso' | 'egreso' = $state('ingreso');
	let movMetodo: MetodoCaja = $state('Efectivo');
	let movMonto = $state('');
	let guardandoMovimiento = $state(false);

	async function handleMovimiento(event: SubmitEvent) {
		event.preventDefault();
		const monto = Number(movMonto);
		if (!monto || monto <= 0) {
			toast.error('Ingresa un monto válido');
			return;
		}
		guardandoMovimiento = true;
		try {
			const res = await fetch('/api/caja/movimientos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tipo: movTipo,
					metodo: movMetodo,
					monto,
					descripcion: movTipo === 'ingreso' ? 'Ingreso extra' : 'Egreso extra'
				})
			});
			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo registrar el movimiento');
				return;
			}
			await invalidate('caja:sesion');
			toast.success(movTipo === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado');
			movDialogOpen = false;
		} finally {
			guardandoMovimiento = false;
		}
	}
</script>

<aside
	aria-labelledby="caja-heading"
	class={horizontal
		? 'flex w-full flex-col gap-5 rounded-2xl bg-stone-800 p-6 text-stone-50'
		: 'flex w-full flex-col gap-6 rounded-2xl bg-stone-800 p-6 text-stone-50 @min-[900px]:w-90 @min-[900px]:shrink-0'}
>
	{#if horizontal}
		<h2 id="caja-heading" class="text-lg font-extrabold tracking-tight">Caja actual</h2>
	{:else}
		<div class="flex items-center justify-between">
			<h2 id="caja-heading" class="text-xl font-extrabold tracking-tight">Resumen de Caja</h2>
			<a href="/dashboard/caja" class="text-stone-500 hover:text-stone-50">
				<ExternalLink size={20} strokeWidth={2.5} />
			</a>
		</div>
	{/if}
	{#if sesion}
		<div
			class={horizontal
				? 'flex flex-wrap items-center gap-x-8 gap-y-2 text-stone-400'
				: 'grid grid-cols-2 gap-x-4 gap-y-3 text-sm font-bold text-stone-400'}
		>
			<p class="flex items-center gap-2">
				<User size={16} />
				{sesion.cajeroNombre}
			</p>
			<p class="flex items-center gap-2">
				<Banknote size={16} />
				{currency(sesion.montosIniciales.Efectivo)}
			</p>
			<p class="flex items-center gap-2">
				<Clock size={16} />
				<span>{formatFecha(sesion.aperturaEn)}</span>
			</p>
			<p class="flex items-center gap-2">
				<Clock size={16} />
				<span>{formatHora(sesion.aperturaEn)}</span>
			</p>
		</div>

		<div class={horizontal ? 'flex flex-wrap items-end gap-4' : 'flex flex-col gap-3'}>
			<div class={horizontal ? 'min-w-48 flex-1' : ''}>
				<p
					class="flex items-center gap-1.5 text-sm font-bold {horizontal
						? 'text-stone-500'
						: 'text-stone-400'}"
				>
					<Banknote size={16} />
					Monto - Efectivo
				</p>
				<div class="mt-1">
					<CashCountInput
						id="conteo_efectivo"
						bind:value={conteoEfectivo}
						diff={diffEfectivo}
						oninput={() => (conteoEfectivoTocado = true)}
					/>
				</div>
			</div>
			<div class={horizontal ? 'min-w-48 flex-1' : ''}>
				<p
					class="flex items-center gap-1.5 text-sm font-bold {horizontal
						? 'text-stone-500'
						: 'text-stone-400'}"
				>
					<Smartphone size={16} />
					Monto - Yape
				</p>
				<div class="mt-1">
					<CashCountInput
						id="conteo_yape"
						bind:value={conteoYape}
						diff={diffYape}
						oninput={() => (conteoYapeTocado = true)}
					/>
				</div>
			</div>
			<div class={horizontal ? 'min-w-48 flex-1' : ''}>
				<p
					class="flex items-center gap-1.5 text-sm font-bold {horizontal
						? 'text-stone-500'
						: 'text-stone-400'}"
				>
					<CreditCard size={16} />
					Monto - Tarjeta
				</p>
				<div class="mt-1">
					<CashCountInput
						id="conteo_tarjeta"
						bind:value={conteoTarjeta}
						diff={diffTarjeta}
						oninput={() => (conteoTarjetaTocado = true)}
					/>
				</div>
			</div>
			{#if horizontal}
				<div class="flex shrink-0 gap-3">
					<Button variant="success" onclick={() => openMovDialog('ingreso')}>Ingreso</Button>
					<Button variant="danger" onclick={() => openMovDialog('egreso')}>Egreso</Button>
					<Button onclick={handleCerrarCaja} disabled={cerrando}>
						{cerrando ? 'Cerrando…' : 'Cerrar'}
					</Button>
				</div>
			{/if}
		</div>

		{#if !horizontal}
			<div class="grid gap-3">
				<div class="grid grid-cols-2 gap-3">
					<Button variant="success" onclick={() => openMovDialog('ingreso')}>Ingreso</Button>
					<Button variant="danger" onclick={() => openMovDialog('egreso')}>Egreso</Button>
				</div>

				<Button onclick={handleCerrarCaja} disabled={cerrando}>
					{cerrando ? 'Cerrando…' : 'Cerrar Caja'}
				</Button>
			</div>
		{/if}
	{:else}
		<form
			onsubmit={handleAbrirCaja}
			class={horizontal ? 'flex flex-wrap items-end gap-4' : 'flex flex-col gap-4'}
		>
			<div class={horizontal ? 'flex min-w-56 flex-col gap-1.5' : 'flex flex-col gap-1.5'}>
				<label for="monto_efectivo" class="flex items-center gap-1.5 text-sm font-bold">
					<Banknote size={15} class="text-stone-400" />
					Monto inicial - Efectivo
				</label>
				<MoneyInput id="monto_efectivo" bind:value={efectivoInicial} />
			</div>
			<Button
				type="submit"
				variant="success"
				class={horizontal ? 'w-auto shrink-0' : ''}
				disabled={abriendo}
			>
				{abriendo ? 'Abriendo…' : 'Abrir Caja'}
			</Button>
		</form>
	{/if}
</aside>

<Dialog bind:open={movDialogOpen} title={movTipo === 'ingreso' ? 'Ingreso Extra' : 'Egreso Extra'}>
	<form class="flex flex-col gap-4" onsubmit={handleMovimiento}>
		<div class="flex gap-3">
			<Select bind:value={movMetodo} class="flex-1">
				<option value="Efectivo">Efectivo</option>
				<option value="Yape">Yape</option>
				<option value="Tarjeta">Tarjeta</option>
			</Select>
			<MoneyInput bind:value={movMonto} class="flex-1" />
		</div>
		<Button
			type="submit"
			variant={movTipo === 'ingreso' ? 'success' : 'danger'}
			disabled={guardandoMovimiento}
		>
			{movTipo === 'ingreso' ? 'Añadir Ingreso' : 'Añadir Egreso'}
		</Button>
	</form>
</Dialog>
