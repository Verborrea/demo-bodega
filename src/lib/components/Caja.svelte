<script lang="ts">
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import { currency, formatFechaHora } from '$lib/utils';
	import { ExternalLink, User } from '@lucide/svelte';
	import CashCountInput from './ui/CashCountInput.svelte';
	import Dialog from './ui/Dialog.svelte';
	import toast from 'svelte-french-toast';
	import Button from './ui/Button.svelte';
	import MoneyInput from './ui/MoneyInput.svelte';
	import Select from './ui/Select.svelte';
	import type { MetodoCaja, SesionCajaDTO } from '$lib/server/caja';

	const sesion = $derived(page.data.sesionActual as SesionCajaDTO | null);

	let efectivoInicial = $state('');
	let yapeInicial = $state('');
	let tarjetaInicial = $state('');
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
		if (!efectivoInicial && !yapeInicial && !tarjetaInicial) {
			toast.error('Ingresa al menos un monto inicial');
			return;
		}
		abriendo = true;
		try {
			const res = await fetch('/api/caja/sesion', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					efectivo: Number(efectivoInicial) || 0,
					yape: Number(yapeInicial) || 0,
					tarjeta: Number(tarjetaInicial) || 0
				})
			});
			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo abrir la caja');
				return;
			}
			await invalidate('caja:sesion');
			efectivoInicial = '';
			yapeInicial = '';
			tarjetaInicial = '';
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
	class="relative flex w-90 shrink-0 flex-col gap-6 rounded-2xl bg-stone-800 p-6 text-stone-50"
>
	<h2 id="caja-heading" class="text-center text-xl font-extrabold tracking-tight">
		Resumen de Caja
	</h2>
	{#if sesion}
		<div class="grid grid-cols-3 gap-4">
			<div>
				<p class="text-xs font-bold text-stone-400 uppercase">Efectivo Inicial</p>
				<p class="mt-1 font-bold">{currency(sesion.montosIniciales.Efectivo)}</p>
			</div>
			<div>
				<p class="text-xs font-bold text-stone-400 uppercase">Yape Inicial</p>
				<p class="mt-1 font-bold">{currency(sesion.montosIniciales.Yape)}</p>
			</div>
			<div>
				<p class="text-xs font-bold text-stone-400 uppercase">Tarjeta Inicial</p>
				<p class="mt-1 font-bold">{currency(sesion.montosIniciales.Tarjeta)}</p>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<p class="text-xs font-bold text-stone-400 uppercase">Apertura</p>
				<p class="mt-1 font-bold">{formatFechaHora(sesion.aperturaEn)}</p>
			</div>
			<div>
				<p class="text-xs font-bold text-stone-400 uppercase">Cajero</p>
				<p class="mt-1 flex items-center gap-1.5 font-bold">
					<User size={14} />
					{sesion.cajeroNombre}
				</p>
			</div>
		</div>

		<div class="flex flex-col gap-3">
			<div>
				<p class="text-xs font-bold text-stone-400 uppercase">Monto en efectivo</p>
				<div class="mt-1">
					<CashCountInput
						id="conteo_efectivo"
						bind:value={conteoEfectivo}
						diff={diffEfectivo}
						oninput={() => (conteoEfectivoTocado = true)}
					/>
				</div>
			</div>
			<div>
				<p class="text-xs font-bold text-stone-400 uppercase">Monto en Yape</p>
				<div class="mt-1">
					<CashCountInput
						id="conteo_yape"
						bind:value={conteoYape}
						diff={diffYape}
						oninput={() => (conteoYapeTocado = true)}
					/>
				</div>
			</div>
			<div>
				<p class="text-xs font-bold text-stone-400 uppercase">Monto en Tarjeta</p>
				<div class="mt-1">
					<CashCountInput
						id="conteo_tarjeta"
						bind:value={conteoTarjeta}
						diff={diffTarjeta}
						oninput={() => (conteoTarjetaTocado = true)}
					/>
				</div>
			</div>
		</div>

		<div class="grid gap-3">
			<div class="grid grid-cols-2 gap-3">
				<Button variant="success" onclick={() => openMovDialog('ingreso')}>Ingreso</Button>
				<Button variant="danger" onclick={() => openMovDialog('egreso')}>Egreso</Button>
			</div>

			<Button class="uppercase" onclick={handleCerrarCaja} disabled={cerrando}>
				{cerrando ? 'Cerrando…' : 'Cerrar Caja'}
			</Button>
		</div>
	{:else}
		<form onsubmit={handleAbrirCaja} class="flex flex-col gap-4">
			<div class="flex flex-col gap-1.5">
				<label for="monto_efectivo" class="text-sm font-bold">Monto inicial - Efectivo</label>
				<MoneyInput
					id="monto_efectivo"
					bind:value={efectivoInicial}
					onkeydown={(e) => {
						if (e.key !== 'Enter') return;
						e.preventDefault();
						document.getElementById('monto_yape')?.focus();
					}}
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<label for="monto_yape" class="text-sm font-bold">Monto inicial - Yape</label>
				<MoneyInput
					id="monto_yape"
					bind:value={yapeInicial}
					onkeydown={(e) => {
						if (e.key !== 'Enter') return;
						e.preventDefault();
						document.getElementById('monto_tarjeta')?.focus();
					}}
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<label for="monto_tarjeta" class="text-sm font-bold">Monto inicial - Tarjeta</label>
				<MoneyInput id="monto_tarjeta" bind:value={tarjetaInicial} />
			</div>
			<Button type="submit" variant="success" class="uppercase" disabled={abriendo}>
				{abriendo ? 'Abriendo…' : 'Abrir Caja'}
			</Button>
		</form>
	{/if}
	<a href="/dashboard/caja" class="absolute top-7 right-6 text-stone-500">
		<ExternalLink size={20} strokeWidth={2.5} />
	</a>
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
