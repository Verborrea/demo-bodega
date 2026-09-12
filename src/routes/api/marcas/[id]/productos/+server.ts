import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listProductosDeMarca } from '$lib/server/productos';

export const GET: RequestHandler = async ({ params, platform }) => {
	const productos = await listProductosDeMarca(platform!.env.DB, params.id);
	return json(productos);
};
