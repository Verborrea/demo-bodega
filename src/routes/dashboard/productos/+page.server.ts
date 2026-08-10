import type { PageServerLoad } from './$types';
import { listProductos, listProveedores, listCategorias } from '$lib/server/productos';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform!.env.DB;
	const [{ productos, total }, proveedores, categorias] = await Promise.all([
		listProductos(db, {
			page: 1,
			pageSize: PAGE_SIZE,
			search: '',
			categoriaId: '',
			proveedorId: ''
		}),
		listProveedores(db),
		listCategorias(db)
	]);

	return { productos, total, proveedores, categorias, pageSize: PAGE_SIZE };
};
