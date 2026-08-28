<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import toast from 'svelte-french-toast';
	import {
		LayoutDashboard,
		ShoppingCart,
		Package,
		Users,
		ChartLine,
		ChevronRight,
		LogOut,
		Truck,
		Plus,
		Calculator
	} from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { Avatar } from '$lib/components/ui';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import MobileHeader from '$lib/components/MobileHeader.svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	const cajero = $derived(data.user?.nombre ?? 'Invitado');
	const rol = $derived(
		data.user?.rol ? data.user.rol.charAt(0).toUpperCase() + data.user.rol.slice(1) : ''
	);

	const navItems = $derived([
		{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
		{ label: 'Ventas', href: '/dashboard/ventas', icon: ShoppingCart },
		{ label: 'Pedidos', href: '/dashboard/pedidos', icon: Truck },
		...(data.user?.rol === 'admin'
			? [
					{ label: 'Inventario', href: '/dashboard/productos', icon: Package },
					{ label: 'Historial de Caja', href: '/dashboard/caja', icon: Calculator },
					{ label: 'Usuarios', href: '/dashboard/usuarios', icon: Users },
					{ label: 'Reportes', href: '/dashboard/reportes', icon: ChartLine }
				]
			: [])
	]);

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
	<MobileHeader nombre={cajero} rol={data.user?.rol} />

	<aside
		class="fixed inset-y-0 left-0 z-10 hidden flex-col justify-between overflow-y-auto p-6 lg:flex"
	>
		<div class="flex w-65 grow flex-col gap-4 rounded-3xl bg-stone-800 p-6">
			<h1 class="text-center text-2xl font-extrabold tracking-tight text-stone-50">La Central</h1>

			<div class="flex items-center gap-3">
				<Avatar nombre={cajero} seed={data.user?.id} class="size-9 text-sm" />
				<div>
					<p class="font-bold text-stone-50">{cajero}</p>
					<p class="text-xs leading-3.75 text-stone-400">{rol}</p>
				</div>
			</div>

			<a
				href="/dashboard/venta"
				class="button justify-start gap-2 bg-primary py-3 text-sm font-bold text-stone-800 hover:bg-yellow-500"
			>
				<Plus size={16} strokeWidth={3} />
				Nueva Venta
			</a>

			<nav aria-label="Navegación principal" class="grow">
				<ul class="flex flex-col gap-1">
					{#each navItems as item (item.label)}
						{@const active = page.url.pathname === item.href}
						<li>
							<a
								href={item.href}
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
	<div class="@container flex min-h-screen flex-col pb-26.5 lg:ml-71 lg:pb-0">
		{@render children()}
	</div>

	<BottomNav rol={data.user?.rol} />
</div>
