<script lang="ts">
	import { goto } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import { DropdownMenu } from 'bits-ui';
	import { EllipsisVertical, Truck, Users, ChartLine, LogOut } from '@lucide/svelte';

	interface Props {
		nombre: string;
		rol: string | undefined;
	}
	let { nombre, rol }: Props = $props();

	async function handleLogout() {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
		} catch {
			// Si falla la llamada igual navegamos: sin cookie válida el hook ya bloquea el dashboard.
		}
		toast.success('Sesión cerrada');
		goto('/');
	}

	const itemClass =
		'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-stone-700 outline-none data-highlighted:bg-stone-100';
</script>

<div class="lg:hidden">
	<header class="flex items-center justify-between bg-stone-50 px-5 pt-4 pb-2">
		<p class="text-xl font-extrabold text-stone-800">Hola, {nombre}!</p>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="flex size-11 cursor-pointer items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 active:scale-90"
				aria-label="Más opciones"
			>
				<EllipsisVertical size={22} />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align="end"
					sideOffset={8}
					class="z-50 flex w-56 flex-col gap-1 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-stone-100"
				>
					<DropdownMenu.Item onSelect={() => goto('/dashboard/pedidos')} class={itemClass}>
						<Truck size={16} />
						Pedidos
					</DropdownMenu.Item>
					{#if rol === 'admin'}
						<DropdownMenu.Item onSelect={() => goto('/dashboard/usuarios')} class={itemClass}>
							<Users size={16} />
							Usuarios
						</DropdownMenu.Item>
						<DropdownMenu.Item onSelect={() => goto('/dashboard/reportes')} class={itemClass}>
							<ChartLine size={16} />
							Reportes
						</DropdownMenu.Item>
					{/if}
					<DropdownMenu.Separator class="my-1 h-px bg-stone-100" />
					<DropdownMenu.Item
						onSelect={handleLogout}
						class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-red-500 outline-none data-highlighted:bg-red-50"
					>
						<LogOut size={16} />
						Cerrar Sesión
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	</header>
</div>
