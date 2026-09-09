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
	igvPorcentaje: 18
} as const;
