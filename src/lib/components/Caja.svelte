<script lang="ts">
	import { caja, type MetodoCaja } from '$lib/stores/caja.svelte';
	import { currency } from '$lib/utils';
	import { ExternalLink } from '@lucide/svelte';
	import CashCountInput from './ui/CashCountInput.svelte';
	import Dialog from './ui/Dialog.svelte';
	import toast from 'svelte-french-toast';
	import Button from './ui/Button.svelte';
	import MoneyInput from './ui/MoneyInput.svelte';
	import Select from './ui/Select.svelte';

	const esperadoEfectivo = $derived(caja.montoEsperado('Efectivo'));
	const esperadoYape = $derived(caja.montoEsperado('Yape'));

	let efectivoInicial = $state('');
	let yapeInicial = $state('');

	// El conteo muestra lo que debería haber por defecto; una vez el cajero lo
	// edita, deja de seguir los movimientos automáticos y queda como su conteo real.
	let conteoEfectivo = $state('');
	let conteoEfectivoTocado = $state(false);
	let conteoYape = $state('');
	let conteoYapeTocado = $state(false);

	$effect(() => {
		if (!conteoEfectivoTocado) conteoEfectivo = esperadoEfectivo.toFixed(2);
	});
	$effect(() => {
		if (!conteoYapeTocado) conteoYape = esperadoYape.toFixed(2);
	});

	function handleAbrirCaja(event: SubmitEvent) {
		event.preventDefault();
		if (!efectivoInicial && !yapeInicial) {
			toast.error('Ingresa al menos un monto inicial');
			return;
		}
		caja.abrir(Number(efectivoInicial) || 0, Number(yapeInicial) || 0);
		efectivoInicial = '';
		yapeInicial = '';
		conteoEfectivoTocado = false;
		conteoYapeTocado = false;
		toast.success('Caja abierta');
	}

	function handleCerrarCaja() {
		caja.cerrar({
			Efectivo: Number(conteoEfectivo) || 0,
			Yape: Number(conteoYape) || 0
		});
		conteoEfectivoTocado = false;
		conteoYapeTocado = false;
		toast.success('Caja cerrada');
	}

	function openMovDialog(tipo: 'ingreso' | 'egreso') {
		movTipo = tipo;
		movMetodo = 'Efectivo';
		movMonto = '';
		movDialogOpen = true;
	}

	const diffEfectivo = $derived(
		Math.round(((Number(conteoEfectivo) || 0) - esperadoEfectivo) * 100) / 100
	);
	const diffYape = $derived(Math.round(((Number(conteoYape) || 0) - esperadoYape) * 100) / 100);

	let movDialogOpen = $state(false);
	let movTipo: 'ingreso' | 'egreso' = $state('ingreso');
	let movMetodo: MetodoCaja = $state('Efectivo');
	let movMonto = $state('');

	function handleMovimiento(event: SubmitEvent) {
		event.preventDefault();
		const monto = Number(movMonto);
		if (!monto || monto <= 0) {
			toast.error('Ingresa un monto válido');
			return;
		}
		const descripcion = movTipo === 'ingreso' ? 'Ingreso extra' : 'Egreso extra';
		if (movTipo === 'ingreso') {
			caja.registrarIngreso(movMetodo, monto, descripcion);
		} else {
			caja.registrarEgreso(movMetodo, monto, descripcion);
		}
		toast.success(movTipo === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado');
		movDialogOpen = false;
	}
</script>

<aside
	aria-labelledby="caja-heading"
	class="relative flex w-90 shrink-0 flex-col gap-6 rounded-2xl bg-stone-800 p-6 text-stone-50"
>
	<h2 id="caja-heading" class="text-center text-xl font-extrabold tracking-tight">
		Resumen de Caja
	</h2>
	{#if caja.abierta}
		<div class="grid grid-cols-2 gap-4">
			<div>
				<p class="text-xs font-bold text-stone-400 uppercase">Efectivo Inicial</p>
				<p class="mt-1 font-bold">{currency(caja.montosIniciales.Efectivo)}</p>
			</div>
			<div>
				<p class="text-xs font-bold text-stone-400 uppercase">Yape Inicial</p>
				<p class="mt-1 font-bold">{currency(caja.montosIniciales.Yape)}</p>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<p class="text-xs font-bold text-stone-400 uppercase">Fecha de apertura</p>
				<p class="mt-1 font-bold">{caja.fechaApertura}</p>
			</div>
			<div>
				<p class="text-xs font-bold text-stone-400 uppercase">Hora de Apertura</p>
				<p class="mt-1 font-bold">{caja.horaApertura}</p>
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
		</div>

		<div class="grid gap-3">
			<div class="grid grid-cols-2 gap-3">
				<Button variant="success" onclick={() => openMovDialog('ingreso')}>Ingreso</Button>
				<Button variant="danger" onclick={() => openMovDialog('egreso')}>Egreso</Button>
			</div>

			<Button class="uppercase" onclick={handleCerrarCaja}>Cerrar Caja</Button>
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

						const target = e.target as HTMLInputElement;

						if (target.id === 'monto_efectivo') {
							e.preventDefault();

							document.getElementById('monto_yape')?.focus();
						}
					}}
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<label for="monto_yape" class="text-sm font-bold">Monto inicial - Yape</label>
				<MoneyInput id="monto_yape" bind:value={yapeInicial} />
			</div>
			<Button type="submit" variant="success" class="uppercase">Abrir Caja</Button>
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
			</Select>
			<MoneyInput bind:value={movMonto} class="flex-1" />
		</div>
		<Button type="submit" variant={movTipo === 'ingreso' ? 'success' : 'danger'}>
			{movTipo === 'ingreso' ? 'Añadir Ingreso' : 'Añadir Egreso'}
		</Button>
	</form>
</Dialog>
