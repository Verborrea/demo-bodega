<script lang="ts">
	interface Props {
		value?: string;
		diff?: number;
		id?: string;
		oninput?: (event: Event) => void;
	}

	let { value = $bindable(''), diff = 0, id, oninput }: Props = $props();
</script>

<div class="relative">
	<div
		class="flex h-12 items-center gap-1.5 rounded-xl bg-stone-200 pr-24 pl-4 text-sm transition-colors focus-within:bg-stone-100 focus-within:ring-3 focus-within:ring-primary"
	>
		<span class="font-medium text-stone-400">S/</span>
		<input
			{id}
			bind:value
			{oninput}
			type="number"
			step="any"
			min="0"
			inputmode="decimal"
			class="w-full flex-1 bg-transparent font-medium text-stone-800 outline-none"
			placeholder={(-diff).toFixed(2)}
		/>
	</div>
	{#if diff}
		<span
			class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-bold whitespace-nowrap {diff >=
			0
				? 'text-success'
				: 'text-error'}"
		>
			{diff >= 0 ? '+' : '-'}S/ {Math.abs(diff).toFixed(2)}
		</span>
	{/if}
</div>
