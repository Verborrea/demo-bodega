import type { PageServerLoad } from './$types';
import { listHistorialCaja } from '$lib/server/caja';
import { listUsuarios } from '$lib/server/usuarios';

const PAGE_SIZE = 10;

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform!.env.DB;
	const [{ sesiones, total }, cajeros] = await Promise.all([
		listHistorialCaja(db, { page: 1, pageSize: PAGE_SIZE }),
		listUsuarios(db)
	]);
	return { historial: sesiones, total, pageSize: PAGE_SIZE, cajeros };
};
