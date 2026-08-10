import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ajustarStock } from '$lib/server/productos';

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	const { delta } = (await request.json()) as { delta: number };

	if (typeof delta !== 'number' || !Number.isFinite(delta)) {
		error(400, 'delta debe ser un número.');
	}

	const cantidad = await ajustarStock(platform!.env.DB, params.id, delta);
	if (cantidad === null) error(404, 'Producto no encontrado.');

	return json({ cantidad });
};
