import type { PageServerLoad } from './$types';
import { listPromos } from '$lib/server/promos';
import { listProductos } from '$lib/server/productos';

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform!.env.DB;
	const [promos, { productos }] = await Promise.all([
		listPromos(db),
		listProductos(db, { page: 1, pageSize: 500, search: '', categoriaId: '', marcaId: '' })
	]);

	return { promos, productos };
};
