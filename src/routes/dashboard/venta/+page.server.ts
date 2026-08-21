import type { PageServerLoad } from './$types';
import { listProductos } from '$lib/server/productos';

export const load: PageServerLoad = async ({ platform, depends }) => {
	depends('productos:stock');
	const { productos } = await listProductos(platform!.env.DB, {
		page: 1,
		pageSize: 500,
		search: '',
		categoriaId: '',
		marcaId: ''
	});
	return { productos };
};
