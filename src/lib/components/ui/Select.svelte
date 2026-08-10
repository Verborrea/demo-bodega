<script lang="ts" generics="T extends string">
	import { ChevronDown } from '@lucide/svelte';
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	interface Props extends Omit<HTMLSelectAttributes, 'value'> {
		value?: T;
		class?: string;
		children: Snippet;
	}

	let { value = $bindable(), class: className = '', children, ...rest }: Props = $props();
</script>

<div class="relative {className}">
	<select bind:value class="input appearance-none pr-10" {...rest}>
		{@render children()}
	</select>
	<ChevronDown
		size={16}
		strokeWidth={2.5}
		class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-stone-400"
	/>
</div>
