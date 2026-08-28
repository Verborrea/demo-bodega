<script lang="ts">
	import { page } from '$app/state';
	import { House, ShoppingBasket, Plus, Package, Calculator } from '@lucide/svelte';

	const navItems = [
		{ label: 'Inicio', href: '/test', icon: House },
		{ label: 'Ventas', href: '/dashboard/ventas', icon: ShoppingBasket },
		{ label: 'Nueva venta', href: '/dashboard/venta', icon: Plus, destacado: true },
		{ label: 'Inventario', href: '/dashboard/productos', icon: Package },
		{ label: 'Caja', href: '/dashboard/caja', icon: Calculator }
	];
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 py-[max(1rem,env(safe-area-inset-bottom))]"
>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-x-0 bottom-0 -z-10 size-full bg-linear-to-t from-stone-50/80 to-transparent"
	></div>
	<nav aria-label="Navegación principal" class="pointer-events-auto w-full">
		<ul class="flex w-full items-center justify-evenly rounded-3xl bg-stone-800 p-2">
			{#each navItems as item (item.href)}
				{@const active = page.url.pathname === item.href}
				<li>
					{#if item.destacado}
						<a
							href={item.href}
							aria-current={active ? 'page' : undefined}
							class="text-stone-8 00 mx-2 flex size-11 flex-col items-center justify-center rounded-full bg-primary transition-all active:scale-90"
						>
							<item.icon size={24} strokeWidth={3} />
							<span class="sr-only">{item.label}</span>
						</a>
					{:else}
						<a
							href={item.href}
							aria-current={active ? 'page' : undefined}
							class="flex w-16 flex-col items-center justify-center gap-1.5 rounded-2xl p-2 text-[11px] leading-4 font-bold transition-all active:scale-90 {active
								? 'text-primary'
								: 'text-stone-400 hover:text-stone-200'}"
						>
							<item.icon size={20} strokeWidth={2} />
							{item.label}
						</a>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>
</div>
