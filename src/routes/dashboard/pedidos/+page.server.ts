import type { PageServerLoad } from './$types';
import { listPedidos, listProveedores } from '$lib/server/pedidos';
import { listMarcas, listCategorias } from '$lib/server/productos';

const PAGE_SIZE = 20;

// El catálogo completo (~3000 productos y creciendo) ya no se precarga aquí: el buscador
// de productos del diálogo "Nuevo Pedido" pega contra /api/productos, igual que en Venta.
export const load: PageServerLoad = async ({ platform }) => {
	const db = platform!.env.DB;
	const [{ pedidos, total }, proveedores, marcas, categorias] = await Promise.all([
		listPedidos(db, { page: 1, pageSize: PAGE_SIZE, search: '', proveedorId: '' }),
		listProveedores(db),
		listMarcas(db),
		listCategorias(db)
	]);

	return { pedidos, total, proveedores, marcas, categorias, pageSize: PAGE_SIZE };
};
