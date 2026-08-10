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
		primary: 'bg-yellow-400 text-stone-800 hover:bg-yellow-500',
		secondary: 'bg-stone-200 text-stone-800 hover:bg-stone-300',
		ghost: 'bg-transparent text-stone-500 hover:text-stone-700'
	};
</script>

<button class="button {variants[variant]} {className}" {...rest}>
	{@render children()}
</button>
