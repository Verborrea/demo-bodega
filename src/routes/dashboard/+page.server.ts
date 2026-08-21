import type { PageServerLoad } from './$types';
import { listVentas, totalVentasDelDia } from '$lib/server/ventas';

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform!.env.DB;
	const [ultimasVentas, ventasDelDia] = await Promise.all([
		listVentas(db, 6),
		totalVentasDelDia(db)
	]);

	return { ultimasVentas, ventasDelDia };
};
