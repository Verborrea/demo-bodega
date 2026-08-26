import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { anularVenta, VentaInvalidaError } from '$lib/server/ventas';

export const PATCH: RequestHandler = async ({ params, platform }) => {
	try {
		await anularVenta(platform!.env.DB, params.id);
		return json({ ok: true });
	} catch (err) {
		if (err instanceof VentaInvalidaError) error(409, err.message);
		throw err;
	}
};
