<script lang="ts">
	import { Check } from '@lucide/svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	interface Props extends Omit<HTMLInputAttributes, 'type' | 'checked' | 'class'> {
		checked?: boolean;
		class?: string;
		children?: Snippet;
	}

	let { checked = $bindable(false), class: className = '', children, ...rest }: Props = $props();
</script>

<label
	class="inline-flex cursor-pointer items-center gap-2.5 text-sm font-bold text-stone-700 select-none has-disabled:cursor-not-allowed has-disabled:opacity-50 {className}"
>
	<span class="relative flex size-5 shrink-0 items-center justify-center">
		<input
			type="checkbox"
			bind:checked
			class="peer size-5 cursor-pointer appearance-none rounded-md border-2 border-stone-300 transition-colors checked:border-primary checked:bg-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed"
			{...rest}
		/>
		<Check
			size={13}
			strokeWidth={3.5}
			class="pointer-events-none absolute scale-50 text-stone-800 opacity-0 transition-all duration-150 peer-checked:scale-100 peer-checked:opacity-100"
		/>
	</span>
	{#if children}
		{@render children()}
	{/if}
</label>
