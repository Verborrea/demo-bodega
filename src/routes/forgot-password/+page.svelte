<script lang="ts">
	import { goto } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import { Store, ArrowLeft } from '@lucide/svelte';
	import { Button, Input, Field } from '$lib/components/ui';

	let identifier = $state('');
	let loading = $state(false);
	let sent = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		if (!identifier) {
			toast.error('Ingresa tu usuario o correo');
			return;
		}

		loading = true;
		await new Promise((resolve) => setTimeout(resolve, 600));
		loading = false;
		sent = true;
		toast.success('Instrucciones enviadas');

		await new Promise((resolve) => setTimeout(resolve, 1400));
		goto('/');
	}
</script>

<svelte:head>
	<title>Recuperar contraseña</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center gap-12 bg-stone-800 px-4 py-12">
	<div class="flex items-center gap-3">
		<div class="flex size-8 items-center justify-center rounded-[10px] bg-yellow-400">
			<Store size={18} class="text-stone-800" strokeWidth={2.5} />
		</div>
		<span class="text-xl font-extrabold tracking-tight text-stone-50">La tiendita</span>
	</div>

	<div class="flex w-full max-w-sm flex-col gap-8 rounded-3xl bg-stone-50 px-6 py-12 shadow-xl">
		{#if sent}
			<header class="flex flex-col items-center gap-3 text-center">
				<h1 class="title">Revisa tu correo</h1>
				<p class="text-sm text-stone-400">
					Enviamos las instrucciones para recuperar tu contraseña a
					<span class="font-bold text-stone-600">{identifier}</span>. Te llevaremos de vuelta al
					inicio en un momento…
				</p>
			</header>
		{:else}
			<header class="text-center">
				<h1 class="title">¿La olvidaste?</h1>
				<p class="mt-1.5 text-sm text-stone-400">
					Ingresa tu usuario o correo y te enviaremos instrucciones para recuperarla
				</p>
			</header>

			<form id="forgot_form" class="flex flex-col gap-5" onsubmit={handleSubmit}>
				<Field label="Usuario o correo" for="identifier">
					<Input
						id="identifier"
						name="identifier"
						placeholder="Nombre de usuario o correo"
						autocomplete="username"
						bind:value={identifier}
					/>
				</Field>
			</form>
			<Button type="submit" form="forgot_form" disabled={loading}>
				{loading ? 'Enviando…' : 'Enviar instrucciones'}
			</Button>
		{/if}

		<div class="flex justify-center">
			<a href="/" class="link text-sm">
				<ArrowLeft size={14} strokeWidth={3} />
				Volver a iniciar sesión
			</a>
		</div>
	</div>

	<p class="text-sm text-stone-500">© 2026 Redstone Technologies</p>
</div>
