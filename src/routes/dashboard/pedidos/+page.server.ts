import type { PageServerLoad } from './$types';
import { listPedidos, listProveedores } from '$lib/server/pedidos';
import { listProductos } from '$lib/server/productos';

const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform!.env.DB;
	const [{ pedidos, total }, proveedores, { productos }] = await Promise.all([
		listPedidos(db, { page: 1, pageSize: PAGE_SIZE, search: '', proveedorId: '' }),
		listProveedores(db),
		listProductos(db, { page: 1, pageSize: 500, search: '', categoriaId: '', marcaId: '' })
	]);

	return { pedidos, total, proveedores, productos, pageSize: PAGE_SIZE };
};
