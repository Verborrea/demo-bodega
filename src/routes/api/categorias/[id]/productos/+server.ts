import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listProductosDeCategoria } from '$lib/server/productos';

export const GET: RequestHandler = async ({ params, platform }) => {
	const productos = await listProductosDeCategoria(platform!.env.DB, params.id);
	return json(productos);
};
