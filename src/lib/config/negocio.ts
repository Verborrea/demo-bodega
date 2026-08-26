/**
 * usuario/clave SOL, certificado .p12 NO va acá — va como variable
 * de entorno/secret de Cloudflare. Ver .dev.vars.example y src/lib/server/sunat.ts.
 */
export const NEGOCIO = {
	nombreComercial: 'La Central',
	razonSocial: 'COMPLETAR RAZÓN SOCIAL S.A.C.',
	ruc: '20000000000',
	direccion: 'Completar dirección fiscal, distrito, Lima, Perú',
	telefono: '',
	serieBoleta: 'B001',
	igvPorcentaje: 18
} as const;
