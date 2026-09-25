import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { anularVenta, VentaInvalidaError } from '$lib/server/ventas';
import { actorDe } from '$lib/server/movimientos';
import { configApisunat } from '$lib/server/sunat';

export const PATCH: RequestHandler = async ({ params, platform, locals }) => {
	try {
		const resultado = await anularVenta(
			platform!.env.DB,
			params.id,
			actorDe(locals.user),
			configApisunat(platform!.env)
		);
		return json({ ok: true, sunat: resultado.sunat, mensaje: resultado.mensaje });
	} catch (err) {
		if (err instanceof VentaInvalidaError) error(409, err.message);
		throw err;
	}
};
