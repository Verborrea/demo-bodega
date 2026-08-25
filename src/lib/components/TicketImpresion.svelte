<script lang="ts">
	import logo from '$lib/assets/logo.png';
	import { currencyImpresion as currency } from '$lib/utils';
	import type { VentaTicket } from '$lib/types/ticket';

	interface Props {
		venta: VentaTicket | null;
	}

	let { venta }: Props = $props();
</script>

<div id="ticket-imprimir" class="hidden">
	{#if venta}
		<div class="w-full p-3 font-mono text-xs text-black">
			<div class="flex justify-center">
				<img src={logo} alt="La Central" class="size-28 object-contain" />
			</div>
			<p class="mt-1 text-center text-sm font-bold">La Central</p>
			<p class="text-center">
				{venta.tipo}
				{#if venta.numeroDocumento}
					· {venta.numeroDocumento}
				{/if}
			</p>
			<p class="text-center">{venta.fechaLabel} {venta.horaLabel}</p>
			<p class="mt-2">Cliente: {venta.cliente ?? 'Público general'}</p>
			<div class="my-2 border-t border-dashed border-black"></div>
			{#each venta.items as item (item.id)}
				<div class="flex justify-between">
					<span>{item.cantidad} {item.nombreProducto}</span>
					<span>{currency(item.cantidad * item.precioUnitario)}</span>
				</div>
			{/each}
			<div class="my-2 border-t border-dashed border-black"></div>
			<div class="flex justify-between text-sm font-bold">
				<span>TOTAL</span>
				<span>{currency(venta.total)}</span>
			</div>
			<p class="mt-1">Pago: {venta.pago}</p>
			<p class="mt-3 text-center">¡Gracias por su compra!</p>
		</div>
	{/if}
</div>
