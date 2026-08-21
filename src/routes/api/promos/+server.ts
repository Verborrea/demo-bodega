import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listPromos, crearPromo, type PromoItemInput } from '$lib/server/promos';

export const GET: RequestHandler = async ({ platform }) => {
	const promos = await listPromos(platform!.env.DB);
	return json(promos);
};

interface CrearPromoBody {
	nombre?: string;
	precio?: number;
	items?: { productoId: string; presentacionId: string; cantidad: number }[];
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const body: CrearPromoBody = await request.json();

	const nombre = body.nombre?.trim();
	const precio = Number(body.precio);
	const items: PromoItemInput[] = (body.items ?? [])
		.filter((i) => i.productoId && i.presentacionId && i.cantidad > 0)
		.map((i) => ({
			productoId: i.productoId,
			presentacionId: i.presentacionId,
			cantidad: Math.floor(Number(i.cantidad))
		}));

	if (!nombre || !(precio >= 0) || items.length === 0) {
		error(400, 'Faltan datos requeridos: nombre, precio y al menos un producto.');
	}

	try {
		const id = await crearPromo(platform!.env.DB, { nombre, precio, items });
		return json({ id }, { status: 201 });
	} catch (err) {
		if (err instanceof Error) error(400, err.message);
		throw err;
	}
};
