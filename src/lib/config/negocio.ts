/**
 * Datos públicos del negocio para los comprobantes impresos (boleta/nota de pedido). Se
 * hardcodean acá a propósito: RUC y titular ya son públicos en cualquier boleta, no son
 * secretos. Lo que SÍ es privado (usuario/clave SOL, certificado .p12) NO va acá — va como
 * variable de entorno/secret de Cloudflare. Ver .dev.vars.example y src/lib/server/sunat.ts.
 */
export const NEGOCIO = {
	nombreComercial: 'La Central',
	// RUC 10 = persona natural con negocio (no una empresa): acá va el nombre completo tal
	// como figura en su ficha RUC, no una razón social corporativa.
	razonSocial: 'ARIELA LILIANA APAZA PUMA',
	ruc: '10769247420',
	direccion: 'Pueblo Joven - Alto Victoria B-18, Cerro Colorado, Arequipa',
	telefono: '',
	serieBoleta: 'B001',
	serieFactura: 'F001',
	igvPorcentaje: 18,
	// Confirmado contra la pagina oficial de SUNAT (emprender.sunat.gob.pe, seccion "Nuevo RUS"):
	// un contribuyente del Nuevo RUS SOLO puede emitir boletas de venta, tickets y guias de
	// remision -- tiene explicitamente prohibido emitir comprobantes que den derecho a credito
	// fiscal (facturas). El RUC de este negocio esta afecto al Nuevo RUS (verificado en
	// e-consultaruc.sunat.gob.pe), asi que factura queda apagado aca aunque el padron tecnico de
	// SUNAT liste "FACTURA" como tipo habilitado para emision electronica (probablemente un
	// registro automatico al dar de alta el token de apisunat.pe, no una autorizacion legal para
	// usarla). Todo el soporte de factura (sunat.ts, ventas.ts, UI) sigue construido y probado --
	// si el negocio cambia de regimen, esto es lo unico que hay que volver a poner en true.
	puedeEmitirFactura: false
} as const;
