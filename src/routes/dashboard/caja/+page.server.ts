import type { PageServerLoad } from './$types';
import { listHistorialCaja } from '$lib/server/caja';

const PAGE_SIZE = 10;

export const load: PageServerLoad = async ({ platform }) => {
	const { sesiones, total } = await listHistorialCaja(platform!.env.DB, {
		page: 1,
		pageSize: PAGE_SIZE
	});
	return { historial: sesiones, total, pageSize: PAGE_SIZE };
};
