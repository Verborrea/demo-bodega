import type { PageServerLoad } from './$types';
import { listProductos } from '$lib/server/productos';
import { listPromos } from '$lib/server/promos';

export const load: PageServerLoad = async ({ platform, depends }) => {
	depends('productos:stock');
	const db = platform!.env.DB;
	const [{ productos }, promos] = await Promise.all([
		listProductos(db, { page: 1, pageSize: 500, search: '', categoriaId: '', marcaId: '' }),
		listPromos(db)
	]);
	return { productos, promos };
};
