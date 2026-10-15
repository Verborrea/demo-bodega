import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generarNotaCreditoVenta, VentaInvalidaError } from '$lib/server/ventas';
import { configApisunat } from '$lib/server/sunat';

// POST (no PATCH): llama a apisunat.pe, no es solo una actualización local.
export const POST: RequestHandler = async ({ params, platform }) => {
	const cfg = configApisunat(platform!.env);
	if (!cfg) error(503, 'Facturación electrónica no configurada.');

	try {
		const resultado = await generarNotaCreditoVenta(platform!.env.DB, params.id, cfg);
		return json({ ok: true, sunat: resultado.sunat, mensaje: resultado.mensaje });
	} catch (err) {
		if (err instanceof VentaInvalidaError) error(409, err.message);
		throw err;
	}
};
