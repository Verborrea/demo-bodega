import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	guardarVenta,
	listVentas,
	StockInsuficienteError,
	type ItemVentaInput,
	type TipoVenta
} from '$lib/server/ventas';
import { obtenerSesionAbierta } from '$lib/server/caja';

export const GET: RequestHandler = async ({ url, platform }) => {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));
	const search = url.searchParams.get('search') ?? '';
	const fechaInicio = url.searchParams.get('fechaInicio') ?? '';
	const fechaFin = url.searchParams.get('fechaFin') ?? '';

	const resultado = await listVentas(platform!.env.DB, {
		page,
		pageSize,
		search: search || undefined,
		fechaInicio: fechaInicio || undefined,
		fechaFin: fechaFin || undefined
	});

	return json(resultado);
};

interface ItemVentaBody {
	tipo?: 'producto' | 'promo';
	productoId?: string;
	presentacionId?: string;
	promoId?: string;
	cantidad?: number;
	precioUnitario?: number;
}

interface GuardarVentaBody {
	tipo?: TipoVenta;
	metodo?: string;
	numeroDocumento?: string | null;
	cliente?: string | null;
	total?: number;
	items?: ItemVentaBody[];
}

function validarItems(items: ItemVentaBody[]): ItemVentaInput[] {
	const validos: ItemVentaInput[] = [];
	for (const item of items) {
		if (
			!item.cantidad ||
			item.cantidad <= 0 ||
			item.precioUnitario == null ||
			item.precioUnitario < 0
		) {
			continue;
		}
		if (item.tipo === 'promo' && item.promoId) {
			validos.push({
				tipo: 'promo',
				promoId: item.promoId,
				cantidad: item.cantidad,
				precioUnitario: item.precioUnitario
			});
		} else if (item.productoId && item.presentacionId) {
			validos.push({
				tipo: 'producto',
				productoId: item.productoId,
				presentacionId: item.presentacionId,
				cantidad: item.cantidad,
				precioUnitario: item.precioUnitario
			});
		}
	}
	return validos;
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const body: GuardarVentaBody = await request.json();

	const items = validarItems(body.items ?? []);

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
