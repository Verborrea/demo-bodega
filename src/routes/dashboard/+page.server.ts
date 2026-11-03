import type { PageServerLoad } from './$types';
import { listVentasPagina, resumenVentas } from '$lib/server/ventas';

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform!.env.DB;
	const [ultimasVentas, resumen] = await Promise.all([
		listVentasPagina(db, { page: 1, pageSize: 6 }),
		resumenVentas(db)
	]);

	return { ultimasVentas, resumen };
};
