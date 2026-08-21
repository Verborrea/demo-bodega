<script lang="ts">
	import logo from '$lib/assets/logo.png';
	import { currency, formatFechaHora } from '$lib/utils';
	import type { PedidoDTO } from '$lib/server/pedidos';

	interface Props {
		pedido: PedidoDTO | null;
	}

	let { pedido }: Props = $props();
</script>

<div id="pedido-imprimir" class="hidden">
	{#if pedido}
		<div class="w-full p-10 text-black">
			<div class="flex items-center justify-between border-b-2 border-black pb-4">
				<div class="flex items-center gap-3">
					<img src={logo} alt="La Central" class="h-16 w-16 object-contain" />
					<div>
						<p class="text-xl font-extrabold">La Central</p>
						<p class="text-sm text-stone-600">Orden de Pedido</p>
					</div>
				</div>
				<div class="text-right text-sm">
					<p><strong>Código:</strong> {pedido.codigo || '—'}</p>
					<p><strong>Fecha:</strong> {formatFechaHora(pedido.fecha)}</p>
				</div>
			</div>

			<div class="mt-4 text-sm">
				<p><strong>Proveedor:</strong> {pedido.proveedorNombre}</p>
				{#if pedido.notas}
					<p class="mt-1"><strong>Notas:</strong> {pedido.notas}</p>
				{/if}
			</div>

			<table class="mt-6 w-full border-collapse text-sm">
				<thead>
					<tr class="border-b-2 border-black text-left">
						<th class="py-2">Producto</th>
						<th class="py-2">Presentación</th>
						<th class="py-2 text-right">Cantidad</th>
						<th class="py-2 text-right">Costo Unit.</th>
						<th class="py-2 text-right">Subtotal</th>
					</tr>
				</thead>
				<tbody>
					{#each pedido.items as item (item.id)}
						<tr class="border-b border-stone-300">
							<td class="py-2">{item.nombreProducto}</td>
							<td class="py-2">{item.nombrePresentacion}</td>
							<td class="py-2 text-right">{item.cantidad}</td>
							<td class="py-2 text-right">{currency(item.costoUnitario)}</td>
							<td class="py-2 text-right">{currency(item.subtotal)}</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<div class="mt-4 flex justify-end">
				<div
					class="flex w-64 justify-between border-t-2 border-black pt-2 text-base font-extrabold"
				>
					<span>Total</span>
					<span>{currency(pedido.total)}</span>
				</div>
			</div>
		</div>
	{/if}
</div>
