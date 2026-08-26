import type { PageServerLoad } from './$types';
import { listPromos } from '$lib/server/promos';

// El catálogo completo ya no se precarga aquí: el buscador de productos del diálogo
// "Nueva Promo" pega contra /api/productos, igual que en Venta/Pedidos.
export const load: PageServerLoad = async ({ platform }) => {
	const promos = await listPromos(platform!.env.DB);
	return { promos };
};
