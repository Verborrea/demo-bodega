import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sincronizarSunatVenta, VentaInvalidaError } from '$lib/server/ventas';
import { configApisunat } from '$lib/server/sunat';

// POST (no PATCH): esto puede tener efectos fuera del sistema (llama a apisunat.pe),
// no es solo una actualización local. Cajera o admin pueden reintentar por igual.
export const POST: RequestHandler = async ({ params, platform }) => {
	const cfg = configApisunat(platform!.env);
	if (!cfg) error(503, 'Facturación electrónica no configurada.');

	try {
		return json(await sincronizarSunatVenta(platform!.env.DB, params.id, cfg));
	} catch (err) {
		if (err instanceof VentaInvalidaError) error(409, err.message);
		throw err;
	}
};
