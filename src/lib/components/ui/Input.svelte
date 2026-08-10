<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		value?: string;
		class?: string;
	}

	let { value = $bindable(''), class: className = '', ...rest }: Props = $props();
</script>

<input bind:value class="input {className}" {...rest} />
