<script lang="ts">
	import logo from '$lib/assets/logo.png';
	import { currencyImpresion as currency } from '$lib/utils';
	import { NEGOCIO } from '$lib/config/negocio';
	import type { VentaTicket } from '$lib/types/ticket';

	interface Props {
		venta: VentaTicket | null;
	}

	let { venta }: Props = $props();

	const SUNAT_LABEL: Record<string, string> = {
		pendiente: 'Pendiente de envío a SUNAT',
		aceptado: 'Aceptado por SUNAT',
		rechazado: 'Rechazado por SUNAT'
	};

	const opGravada = $derived(
		venta ? Math.round((venta.total / (1 + NEGOCIO.igvPorcentaje / 100)) * 100) / 100 : 0
	);
	const igv = $derived(venta ? Math.round((venta.total - opGravada) * 100) / 100 : 0);

	/** '1' DNI, '6' RUC, '0' sin documento — SUNAT identifica así el tipo de documento del cliente. */
	function tipoDocCliente(doc: string | null | undefined): string {
		if (!doc) return '0';
		const limpio = doc.replace(/\D/g, '');
		if (limpio.length === 11) return '6';
		if (limpio.length === 8) return '1';
		return '0';
	}

	// El QR de una boleta electrónica se genera con los datos propios del emisor en el momento
	// de imprimir (no depende de la respuesta de SUNAT); formato pipe-delimited estándar:
	// RUC|tipoDoc|serie|correlativo|IGV|total|fechaEmisión|tipoDocCliente|numDocCliente|""
	let qrDataUrl = $state<string | null>(null);
	$effect(() => {
		qrDataUrl = null;
		if (!venta || !venta.esBoleta || !venta.numeroComprobante) return;
		const [serie, correlativo] = venta.numeroComprobante.split('-');
		const [dd, mm, yyyy] = venta.fechaLabel.split('/');
		const contenido = [
			NEGOCIO.ruc,
			'03',
			serie,
			correlativo,
			igv.toFixed(2),
			venta.total.toFixed(2),
			`${yyyy}-${mm}-${dd}`,
			tipoDocCliente(venta.numeroDocumento),
			venta.numeroDocumento?.replace(/\D/g, '') || '',
			''
		].join('|');

		import('qrcode')
			.then((QRCode) => QRCode.toDataURL(contenido, { margin: 0, width: 120 }))
			.then((url) => (qrDataUrl = url))
			.catch(() => (qrDataUrl = null));
	});
</script>

<div id="ticket-imprimir" class="hidden">
	{#if venta}
		<div class="w-full p-3 font-mono text-xs text-black">
			<div class="flex justify-center">
				<img src={logo} alt={NEGOCIO.nombreComercial} class="size-28 object-contain" />
			</div>
			<p class="mt-1 text-center text-sm font-bold">{NEGOCIO.nombreComercial}</p>
			<p class="text-center">{NEGOCIO.razonSocial}</p>
			<p class="text-center">RUC {NEGOCIO.ruc}</p>
			<p class="text-center">{NEGOCIO.direccion}</p>
			{#if NEGOCIO.telefono}
				<p class="text-center">Tel. {NEGOCIO.telefono}</p>
			{/if}

			<div class="my-2 border-t border-dashed border-black"></div>

			<p class="text-center font-bold">
				{venta.esBoleta ? 'BOLETA DE VENTA ELECTRÓNICA' : 'NOTA DE PEDIDO'}
			</p>
			{#if venta.esBoleta && venta.numeroComprobante}
				<p class="text-center font-bold">{venta.numeroComprobante}</p>
			{:else if !venta.esBoleta}
				<p class="text-center">(no es un comprobante de pago)</p>
			{/if}
			<p class="text-center">{venta.fechaLabel} {venta.horaLabel}</p>

			<div class="my-2 border-t border-dashed border-black"></div>

			<p>Cliente: {venta.cliente ?? 'Público general'}</p>
			{#if venta.numeroDocumento}
				<p>
					{tipoDocCliente(venta.numeroDocumento) === '6' ? 'RUC' : 'DNI'}: {venta.numeroDocumento}
				</p>
			{/if}

			<div class="my-2 border-t border-dashed border-black"></div>

			{#each venta.items as item (item.id)}
				<div class="flex justify-between gap-2">
					<span>{item.cantidad} {item.nombreProducto}</span>
					<span class="shrink-0">{currency(item.cantidad * item.precioUnitario)}</span>
				</div>
			{/each}

			<div class="my-2 border-t border-dashed border-black"></div>

			{#if venta.esBoleta}
				<div class="flex justify-between">
					<span>Op. Gravada</span>
					<span>{currency(opGravada)}</span>
				</div>
				<div class="flex justify-between">
					<span>IGV ({NEGOCIO.igvPorcentaje}%)</span>
					<span>{currency(igv)}</span>
				</div>
			{/if}
			<div class="flex justify-between text-sm font-bold">
				<span>TOTAL</span>
				<span>{currency(venta.total)}</span>
			</div>
			<p class="mt-1">Pago: {venta.pago}</p>

			{#if venta.esBoleta}
				<div class="my-2 border-t border-dashed border-black"></div>
				{#if qrDataUrl}
					<div class="flex justify-center">
						<img src={qrDataUrl} alt="Código QR SUNAT" class="size-24 object-contain" />
					</div>
				{/if}
				<p class="mt-1 text-center">Representación impresa de la Boleta de Venta Electrónica</p>
				<p class="text-center font-bold">
					{SUNAT_LABEL[venta.sunatEstado ?? 'pendiente'] ?? 'Pendiente de envío a SUNAT'}
				</p>
			{/if}

			<p class="mt-3 text-center">¡Gracias por su compra!</p>
		</div>
	{/if}
</div>
