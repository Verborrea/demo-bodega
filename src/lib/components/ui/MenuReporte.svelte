<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { ChevronDown } from '@lucide/svelte';

	interface Props {
		onExcel: () => void;
		onPDF: () => void;
		/** Normalmente `!total || exportando`: sin filas que exportar el menú no tiene sentido. */
		disabled?: boolean;
		/**
		 * El ancho lo pone quien lo usa (o el stretch de su grid/flex): el trigger no fija
		 * ninguno propio, porque entre dos utilidades de ancho gana el orden del CSS
		 * generado, no el del atributo class, y el override del call site no era confiable.
		 */
		class?: string;
	}

	let { onExcel, onPDF, disabled = false, class: className = '' }: Props = $props();

	const itemClass =
		'flex cursor-pointer items-center rounded-xl px-3 py-2.5 text-sm font-bold text-stone-700 outline-none data-highlighted:bg-stone-100 data-disabled:cursor-not-allowed data-disabled:opacity-40';
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		{disabled}
		class="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-stone-200 px-3 text-sm font-extrabold whitespace-nowrap text-stone-700 transition-colors hover:bg-stone-300 disabled:cursor-not-allowed disabled:opacity-40 @min-[640px]:px-5 {className}"
	>
		Reporte
		<ChevronDown size={14} strokeWidth={3} class="text-stone-500" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			align="end"
			sideOffset={8}
			class="z-50 flex w-56 flex-col gap-1 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-stone-100"
		>
			<DropdownMenu.Item onSelect={onExcel} class={itemClass}>Excel (.xlsx)</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={onPDF} class={itemClass}>PDF (.pdf)</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
