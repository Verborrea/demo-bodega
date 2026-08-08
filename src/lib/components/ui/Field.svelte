<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		for: string;
		action?: Snippet;
		children: Snippet;
	}

	let { label, for: htmlFor, action, children }: Props = $props();
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center justify-between">
		<label for={htmlFor} class="text-sm font-bold text-stone-800">{label}</label>
		{#if action}
			{@render action()}
		{/if}
	</div>
	{@render children()}
</div>
