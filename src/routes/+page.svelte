<script lang="ts">
	import { goto } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import { Store, CircleQuestionMark } from '@lucide/svelte';
	import { Button, Input, PasswordInput, Field } from '$lib/components/ui';

	let username = $state('');
	let password = $state('');
	let loading = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		if (!username || !password) {
			toast.error('Ingresa tu usuario y contraseña');
			return;
		}

		loading = true;
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ usuario: username, password })
			});

			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo iniciar sesión');
				return;
			}

			const data = (await res.json()) as { nombre: string };
			toast.success(`¡Bienvenido, ${data.nombre}!`);
			goto('/dashboard');
		} catch {
			toast.error('No se pudo conectar con el servidor');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Ingreso al sistema</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center gap-12 bg-stone-800 p-6">
	<div class="flex animate-slide-up items-center gap-3">
		<div class="flex size-8 items-center justify-center rounded-[10px] bg-yellow-400">
			<Store size={18} class="text-stone-800" strokeWidth={2.5} />
		</div>
		<span class="text-xl font-extrabold tracking-tight text-stone-50">La tiendita</span>
	</div>

	<div
		class="flex w-full max-w-sm animate-slide-up flex-col gap-8 rounded-3xl bg-stone-50 px-6 py-12 shadow-xl"
		style="animation-delay: 200ms"
	>
		<header class="text-center">
			<h1 class="title">Iniciar Sesión</h1>
			<p class="mt-1.5 text-sm text-stone-400">Ingresa tus datos para continuar</p>
		</header>

		<form id="login_form" class="flex flex-col gap-5" onsubmit={handleSubmit} method="get">
			<Field label="Usuario" for="username">
				<Input
					id="username"
					name="username"
					placeholder="Nombre de usuario"
					autocomplete="username"
					bind:value={username}
				/>
			</Field>

			<Field label="Contraseña" for="password">
				{#snippet action()}
					<a href="/forgot-password" class="link text-sm"> ¿La olvidaste? </a>
				{/snippet}
				<PasswordInput
					id="password"
					name="password"
					placeholder="••••••••"
					autocomplete="current-password"
					bind:value={password}
				/>
			</Field>
		</form>
		<Button type="submit" form="login_form" disabled={loading}>
			{loading ? 'Ingresando…' : 'Ingresar'}
		</Button>

		<div class="flex justify-center">
			<a
				href="https://wa.me/51940185837"
				target="_blank"
				rel="noopener noreferrer"
				class="link text-sm"
			>
				<CircleQuestionMark size={14} strokeWidth={3} />
				Necesito Ayuda
			</a>
		</div>
	</div>

	<p class="animate-slide-up text-sm text-stone-500" style="animation-delay: 350ms">
		© 2026 Redstone Technologies
	</p>
</div>
