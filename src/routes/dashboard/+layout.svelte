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
		User
	} from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const cajero = 'Maryori';
	const rol = 'Administradora';

	const navItems = [
		{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
		{ label: 'Ventas', href: '/dashboard/ventas', icon: ShoppingCart },
		{ label: 'Productos', href: '/dashboard/productos', icon: Package },
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

<div class="min-h-screen bg-stone-100">
	<aside
		class="fixed inset-y-0 left-0 z-10 flex w-72 flex-col justify-between overflow-y-auto bg-stone-900 px-4 py-6"
	>
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

			<a
				href="/dashboard/venta"
				class="button gap-2 bg-yellow-400 text-stone-900 hover:bg-yellow-500"
			>
				<ScanBarcode size={18} strokeWidth={2.5} />
				Nueva Venta
			</a>

			<nav aria-label="Navegación principal">
				<ul class="flex flex-col gap-1">
					{#each navItems as item (item.label)}
						{@const active = page.url.pathname === item.href}
						<li>
							<a
								href={item.href}
								onclick={item.soon ? goToSoon(item.label) : undefined}
								class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors {active
									? 'bg-stone-50 text-stone-900'
									: 'text-stone-300 hover:bg-stone-800 hover:text-stone-50'}"
							>
								<item.icon size={18} strokeWidth={2.25} />
								<span class="flex-1">{item.label}</span>

								<ChevronRight
									size={16}
									strokeWidth={2.5}
									class={active ? 'block' : 'hidden group-hover:block'}
								/>
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

	<div class="ml-72 flex min-h-screen flex-col">
		{@render children()}
	</div>
</div>
