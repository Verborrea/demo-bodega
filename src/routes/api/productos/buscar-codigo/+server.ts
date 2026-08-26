import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buscarPorCodigoBarras } from '$lib/server/productos';
import { conCacheDeBorde } from '$lib/server/cache';

export const GET: RequestHandler = async ({ url, platform, request }) => {
	const codigo = url.searchParams.get('codigo')?.trim();
	if (!codigo) error(400, 'Falta el parámetro codigo.');

	// El código de barras de un producto prácticamente nunca cambia, y el mismo producto
	// se escanea decenas de veces al día: TTL largo, es el punto de mayor ahorro.
	return conCacheDeBorde(request, platform, 120, async () => {
		const producto = await buscarPorCodigoBarras(platform!.env.DB, codigo);
		if (!producto) error(404, 'No se encontró ningún producto con ese código de barras.');
		return json(producto);
	});
};
