<script lang="ts">
	import { Store, CircleQuestionMark } from '@lucide/svelte';
	import { Button, Input, PasswordInput, Field } from '$lib/components/ui';

	let username = $state('');
	let password = $state('');

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
	}
</script>

<svelte:head>
	<title>Login</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center gap-12 bg-stone-800 px-4 py-12">
	<div class="flex items-center gap-3">
		<div class="flex size-9 items-center justify-center rounded-xl bg-yellow-500">
			<Store size={20} class="text-stone-800" strokeWidth={2.5} />
		</div>
		<span class="text-xl font-extrabold text-stone-50">La tiendita</span>
	</div>

	<div class="w-full max-w-sm rounded-3xl bg-stone-50 px-6 py-12 shadow-xl">
		<header class="mb-8 text-center">
			<h1 class="title">Iniciar Sesión</h1>
			<p class="mt-1.5 text-sm text-stone-400">Ingresa tus datos para continuar</p>
		</header>

		<form class="flex flex-col gap-5" onsubmit={handleSubmit}>
			<Field label="Usuario" for="username">
				<Input
					id="username"
					name="username"
					placeholder="¿Quién eres?"
					autocomplete="username"
					bind:value={username}
				/>
			</Field>

			<Field label="Contraseña" for="password">
				{#snippet action()}
					<a
						href="/forgot-password"
						class="text-sm font-bold text-yellow-500 hover:text-yellow-600"
					>
						¿La olvidaste?
					</a>
				{/snippet}
				<PasswordInput
					id="password"
					name="password"
					placeholder="Tu clave secreta"
					autocomplete="current-password"
					bind:value={password}
				/>
			</Field>

			<div class="mt-2">
				<Button type="submit">Ingresar</Button>
			</div>
		</form>

		<div class="mt-6 flex justify-center">
			<button type="button" class="link">
				<CircleQuestionMark size={14} strokeWidth={3} />
				Necesito Ayuda
			</button>
		</div>
	</div>

	<p class="text-sm text-stone-500">© 2026 Redstone Technologies</p>
</div>
