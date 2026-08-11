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
		Archive
	} from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import user_placeholder from '$lib/assets/user.png';

	let { children }: { children: Snippet } = $props();

	const cajero = 'Maryori';
	const rol = 'Administradora';

	const navItems = [
		{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
		{ label: 'Ventas', href: '/dashboard/ventas', icon: ShoppingCart },
		{ label: 'Inventario', href: '/dashboard/productos', icon: Package },
		{ label: 'Historial de Caja', href: '/dashboard/caja', icon: Archive },
		{ label: 'Usuarios', href: '/dashboard/usuarios', icon: Users, soon: true },
		{ label: 'Reportes', href: '/dashboard/reportes', icon: ChartLine, soon: true }
	];

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
				<ul class="flex flex-col">
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
									class={active ? 'block' : 'hidden group-hover:block'}
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
