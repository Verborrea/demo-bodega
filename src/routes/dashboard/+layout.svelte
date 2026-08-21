<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
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
		Archive,
		Truck
	} from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import user_placeholder from '$lib/assets/user.png';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	const cajero = $derived(data.user?.nombre ?? 'Invitado');
	const rol = $derived(
		data.user?.rol ? data.user.rol.charAt(0).toUpperCase() + data.user.rol.slice(1) : ''
	);

	const navItems = $derived([
		{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
		{ label: 'Ventas', href: '/dashboard/ventas', icon: ShoppingCart },
		{ label: 'Inventario', href: '/dashboard/productos', icon: Package },
		{ label: 'Pedidos', href: '/dashboard/pedidos', icon: Truck },
		{ label: 'Historial de Caja', href: '/dashboard/caja', icon: Archive },
		...(data.user?.rol === 'admin'
			? [{ label: 'Usuarios', href: '/dashboard/usuarios', icon: Users }]
			: []),
		{ label: 'Reportes', href: '/dashboard/reportes', icon: ChartLine, soon: true }
	]);

	function goToSoon(label: string) {
		return (event: MouseEvent) => {
			event.preventDefault();
			toast(`${label}: próximamente en esta demo`, { icon: '🚧' });
		};
	}

	async function handleLogout() {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
		} catch {
			// Si falla la llamada igual navegamos: sin cookie válida el hook ya bloquea el dashboard.
		}
		toast.success('Sesión cerrada');
		goto('/');
	}
</script>

<div class="min-h-screen bg-stone-50">
	<aside class="fixed inset-y-0 left-0 z-10 flex flex-col justify-between overflow-y-auto p-6">
		<div class="flex w-65 grow flex-col gap-6 rounded-3xl bg-stone-800 p-6">
			<h1 class="text-center text-2xl font-extrabold tracking-tight text-stone-50">La Tiendita</h1>

			<div class="flex items-center gap-3">
				<img src={user_placeholder} alt="Usuario" class="block size-9" />
				<div>
					<p class="font-bold text-stone-50">{cajero}</p>
					<p class="text-xs text-stone-400">{rol}</p>
				</div>
			</div>

			<a
				href="/dashboard/venta"
				class="button justify-start gap-2 bg-yellow-400 py-3 text-sm font-bold text-stone-800 hover:bg-yellow-500"
			>
				<ScanBarcode size={16} strokeWidth={2.5} />
				Nueva Venta
			</a>

			<nav aria-label="Navegación principal" class="grow">
				<ul class="flex flex-col gap-1">
					{#each navItems as item (item.label)}
						{@const active = page.url.pathname === item.href}
						<li>
							<a
								href={item.href}
								onclick={item.soon ? goToSoon(item.label) : undefined}
								class="group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition-colors {active
									? 'bg-stone-50 text-stone-800'
									: 'text-stone-300 hover:bg-stone-700 hover:text-stone-50'}"
							>
								<item.icon size={18} strokeWidth={2.25} />
								<span class="flex-1">{item.label}</span>
								<ChevronRight
									size={16}
									strokeWidth={3}
									class={active
										? 'opacity-100'
										: '-translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100'}
								/>
							</a>
						</li>
					{/each}
				</ul>
			</nav>

			<button
				type="button"
				onclick={handleLogout}
				class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-stone-300 transition-colors hover:bg-stone-800 hover:text-stone-50"
			>
				<LogOut size={18} strokeWidth={2.25} />
				Cerrar Sesión
			</button>
		</div>
	</aside>
	<div class="ml-71 flex min-h-screen flex-col">
		{@render children()}
	</div>
</div>
