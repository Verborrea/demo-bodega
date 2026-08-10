<script lang="ts">
	import { Eye, EyeOff } from '@lucide/svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'type'> {
		value?: string;
		class?: string;
	}

	let { value = $bindable(''), class: className = '', ...rest }: Props = $props();

	let visible = $state(false);
</script>

<div class="relative">
	<input bind:value type={visible ? 'text' : 'password'} class="input {className}" {...rest} />
	<button
		type="button"
		onclick={() => (visible = !visible)}
		class="absolute inset-y-0 right-0 flex cursor-pointer items-center px-4 text-stone-400 transition-colors hover:text-stone-800 focus-visible:outline-yellow-400"
		aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
	>
		{#if visible}
			<EyeOff size={18} strokeWidth={2.5} />
		{:else}
			<Eye size={18} strokeWidth={2.5} />
		{/if}
	</button>
</div>
