import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	guardarVenta,
	listVentas,
	VentaInvalidaError,
	type ItemVentaInput,
	type PagoVentaDTO,
	type TipoVenta,
	type OrdenVenta
} from '$lib/server/ventas';
import { obtenerSesionAbierta, METODOS_CAJA, type MetodoCaja } from '$lib/server/caja';

const ORDENES_VALIDOS: OrdenVenta[] = ['fecha', 'cliente', 'cajero', 'total'];

export const GET: RequestHandler = async ({ url, platform }) => {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));
	const search = url.searchParams.get('search') ?? '';
	const fechaInicio = url.searchParams.get('fechaInicio') ?? '';
	const fechaFin = url.searchParams.get('fechaFin') ?? '';
	const orderByParam = url.searchParams.get('orderBy');
	const orderBy = ORDENES_VALIDOS.includes(orderByParam as OrdenVenta)
		? (orderByParam as OrdenVenta)
		: undefined;
	const orderDir = url.searchParams.get('orderDir') === 'asc' ? 'asc' : 'desc';

	const resultado = await listVentas(platform!.env.DB, {
		page,
		pageSize,
		search: search || undefined,
		fechaInicio: fechaInicio || undefined,
		fechaFin: fechaFin || undefined,
		orderBy,
		orderDir
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

interface PagoBody {
	metodo?: string;
	monto?: number;
}

interface GuardarVentaBody {
	tipo?: TipoVenta;
	pagos?: PagoBody[];
	numeroDocumento?: string | null;
	cliente?: string | null;
	total?: number;
	items?: ItemVentaBody[];
}

function validarPagos(pagos: PagoBody[]): PagoVentaDTO[] {
	return pagos
		.filter(
			(p): p is { metodo: MetodoCaja; monto: number } =>
				!!p.metodo &&
				METODOS_CAJA.includes(p.metodo as MetodoCaja) &&
				typeof p.monto === 'number' &&
				p.monto > 0
		)
		.map((p) => ({ metodo: p.metodo, monto: p.monto }));
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
	const pagos = validarPagos(body.pagos ?? []);

	if (
		(body.tipo !== 'boleta' && body.tipo !== 'nota_pedido') ||
		pagos.length === 0 ||
		typeof body.total !== 'number' ||
		items.length === 0
	) {
		error(400, 'Faltan datos requeridos: tipo, método(s) de pago, total y al menos un producto.');
	}

	const db = platform!.env.DB;
	const sesion = await obtenerSesionAbierta(db);
	if (!sesion) {
		error(400, 'Abre la caja antes de registrar una venta.');
	}

	const cajero = locals.user!;

	try {
		const venta = await guardarVenta(
			db,
			{
				tipo: body.tipo,
				pagos,
				numeroDocumento: body.numeroDocumento?.trim() || null,
				cliente: body.cliente?.trim() || null,
				total: body.total,
				items
			},
			sesion.id,
			{ id: cajero.id, nombre: cajero.nombre }
		);
		return json(venta, { status: 201 });
	} catch (err) {
		if (err instanceof VentaInvalidaError) error(409, err.message);
		throw err;
	}
};
