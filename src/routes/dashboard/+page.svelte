<script lang="ts">
	import toast from 'svelte-french-toast';
	import { Button, MoneyInput, Select, Dialog, CashCountInput } from '$lib/components/ui';
	import { caja, type MetodoCaja } from '$lib/stores/caja.svelte';
	import Breadcrumbs from '$lib/components/ui/Breadcrumbs.svelte';
	import { currency } from '$lib/utils';
	import { ExternalLink } from '@lucide/svelte';

	const ventasDiaBase = 238.1;
	const resumen = $derived([
		{ label: 'Ventas del día', value: ventasDiaBase + caja.totalVentas, color: 'bg-yellow-400' },
		{ label: 'Ventas de la semana', value: 1572.6 + caja.totalVentas, color: 'bg-violet-300' },
		{ label: 'Ventas del mes', value: 8724.5 + caja.totalVentas, color: 'bg-sky-300' },
		{ label: 'Ventas del año', value: 45890.75 + caja.totalVentas, color: 'bg-emerald-300' }
	]);

	const ultimasVentasMock = [
		{ hora: '08:12 p. m.', descripcion: '3 productos', pago: 'Efectivo', total: 45.0 },
		{ hora: '07:58 p. m.', descripcion: '1 producto', pago: 'Yape', total: 12.5 },
		{ hora: '07:40 p. m.', descripcion: '5 productos', pago: 'Tarjeta', total: 96.3 },
		{ hora: '07:15 p. m.', descripcion: '2 productos', pago: 'Efectivo', total: 28.0 },
		{ hora: '06:52 p. m.', descripcion: '4 productos', pago: 'Yape', total: 56.3 }
	];

	const ventasLive = $derived(
		caja.ventas.map((v) => ({
			hora: v.hora,
			descripcion: v.descripcion,
			pago: v.metodo,
			total: v.monto
		}))
	);
	const ultimasVentas = $derived([...ventasLive, ...ultimasVentasMock].slice(0, 6));

	const pagoStyles: Record<string, string> = {
		Efectivo: 'bg-emerald-100 text-emerald-700',
		Tarjeta: 'bg-sky-100 text-sky-700',
		Yape: 'bg-violet-100 text-violet-700'
	};

	let now = $state(new Date());
	$effect(() => {
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});
	const horaActual = $derived(
		now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
	);

	const esperadoEfectivo = $derived(caja.montoEsperado('Efectivo'));
	const esperadoYape = $derived(caja.montoEsperado('Yape'));

	let efectivoInicial = $state('');
	let yapeInicial = $state('');

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

	const diffEfectivo = $derived(
		Math.round(((Number(conteoEfectivo) || 0) - esperadoEfectivo) * 100) / 100
	);
	const diffYape = $derived(Math.round(((Number(conteoYape) || 0) - esperadoYape) * 100) / 100);

	function handleCerrarCaja() {
		caja.cerrar({
			Efectivo: Number(conteoEfectivo) || 0,
			Yape: Number(conteoYape) || 0
		});
		conteoEfectivoTocado = false;
		conteoYapeTocado = false;
		toast.success('Caja cerrada');
	}

	let movDialogOpen = $state(false);
	let movTipo: 'ingreso' | 'egreso' = $state('ingreso');
	let movMetodo: MetodoCaja = $state('Efectivo');
	let movMonto = $state('');

	function openMovDialog(tipo: 'ingreso' | 'egreso') {
		movTipo = tipo;
		movMetodo = 'Efectivo';
		movMonto = '';
		movDialogOpen = true;
	}

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

<svelte:head>
	<title>Dashboard · La tiendita</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<Breadcrumbs items={[{ label: 'Dashboard' }]} />

	<header class="flex items-center justify-between">
		<div class="flex flex-col gap-2">
			<h1 class="title">Dashboard</h1>
			<p class="text-sm text-stone-400">El resumen de tu tienda hoy.</p>
		</div>
		<p class="mt-1 text-3xl font-bold text-stone-800 tabular-nums">{horaActual}</p>
	</header>

	<section aria-label="Resumen de ventas" class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		{#each resumen as card (card.label)}
			<div class="flex flex-col gap-4 rounded-2xl {card.color} p-5">
				<p class="font-bold text-stone-800">{card.label}</p>
				<p class="text-3xl font-extrabold tracking-tight text-stone-800">
					{currency(card.value)}
				</p>
			</div>
		{/each}
	</section>

	<div class="flex flex-1 items-start gap-6">
		<section
			aria-labelledby="ventas-heading"
			class="flex flex-1 flex-col gap-4 rounded-2xl border-2 border-stone-200 bg-white p-6"
		>
			<div class="flex items-center justify-between">
				<h2 id="ventas-heading" class="text-lg font-extrabold text-stone-800">Últimas ventas</h2>
				<a href="/dashboard/ventas" class="link text-sm">Ver todas las ventas</a>
			</div>

			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-stone-100 text-left text-xs text-stone-400 uppercase">
						<th class="py-2 font-bold">Hora</th>
						<th class="py-2 font-bold">Productos</th>
						<th class="py-2 font-bold">Pago</th>
						<th class="py-2 text-right font-bold">Total</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-stone-100">
					{#each ultimasVentas as venta (venta.hora + venta.total)}
						<tr>
							<td class="py-3 text-stone-500">{venta.hora}</td>
							<td class="py-3 font-medium text-stone-700">{venta.descripcion}</td>
							<td class="py-3">
								<span class="rounded-full px-2.5 py-0.5 text-xs font-bold {pagoStyles[venta.pago]}">
									{venta.pago}
								</span>
							</td>
							<td class="py-3 text-right font-bold text-stone-800">{currency(venta.total)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

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
						<MoneyInput id="monto_efectivo" bind:value={efectivoInicial} />
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
	</div>
</main>

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
