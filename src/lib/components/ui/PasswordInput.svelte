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
	<input
		bind:value
		type={visible ? 'text' : 'password'}
		class="w-full rounded-xl bg-stone-200 px-4 py-3.5 pr-12 text-stone-900 placeholder-stone-400 outline-none transition-colors focus:bg-stone-100 focus:ring-2 focus:ring-amber-400 {className}"
		{...rest}
	/>
	<button
		type="button"
		onclick={() => (visible = !visible)}
		class="absolute inset-y-0 right-0 flex items-center px-4 text-stone-500 transition-colors hover:text-stone-700"
		aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
	>
		{#if visible}
			<EyeOff size={20} />
		{:else}
			<Eye size={20} />
		{/if}
	</button>
</div>
