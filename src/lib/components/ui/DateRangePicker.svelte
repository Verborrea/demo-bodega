<script lang="ts">
	import { Popover, RangeCalendar } from 'bits-ui';
	import { getLocalTimeZone, type DateValue } from '@internationalized/date';
	import { Calendar, ChevronLeft, ChevronRight, X } from '@lucide/svelte';
	import { formatFecha } from '$lib/utils';

	export type DateRangeValue = { start: DateValue | undefined; end: DateValue | undefined };

	interface Props {
		value?: DateRangeValue;
		class?: string;
	}

	let { value = $bindable({ start: undefined, end: undefined }), class: className = '' }: Props =
		$props();

	let open = $state(false);

	const label = $derived.by(() => {
		if (value.start && value.end && value.start.compare(value.end) !== 0) {
			return `${formatFecha(value.start.toDate(getLocalTimeZone()))} – ${formatFecha(value.end.toDate(getLocalTimeZone()))}`;
		}
		if (value.start) {
			return formatFecha(value.start.toDate(getLocalTimeZone()));
		}
		return 'Filtrar por fecha';
	});

	// Un solo clic en un día selecciona ese único día como rango (start === end) en vez de
	// dejar el rango "a medio elegir" esperando un segundo clic — confuso para quien no sabe
	// que debe hacer doble clic. Para un rango de varios días, se sigue pudiendo arrastrar
	// de un día a otro (bits-ui ya lo soporta); clic-clic ahora siempre da un solo día.
	$effect(() => {
		if (value.start && !value.end) {
			value = { start: value.start, end: value.start };
		}
	});

	function limpiar(event: Event) {
		event.stopPropagation();
		value = { start: undefined, end: undefined };
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		class="flex w-fit cursor-pointer items-center gap-2 rounded-xl bg-stone-200 px-4 py-3.5 font-medium whitespace-nowrap text-stone-800 transition-colors hover:bg-stone-300 {className}"
	>
		<Calendar size={16} class="shrink-0 text-stone-400" />
		<span class="text-left">{label}</span>
		{#if value.start}
			<span
				role="button"
				tabindex="0"
				onclick={limpiar}
				onkeydown={(event) => event.key === 'Enter' && limpiar(event)}
				class="cursor-pointer text-stone-400 hover:text-stone-600"
				aria-label="Limpiar fechas"
			>
				<X size={14} />
			</span>
		{/if}
	</Popover.Trigger>

	<Popover.Content sideOffset={8} class="z-20 rounded-2xl bg-white p-4 shadow-xl">
		<RangeCalendar.Root bind:value weekdayFormat="short" locale="es-PE" class="flex flex-col gap-3">
			{#snippet children({ months, weekdays })}
				<RangeCalendar.Header class="flex items-center justify-between">
					<RangeCalendar.PrevButton
						class="flex size-8 cursor-pointer items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
					>
						<ChevronLeft size={16} />
					</RangeCalendar.PrevButton>
					<RangeCalendar.Heading class="text-sm font-bold text-stone-800 capitalize" />
					<RangeCalendar.NextButton
						class="flex size-8 cursor-pointer items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
					>
						<ChevronRight size={16} />
					</RangeCalendar.NextButton>
				</RangeCalendar.Header>
				{#each months as month (month.value)}
					<RangeCalendar.Grid class="w-full border-collapse space-y-1 select-none">
						<RangeCalendar.GridHead>
							<RangeCalendar.GridRow class="flex justify-between">
								{#each weekdays as day (day)}
									<RangeCalendar.HeadCell class="w-8 text-xs font-bold text-stone-400 capitalize">
										{day}
									</RangeCalendar.HeadCell>
								{/each}
							</RangeCalendar.GridRow>
						</RangeCalendar.GridHead>
						<RangeCalendar.GridBody>
							{#each month.weeks as weekDates (weekDates)}
								<RangeCalendar.GridRow class="flex w-full justify-between">
									{#each weekDates as date (date)}
										<RangeCalendar.Cell {date} month={month.value} class="p-0">
											<RangeCalendar.Day
												class="flex size-8 cursor-pointer items-center justify-center rounded-lg text-sm text-stone-700 hover:bg-yellow-100 data-disabled:pointer-events-none data-disabled:text-stone-300 data-outside-month:text-stone-300 data-selected:bg-yellow-400 data-selected:font-bold data-selected:text-stone-800 data-selection-end:rounded-lg data-selection-start:rounded-lg data-unavailable:text-stone-300 data-unavailable:line-through"
											/>
										</RangeCalendar.Cell>
									{/each}
								</RangeCalendar.GridRow>
							{/each}
						</RangeCalendar.GridBody>
					</RangeCalendar.Grid>
				{/each}
			{/snippet}
		</RangeCalendar.Root>
	</Popover.Content>
</Popover.Root>
