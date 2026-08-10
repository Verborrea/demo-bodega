<script lang="ts">
	import { goto } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import {
		Store,
		ScanBarcode,
		LayoutDashboard,
		ShoppingCart,
		Package,
		Users,
		ChartLine,
		ChevronRight,
		LogOut,
		Coins,
		User
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui';

	const cajero = 'Maryori';
	const rol = 'Administradora';
	const fechaApertura = '06/08/2026';
	const ultimoMonto = 150;

	const resumen = [
		{ label: 'Ventas del día', value: 238.1, color: 'bg-yellow-400' },
		{ label: 'Ventas de la semana', value: 1572.6, color: 'bg-violet-300' },
		{ label: 'Ventas del mes', value: 8724.5, color: 'bg-sky-300' },
		{ label: 'Ventas del año', value: 45890.75, color: 'bg-emerald-300' }
	];

	const ultimasVentas = [
		{ hora: '08:12 p. m.', items: 3, pago: 'Efectivo', total: 45.0 },
		{ hora: '07:58 p. m.', items: 1, pago: 'Yape', total: 12.5 },
		{ hora: '07:40 p. m.', items: 5, pago: 'Tarjeta', total: 96.3 },
		{ hora: '07:15 p. m.', items: 2, pago: 'Efectivo', total: 28.0 },
		{ hora: '06:52 p. m.', items: 4, pago: 'Yape', total: 56.3 }
	];

	const pagoStyles: Record<string, string> = {
		Efectivo: 'bg-emerald-100 text-emerald-700',
		Tarjeta: 'bg-sky-100 text-sky-700',
		Yape: 'bg-violet-100 text-violet-700'
	};

	const navItems = [
		{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, active: true, chevron: true },
		{ label: 'Ventas', href: '/dashboard/ventas', icon: ShoppingCart },
		{ label: 'Productos', href: '/dashboard/productos', icon: Package },
		{ label: 'Usuarios', href: '/dashboard/usuarios', icon: Users },
		{ label: 'Reportes', href: '/dashboard/reportes', icon: ChartLine, chevron: true }
	];

	function currency(value: number) {
		return `S/ ${value.toFixed(2)}`;
	}

	function goToSoon(label: string) {
		return (event: MouseEvent) => {
			event.preventDefault();
			toast(`${label}: próximamente en esta demo`, { icon: '🚧' });
		};
	}

	function handleLogout() {
		toast.success('Sesión cerrada');
		goto('/');
	}

	let now = $state(new Date());
	$effect(() => {
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});
	const horaActual = $derived(
		now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
	);

	let montoInicial = $state('');
	function handleAbrirCaja(event: SubmitEvent) {
		event.preventDefault();
		if (!montoInicial) {
			toast.error('Ingresa el monto inicial de la caja');
			return;
		}
		toast.success(`Caja abierta con S/ ${montoInicial}`);
		montoInicial = '';
	}
</script>

<svelte:head>
	<title>Dashboard · La tiendita</title>
</svelte:head>

<div class="flex min-h-screen bg-stone-100">
	<aside class="flex w-72 shrink-0 flex-col justify-between bg-stone-900 px-4 py-6">
		<div class="flex flex-col gap-8">
			<div class="flex items-center gap-2.5 px-2">
				<div class="flex size-8 items-center justify-center rounded-[10px] bg-yellow-400">
					<Store size={18} class="text-stone-900" strokeWidth={2.5} />
				</div>
				<span class="text-lg font-extrabold tracking-tight text-stone-50">La Tiendita</span>
			</div>

			<div class="flex items-center gap-3 px-2">
				<div class="flex size-11 items-center justify-center rounded-full bg-stone-700">
					<User size={20} class="text-stone-300" />
				</div>
				<div>
					<p class="font-bold text-stone-50">{cajero}</p>
					<p class="text-xs text-stone-400">{rol}</p>
				</div>
			</div>

			<button
				type="button"
				onclick={goToSoon('Venta Rápida')}
				class="button gap-2 bg-yellow-400 text-stone-900 hover:bg-yellow-500"
			>
				<ScanBarcode size={18} strokeWidth={2.5} />
				Venta Rápida
			</button>

			<nav aria-label="Navegación principal">
				<ul class="flex flex-col gap-1">
					{#each navItems as item (item.label)}
						<li>
							<a
								href={item.href}
								onclick={item.active ? undefined : goToSoon(item.label)}
								class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors {item.active
									? 'bg-stone-50 text-stone-900'
									: 'text-stone-300 hover:bg-stone-800 hover:text-stone-50'}"
							>
								<item.icon size={18} strokeWidth={2.25} />
								<span class="flex-1">{item.label}</span>
								{#if item.chevron}
									<ChevronRight size={16} strokeWidth={2.5} />
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</div>

		<button
			type="button"
			onclick={handleLogout}
			class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-stone-300 transition-colors hover:bg-stone-800 hover:text-stone-50"
		>
			<LogOut size={18} strokeWidth={2.25} />
			Cerrar Sesión
		</button>
	</aside>

	<main class="flex flex-1 flex-col gap-6 overflow-auto p-6">
		<header class="flex items-center justify-between">
			<div>
				<h1 class="title text-2xl">Dashboard</h1>
				<p class="mt-0.5 text-sm text-stone-400">Resumen de tu tienda hoy</p>
			</div>
		</header>

		<section aria-label="Resumen de ventas" class="grid grid-cols-4 gap-4">
			{#each resumen as card (card.label)}
				<div class="flex flex-col gap-4 rounded-2xl {card.color} p-5">
					<p class="font-bold text-stone-800">{card.label}</p>
					<p class="text-3xl font-extrabold tracking-tight text-stone-900">
						{currency(card.value)}
					</p>
				</div>
			{/each}
		</section>

		<div class="flex flex-1 gap-6">
			<section
				aria-labelledby="ventas-heading"
				class="flex flex-1 flex-col gap-4 rounded-2xl bg-white p-6"
			>
				<div class="flex items-center justify-between">
					<h2 id="ventas-heading" class="text-lg font-extrabold text-stone-800">Últimas ventas</h2>
					<a
						href="/dashboard/ventas"
						onclick={goToSoon('Historial de ventas')}
						class="link text-sm"
					>
						Ver todas las ventas
					</a>
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
						{#each ultimasVentas as venta (venta.hora)}
							<tr>
								<td class="py-3 text-stone-500">{venta.hora}</td>
								<td class="py-3 font-medium text-stone-700">
									{venta.items} producto{venta.items === 1 ? '' : 's'}
								</td>
								<td class="py-3">
									<span
										class="rounded-full px-2.5 py-0.5 text-xs font-bold {pagoStyles[venta.pago]}"
									>
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
				class="flex w-80 shrink-0 flex-col gap-6 rounded-2xl bg-stone-900 p-6 text-stone-50"
			>
				<h2 id="caja-heading" class="text-center text-xl font-extrabold tracking-tight">CAJA</h2>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<p class="text-xs font-bold text-stone-400 uppercase">Cajero</p>
						<p class="mt-1 font-bold">{cajero}</p>
					</div>
					<div>
						<p class="text-xs font-bold text-stone-400 uppercase">Fecha de apertura</p>
						<p class="mt-1 font-bold">{fechaApertura}</p>
					</div>
				</div>

				<div>
					<p class="text-xs font-bold text-stone-400 uppercase">Último monto de caja</p>
					<p class="mt-1 font-bold">{currency(ultimoMonto)}</p>
				</div>

				<div>
					<p class="text-xs font-bold text-stone-400 uppercase">Hora actual</p>
					<p class="mt-1 text-2xl font-extrabold tabular-nums">{horaActual}</p>
				</div>

				<form onsubmit={handleAbrirCaja} class="flex flex-col gap-3">
					<h3 class="text-lg font-extrabold">Abrir Caja</h3>
					<label for="monto_inicial" class="text-sm font-bold">Monto inicial de la caja:</label>
					<div class="relative">
						<Coins
							size={18}
							class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-stone-400"
						/>
						<input
							id="monto_inicial"
							name="monto_inicial"
							type="number"
							min="0"
							step="0.10"
							inputmode="decimal"
							placeholder="Colocar monto actual"
							bind:value={montoInicial}
							class="w-full rounded-xl bg-stone-50 py-3.5 pr-4 pl-11 font-medium text-stone-800 placeholder-stone-400 outline-none focus:ring-3 focus:ring-yellow-400"
						/>
					</div>
					<Button type="submit" class="mt-1 uppercase">Abrir Caja</Button>
				</form>
			</aside>
		</div>
	</main>
</div>
