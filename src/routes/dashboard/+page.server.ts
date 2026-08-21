import type { PageServerLoad } from './$types';
import { listVentas, resumenVentas } from '$lib/server/ventas';

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform!.env.DB;
	const [{ ventas: ultimasVentas }, resumen] = await Promise.all([
		listVentas(db, { page: 1, pageSize: 6 }),
		resumenVentas(db)
	]);

	return { ultimasVentas, resumen };
};
