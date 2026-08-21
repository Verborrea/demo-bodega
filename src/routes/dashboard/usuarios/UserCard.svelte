<script lang="ts">
	import { Pencil, Trash2, Crown, ShieldCheck, Wallet, Lock } from '@lucide/svelte';
	import { Avatar } from '$lib/components/ui';
	import type { UsuarioDTO } from '$lib/server/usuarios';

	interface Props {
		usuario: UsuarioDTO;
		esUsuarioActual?: boolean;
		onEdit: () => void;
		onDelete: () => void;
	}

	let { usuario, esUsuarioActual = false, onEdit, onDelete }: Props = $props();

	const noEliminable = $derived(usuario.esRoot || esUsuarioActual);
</script>

<div
	class="group flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-2 ring-stone-200 transition-all hover:-translate-y-1 hover:shadow-lg hover:ring-yellow-200"
>
	<div class="flex items-start justify-between gap-2">
		<div class="flex items-center gap-3">
			<Avatar
				nombre={usuario.nombre}
				seed={usuario.id}
				class="size-12 -rotate-3 text-lg transition-transform group-hover:rotate-3"
			/>
			<div>
				<p class="font-extrabold text-stone-800">{usuario.nombre}</p>
				<p class="text-sm text-stone-400">@{usuario.usuario}</p>
			</div>
		</div>
		{#if usuario.esRoot}
			<span
				class="flex shrink-0 items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-bold text-yellow-700"
				title="Usuario root: siempre activo y no se puede eliminar"
			>
				<Crown size={12} strokeWidth={2.5} />
				Root
			</span>
		{:else if esUsuarioActual}
			<span class="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-500">
				Tú
			</span>
		{/if}
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<span
			class="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold {usuario.rol ===
			'admin'
				? 'bg-violet-100 text-violet-700'
				: 'bg-sky-100 text-sky-700'}"
		>
			{#if usuario.rol === 'admin'}
				<ShieldCheck size={12} strokeWidth={2.5} />
				Administrador
			{:else}
				<Wallet size={12} strokeWidth={2.5} />
				Cajero
			{/if}
		</span>
		<span
			class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold {usuario.activo
				? 'bg-emerald-100 text-emerald-700'
				: 'bg-red-100 text-red-700'}"
		>
			<span class="size-1.5 rounded-full {usuario.activo ? 'bg-emerald-500' : 'bg-red-500'}"></span>
			{usuario.activo ? 'Activo' : 'Inactivo'}
		</span>
	</div>

	<div class="mt-auto flex items-center justify-end gap-1 pt-3">
		<button
			type="button"
			onclick={onEdit}
			class="inline-flex size-9 cursor-pointer items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
			aria-label="Editar a {usuario.nombre}"
		>
			<Pencil size={16} />
		</button>
		<button
			type="button"
			onclick={onDelete}
			disabled={noEliminable}
			title={usuario.esRoot
				? 'El usuario root no se puede eliminar'
				: esUsuarioActual
					? 'No puedes eliminar tu propio usuario'
					: 'Eliminar usuario'}
			class="inline-flex size-9 cursor-pointer items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-stone-400"
			aria-label="Eliminar a {usuario.nombre}"
		>
			{#if noEliminable}
				<Lock size={16} />
			{:else}
				<Trash2 size={16} />
			{/if}
		</button>
	</div>
</div>
