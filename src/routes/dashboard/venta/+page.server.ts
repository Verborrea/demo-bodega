import type { PageServerLoad } from './$types';
import { listPromos } from '$lib/server/promos';
import { listProductosFavoritos } from '$lib/server/productos';

export const load: PageServerLoad = async ({ platform, depends }) => {
	depends('productos:stock');
	const db = platform!.env.DB;
	const [promos, favoritos] = await Promise.all([listPromos(db), listProductosFavoritos(db)]);
	return { promos, favoritos };
};
