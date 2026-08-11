import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { guardarVenta } from '$lib/server/ventas';

interface GuardarVentaBody {
	metodo?: string;
	comprobante?: string;
	numeroDocumento?: string | null;
	cliente?: string | null;
	total?: number;
	items?: { nombre: string; cantidad: number; precioUnitario: number }[];
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const body: GuardarVentaBody = await request.json();

	const items = (body.items ?? []).filter((item) => item.nombre?.trim() && item.cantidad > 0);

	if (!body.metodo || !body.comprobante || typeof body.total !== 'number' || items.length === 0) {
		error(400, 'Faltan datos requeridos: método, comprobante, total y al menos un producto.');
	}

	const id = await guardarVenta(platform!.env.DB, {
		metodo: body.metodo,
		comprobante: body.comprobante,
		numeroDocumento: body.numeroDocumento?.trim() || null,
		cliente: body.cliente?.trim() || null,
		total: body.total,
		items
	});

	return json({ id }, { status: 201 });
};
