import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ajustarStockPresentacion } from '$lib/server/productos';

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	const { delta } = (await request.json()) as { delta: number };

	if (typeof delta !== 'number' || !Number.isFinite(delta)) {
		error(400, 'delta debe ser un número.');
	}

	try {
		const resultado = await ajustarStockPresentacion(platform!.env.DB, params.id, delta);
		return json(resultado);
	} catch (err) {
		if (err instanceof Error) error(404, err.message);
		throw err;
	}
};
