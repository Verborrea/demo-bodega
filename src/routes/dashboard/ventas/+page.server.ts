import type { PageServerLoad } from './$types';
import { listVentas } from '$lib/server/ventas';

const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ platform }) => {
	const { ventas, total, sumaTotal } = await listVentas(platform!.env.DB, {
		page: 1,
		pageSize: PAGE_SIZE
	});
	return { ventas, total, sumaTotal, pageSize: PAGE_SIZE };
};
