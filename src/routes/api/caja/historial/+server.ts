import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listHistorialCaja } from '$lib/server/caja';

export const GET: RequestHandler = async ({ url, platform }) => {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize')) || 10));

	const resultado = await listHistorialCaja(platform!.env.DB, { page, pageSize });
	return json(resultado);
};
