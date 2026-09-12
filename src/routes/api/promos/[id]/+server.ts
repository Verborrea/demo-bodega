import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { actualizarPromo, eliminarPromo, type PromoItemInput } from '$lib/server/promos';

interface ActualizarPromoBody {
	nombre?: string;
	precio?: number;
	items?: { productoId: string; presentacionId: string; cantidad: number }[];
}

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	const body: ActualizarPromoBody = await request.json();

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
		await actualizarPromo(platform!.env.DB, params.id, { nombre, precio, items });
		return json({ ok: true });
	} catch (err) {
		const codigo = err instanceof Error ? err.message : '';
		if (codigo === 'PROMO_NO_EXISTE') error(404, 'La promo ya no existe.');
		if (err instanceof Error) error(400, err.message);
		throw err;
	}
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	await eliminarPromo(platform!.env.DB, params.id);
	return json({ ok: true });
};
