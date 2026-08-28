<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	interface Props extends HTMLInputAttributes {
		value?: string;
		class?: string;
		icon?: Snippet;
		trailing?: Snippet;
	}

	let { value = $bindable(''), class: className = '', icon, trailing, ...rest }: Props = $props();
</script>

{#if icon || trailing}
	<div
		class="flex h-12 items-center gap-2 rounded-xl bg-stone-200 px-4 text-sm transition-colors focus-within:bg-stone-100 focus-within:ring-3 focus-within:ring-primary {className}"
	>
		{#if icon}
			<span class="shrink-0 text-stone-400">{@render icon()}</span>
		{/if}
		<input
			bind:value
			class="w-full flex-1 bg-transparent font-medium text-stone-800 placeholder-stone-400 outline-none placeholder:font-normal"
			{...rest}
		/>
		{#if trailing}
			<span class="shrink-0">{@render trailing()}</span>
		{/if}
	</div>
{:else}
	<input bind:value class="input {className}" {...rest} />
{/if}
