<script lang="ts">
	import toast from 'svelte-french-toast';
	import { Plus } from '@lucide/svelte';
	import {
		Button,
		Select,
		Dialog,
		Input,
		PasswordInput,
		Breadcrumbs,
		Checkbox
	} from '$lib/components/ui';
	import UserCard from './UserCard.svelte';
	import type { PageData } from './$types';
	import type { UsuarioDTO } from '$lib/server/usuarios';

	let { data }: { data: PageData } = $props();

	let usuariosLista = $state<UsuarioDTO[]>(data.usuarios);

	async function recargar() {
		try {
			const res = await fetch('/api/usuarios');
			if (!res.ok) throw new Error('request failed');
			const resultado = (await res.json()) as { usuarios: UsuarioDTO[] };
			usuariosLista = resultado.usuarios;
		} catch {
			toast.error('No se pudo cargar la lista de usuarios');
		}
	}

	let dialogOpen = $state(false);
	let guardando = $state(false);
	let editando = $state<UsuarioDTO | null>(null);
	let campoUsuario = $state('');
	let campoNombre = $state('');
	let campoRol = $state<'admin' | 'cajero'>('cajero');
	let campoActivo = $state(true);
	let campoPassword = $state('');

	function abrirDialog() {
		editando = null;
		campoUsuario = '';
		campoNombre = '';
		campoRol = 'cajero';
		campoActivo = true;
		campoPassword = '';
		dialogOpen = true;
	}

	function abrirDialogEditar(usuario: UsuarioDTO) {
		editando = usuario;
		campoUsuario = usuario.usuario;
		campoNombre = usuario.nombre;
		campoRol = usuario.rol === 'admin' ? 'admin' : 'cajero';
		campoActivo = usuario.activo;
		campoPassword = '';
		dialogOpen = true;
	}

	async function handleGuardar(event: SubmitEvent) {
		event.preventDefault();

		if (!campoUsuario.trim() || !campoNombre.trim()) {
			toast.error('Completa el usuario y el nombre');
			return;
		}
		if (!editando && campoPassword.length < 8) {
			toast.error('La contraseña debe tener al menos 8 caracteres');
			return;
		}
		if (campoPassword && campoPassword.length < 8) {
			toast.error('La contraseña debe tener al menos 8 caracteres');
			return;
		}

		guardando = true;
		try {
			const payload = {
				usuario: campoUsuario.trim(),
				nombre: campoNombre.trim(),
				rol: campoRol,
				activo: campoActivo,
				...(campoPassword ? { password: campoPassword } : {})
			};

			const res = editando
				? await fetch(`/api/usuarios/${editando.id}`, {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					})
				: await fetch('/api/usuarios', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					});

			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(
					cuerpo?.message ??
						(editando ? 'No se pudo actualizar el usuario' : 'No se pudo crear el usuario')
				);
				return;
			}

			toast.success(editando ? 'Usuario actualizado' : 'Usuario creado');
			await recargar();
			dialogOpen = false;
		} finally {
			guardando = false;
		}
	}

	async function eliminarUsuario(usuario: UsuarioDTO) {
		if (!confirm(`¿Eliminar al usuario "${usuario.nombre}"?`)) return;
		try {
			const res = await fetch(`/api/usuarios/${usuario.id}`, { method: 'DELETE' });
			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo eliminar el usuario');
				return;
			}
			toast.success('Usuario eliminado');
			await recargar();
		} catch {
			toast.error('No se pudo eliminar el usuario');
		}
	}
</script>

<svelte:head>
	<title>Usuarios · La Central</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Usuarios' }]} />

	<header>
		<h1 class="title">Usuarios</h1>
		<p class="mt-1 text-sm text-stone-400">Gestiona quién puede entrar al sistema</p>
	</header>

	<section aria-labelledby="usuarios-heading" class="flex flex-1 flex-col gap-4">
		<h2 id="usuarios-heading" class="sr-only">Listado de usuarios</h2>
		<div class="grid grid-cols-1 gap-4 @min-[768px]:grid-cols-2 @min-[1024px]:grid-cols-3">
			<button
				type="button"
				onclick={abrirDialog}
				class="group flex min-h-43 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 text-stone-400 transition-all hover:-translate-y-1 hover:border-yellow-400 hover:bg-yellow-50 hover:text-yellow-600"
			>
				<span
					class="flex size-12 items-center justify-center rounded-2xl bg-stone-100 transition-colors group-hover:bg-yellow-100"
				>
					<Plus size={22} strokeWidth={2.5} />
				</span>
				<span class="text-sm font-bold">Agregar usuario</span>
			</button>

			{#each usuariosLista as usuario (usuario.id)}
				<UserCard
					{usuario}
					esUsuarioActual={usuario.id === data.user?.id}
					onEdit={() => abrirDialogEditar(usuario)}
					onDelete={() => eliminarUsuario(usuario)}
				/>
			{/each}
		</div>
	</section>
</main>

<Dialog bind:open={dialogOpen} title={editando ? 'Editar usuario' : 'Nuevo usuario'}>
	<p class="-mt-4 text-sm text-stone-400">
		{editando ? 'Actualiza los datos de acceso' : 'Crea un nuevo acceso al sistema'}
	</p>
	<form onsubmit={handleGuardar} class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label for="usuario" class="text-sm font-bold text-stone-800">Usuario</label>
			<Input id="usuario" bind:value={campoUsuario} placeholder="ej. jperez" type="text" />
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="nombre" class="text-sm font-bold text-stone-800">Nombre completo</label>
			<Input id="nombre" bind:value={campoNombre} placeholder="ej. Juana Pérez" type="text" />
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="rol" class="text-sm font-bold text-stone-800">Rol</label>
			<Select id="rol" bind:value={campoRol} disabled={editando?.esRoot}>
				<option value="cajero">Cajero</option>
				<option value="admin">Administrador</option>
			</Select>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="password" class="text-sm font-bold text-stone-800">
				{editando ? 'Nueva contraseña (opcional)' : 'Contraseña'}
			</label>
			<PasswordInput
				id="password"
				bind:value={campoPassword}
				placeholder={editando ? 'Dejar en blanco para no cambiarla' : 'Mínimo 8 caracteres'}
			/>
		</div>

		{#if !editando?.esRoot}
			<Checkbox bind:checked={campoActivo}>Usuario activo</Checkbox>
		{/if}

		<div class="grid grid-cols-2 gap-3">
			<Button type="button" variant="danger" onclick={() => (dialogOpen = false)}>Cancelar</Button>
			<Button type="submit" variant="success" disabled={guardando}>
				{guardando ? 'Guardando…' : editando ? 'Guardar' : 'Crear'}
			</Button>
		</div>
	</form>
</Dialog>
