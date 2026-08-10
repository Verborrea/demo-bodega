import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buscarPorCodigoBarras } from '$lib/server/productos';

export const GET: RequestHandler = async ({ url, platform }) => {
	const codigo = url.searchParams.get('codigo')?.trim();
	if (!codigo) error(400, 'Falta el parámetro codigo.');

	const producto = await buscarPorCodigoBarras(platform!.env.DB, codigo);
	if (!producto) error(404, 'No se encontró ningún producto con ese código de barras.');

	return json(producto);
};
