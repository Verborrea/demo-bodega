import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { marcarFavorito } from '$lib/server/productos';

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	const { favorito } = (await request.json()) as { favorito: boolean };
	if (typeof favorito !== 'boolean') error(400, 'favorito debe ser true o false.');

	const actualizado = await marcarFavorito(platform!.env.DB, params.id, favorito);
	if (!actualizado) error(404, 'El producto ya no existe.');
	return json({ ok: true });
};
