import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { kardexProducto } from '$lib/server/movimientos';
import { hoyLima } from '$lib/server/fecha';

export const GET: RequestHandler = async ({ params, url, platform }) => {
	const hoy = hoyLima();
	const desde = url.searchParams.get('desde') || hoy;
	const hasta = url.searchParams.get('hasta') || hoy;

	const kardex = await kardexProducto(platform!.env.DB, params.productoId, { desde, hasta });
	return json(kardex);
};
