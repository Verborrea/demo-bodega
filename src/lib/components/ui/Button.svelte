<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost';

	interface Props extends HTMLButtonAttributes {
		variant?: Variant;
		children: Snippet;
	}

	let { variant = 'primary', class: className = '', children, ...rest }: Props = $props();

	const variants: Record<Variant, string> = {
		primary: 'bg-amber-400 text-stone-900 hover:bg-amber-500 active:bg-amber-600',
		secondary: 'bg-stone-200 text-stone-900 hover:bg-stone-300 active:bg-stone-400',
		ghost: 'bg-transparent text-stone-500 hover:text-stone-700'
	};
</script>

<button
	class="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {variants[
		variant
	]} {className}"
	{...rest}
>
	{@render children()}
</button>
