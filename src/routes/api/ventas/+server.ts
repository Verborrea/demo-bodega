import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { guardarVenta, StockInsuficienteError, type TipoVenta } from '$lib/server/ventas';
import { obtenerSesionAbierta } from '$lib/server/caja';

interface GuardarVentaBody {
	tipo?: TipoVenta;
	metodo?: string;
	numeroDocumento?: string | null;
	cliente?: string | null;
	total?: number;
	items?: { productoId: string; presentacionId: string; cantidad: number; precioUnitario: number }[];
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const body: GuardarVentaBody = await request.json();

	const items = (body.items ?? []).filter(
		(item) => item.productoId && item.presentacionId && item.cantidad > 0 && item.precioUnitario >= 0
	);

	if (
		(body.tipo !== 'boleta' && body.tipo !== 'nota_pedido') ||
		!body.metodo ||
		typeof body.total !== 'number' ||
		items.length === 0
	) {
		error(400, 'Faltan datos requeridos: tipo, método, total y al menos un producto.');
	}

	const db = platform!.env.DB;
	const sesion = await obtenerSesionAbierta(db);
	if (!sesion) {
		error(400, 'Abre la caja antes de registrar una venta.');
	}

	const cajero = locals.user!;

	try {
		const id = await guardarVenta(
			db,
			{
				tipo: body.tipo,
				metodo: body.metodo,
				numeroDocumento: body.numeroDocumento?.trim() || null,
				cliente: body.cliente?.trim() || null,
				total: body.total,
				items
			},
			sesion.id,
			{ id: cajero.id, nombre: cajero.nombre }
		);
		return json({ id }, { status: 201 });
	} catch (err) {
		if (err instanceof StockInsuficienteError) error(409, err.message);
		throw err;
	}
};
