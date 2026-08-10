<script lang="ts">
	import './layout.css';
	import { Toaster } from 'svelte-french-toast';
	import type { DefaultToastOptions } from 'svelte-french-toast';

	let { children } = $props();

	const toastOptions: DefaultToastOptions = {
		style: 'font-family: var(--font-sans); font-weight: 600; border-radius: 12px;',
		success: {
			iconTheme: { primary: 'var(--color-yellow-400)', secondary: 'var(--color-stone-800)' }
		}
	};
</script>

<Toaster {toastOptions} />

{@render children()}
