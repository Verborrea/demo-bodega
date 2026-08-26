<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'type' | 'value'> {
		value?: string;
		class?: string;
	}

	let { value = $bindable(''), class: className = '', ...rest }: Props = $props();
</script>

<div
	class="flex items-center gap-1.5 rounded-xl bg-stone-200 px-4 py-3.5 transition-colors focus-within:bg-stone-100 focus-within:ring-3 focus-within:ring-yellow-400 {className}"
>
	<span class="font-medium text-stone-400">S/</span>
	<input
		bind:value
		type="number"
		min="0"
		step="any"
		inputmode="decimal"
		placeholder="0.00"
		class="w-full flex-1 bg-transparent font-medium text-stone-800 placeholder-stone-400 outline-none"
		{...rest}
	/>
</div>
