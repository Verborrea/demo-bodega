/**
 * Envío de la Boleta de Venta Electrónica a SUNAT — todavía no implementado, ver pasos abajo.
 *
 * Hoy `guardarVenta` (ver ventas.ts) genera serie/correlativo y deja toda boleta en
 * `sunat_estado = 'pendiente'`. Esta función es el punto donde debe engancharse el envío
 * real una vez que exista el certificado .p12; por ahora no la llama nadie.
 *
 * Pasos para implementar el envío real:
 *
 * 1. Sube el .p12 y su contraseña como secrets de Cloudflare (nunca al repo):
 *      wrangler secret put SUNAT_CERT_P12_BASE64   (contenido del .p12 en base64)
 *      wrangler secret put SUNAT_CERT_PASSWORD
 *      wrangler secret put SUNAT_SOL_USUARIO
 *      wrangler secret put SUNAT_SOL_CLAVE
 *    En local, cópialos a .dev.vars (ver .dev.vars.example).
 *
 * 2. Genera el XML UBL 2.1 de la boleta: un <cac:Invoice> con los datos de
 *    src/lib/config/negocio.ts (emisor) + la venta (cliente, items, IGV, total).
 *    Estructura y ejemplos: https://cpe.sunat.gob.pe
 *
 * 3. Fírmalo con XAdES-BES usando el .p12. En el runtime de Cloudflare Workers, ojo con
 *    librerías que dependen de Node `crypto`/`fs` reales — verifica que corran con
 *    `nodejs_compat` o hazlo en un servicio aparte.
 *
 * 4. Envíalo por SOAP al servicio `billService` de SUNAT (hay endpoint de pruebas/beta y
 *    uno de producción; SUNAT te da la URL real al activarte para facturación electrónica).
 *
 * 5. Con la respuesta (CDR), guarda `sunat_estado` ('aceptado'/'rechazado'), `sunat_hash`
 *    (el digest de la firma) y `sunat_error` en la venta.
 *
 * Alternativa mucho más simple y recomendada para una tienda de este tamaño: usar un
 * OSE/PSE (Proveedor de Servicios Electrónicos) como Nubefact, Facturador SUNAT, etc. Ya
 * resuelven XML + firma + SOAP y exponen una API REST simple (mandas JSON, te devuelven
 * PDF/QR/CDR). Cambia los pasos 2-4 por una sola llamada HTTP a su API con tu API key.
 */

export interface CredencialesSunat {
	solUsuario?: string;
	solClave?: string;
	certP12Base64?: string;
	certPassword?: string;
}

export function credencialesSunatDisponibles(env: CredencialesSunat): boolean {
	return Boolean(env.solUsuario && env.solClave && env.certP12Base64 && env.certPassword);
}
