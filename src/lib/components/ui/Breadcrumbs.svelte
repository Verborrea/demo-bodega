<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';

	type BreadcrumbItem = {
		label: string;
		href?: string;
	};

	let {
		items = []
	}: {
		items?: BreadcrumbItem[];
	} = $props();
</script>

<nav aria-label="Breadcrumb">
	<ol class="breadcrumbs">
		{#each items as item, index}
			<li class="breadcrumb-item font-semibold text-stone-400">
				{#if item.href && index < items.length - 1}
					<a href={item.href}>{item.label}</a>
				{:else}
					<span aria-current="page">{item.label}</span>
				{/if}

				{#if index < items.length - 1}
					<span class="separator" aria-hidden="true">
						<ChevronRight size={16} strokeWidth={3} />
					</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	.breadcrumbs {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.875rem;
	}

	.breadcrumb-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	a {
		color: inherit;
		text-decoration: none;
		transition: opacity 0.15s ease;
	}

	a:hover,
	span[aria-current='page'] {
		color: var(--color-stone-800);
	}

	.separator {
		user-select: none;
	}
</style>
