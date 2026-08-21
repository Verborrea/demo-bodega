import type { PageServerLoad } from './$types';
import { listPedidos, listProveedores } from '$lib/server/pedidos';
import { listProductos, listMarcas, listCategorias } from '$lib/server/productos';

const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform!.env.DB;
	const [{ pedidos, total }, proveedores, { productos }, marcas, categorias] = await Promise.all([
		listPedidos(db, { page: 1, pageSize: PAGE_SIZE, search: '', proveedorId: '' }),
		listProveedores(db),
		listProductos(db, { page: 1, pageSize: 500, search: '', categoriaId: '', marcaId: '' }),
		listMarcas(db),
		listCategorias(db)
	]);

	return { pedidos, total, proveedores, productos, marcas, categorias, pageSize: PAGE_SIZE };
};
