<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		value?: string;
		class?: string;
	}

	let { value = $bindable(''), class: className = '', ...rest }: Props = $props();
</script>

<input
	bind:value
	class="w-full rounded-xl bg-stone-200 px-4 py-3.5 text-stone-900 placeholder-stone-400 outline-none transition-colors focus:bg-stone-100 focus:ring-2 focus:ring-amber-400 {className}"
	{...rest}
/>
