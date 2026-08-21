import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listPedidos, crearPedido, type PedidoItemInput } from '$lib/server/pedidos';

export const GET: RequestHandler = async ({ url, platform }) => {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));
	const search = url.searchParams.get('search') ?? '';
	const proveedorId = url.searchParams.get('proveedorId') ?? '';

	const resultado = await listPedidos(platform!.env.DB, { page, pageSize, search, proveedorId });
	return json(resultado);
};

interface CrearPedidoBody {
	codigo?: string | null;
	proveedorId?: string;
	fecha?: string;
	notas?: string | null;
	items?: { productoId: string; presentacionId: string; cantidad: number; costoUnitario: number }[];
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const body: CrearPedidoBody = await request.json();

	const proveedorId = body.proveedorId?.trim();
	const items: PedidoItemInput[] = (body.items ?? [])
		.filter((i) => i.productoId && i.presentacionId && i.cantidad > 0 && i.costoUnitario >= 0)
		.map((i) => ({
			productoId: i.productoId,
			presentacionId: i.presentacionId,
			cantidad: Math.floor(Number(i.cantidad)),
			costoUnitario: Number(i.costoUnitario)
		}));

	if (!proveedorId || items.length === 0) {
		error(400, 'Faltan datos requeridos: proveedor y al menos un producto con costo unitario.');
	}

	try {
		const id = await crearPedido(platform!.env.DB, {
			codigo: body.codigo?.trim() || null,
			proveedorId,
			fecha: body.fecha,
			notas: body.notas?.trim() || null,
			items
		});
		return json({ id }, { status: 201 });
	} catch (err) {
		if (err instanceof Error) error(400, err.message);
		throw err;
	}
};
