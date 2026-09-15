import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { anularVenta, VentaInvalidaError } from '$lib/server/ventas';
import { actorDe } from '$lib/server/movimientos';

export const PATCH: RequestHandler = async ({ params, platform, locals }) => {
	try {
		await anularVenta(platform!.env.DB, params.id, actorDe(locals.user));
		return json({ ok: true });
	} catch (err) {
		if (err instanceof VentaInvalidaError) error(409, err.message);
		throw err;
	}
};
