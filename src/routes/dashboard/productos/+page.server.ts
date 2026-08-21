import type { PageServerLoad } from './$types';
import { listProductos, listMarcas, listCategorias } from '$lib/server/productos';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform!.env.DB;
	const [{ productos, total }, marcas, categorias] = await Promise.all([
		listProductos(db, {
			page: 1,
			pageSize: PAGE_SIZE,
			search: '',
			categoriaId: '',
			marcaId: ''
		}),
		listMarcas(db),
		listCategorias(db)
	]);

	return { productos, total, marcas, categorias, pageSize: PAGE_SIZE };
};
