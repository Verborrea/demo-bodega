import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	listProductos,
	crearProducto,
	crearMarcaSiNoExiste,
	crearCategoriaSiNoExiste,
	obtenerProducto,
	type PresentacionInput,
	type OrdenProducto
} from '$lib/server/productos';
import { conCacheDeBorde } from '$lib/server/cache';

const ORDENES_VALIDOS: OrdenProducto[] = ['nombre', 'categoria', 'cantidad', 'costo'];

export const GET: RequestHandler = async ({ url, platform, request }) => {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 25));
	const search = url.searchParams.get('search') ?? '';
	const categoriaId = url.searchParams.get('categoriaId') ?? '';
	const marcaId = url.searchParams.get('marcaId') ?? '';
	const orderByParam = url.searchParams.get('orderBy');
	const orderBy = ORDENES_VALIDOS.includes(orderByParam as OrdenProducto)
		? (orderByParam as OrdenProducto)
		: undefined;
	const orderDir = url.searchParams.get('orderDir') === 'desc' ? 'desc' : 'asc';

	// Este endpoint lo golpea el buscador de cada venta/pedido/promo — el tráfico más alto
	// de la app — así que un TTL corto ya recorta muchísimas lecturas a D1 sin notarse.
	return conCacheDeBorde(request, platform, 15, async () => {
		const resultado = await listProductos(platform!.env.DB, {
			page,
			pageSize,
			search,
			categoriaId,
			marcaId,
			orderBy,
			orderDir
		});
		return json(resultado);
	});
};

interface CrearProductoBody {
	nombre?: string;
	marca?: string;
	categoria?: string;
	codigoBarras?: string | null;
	costoUltimo?: number | null;
	presentaciones?: {
		id?: string;
		nombre: string;
		factorUnidades: number;
		precio: number;
		cantidadInicial?: number;
	}[];
}

function validarPresentaciones(
	presentaciones: CrearProductoBody['presentaciones']
): PresentacionInput[] {
	return (presentaciones ?? [])
		.filter((p) => p.nombre?.trim() && p.factorUnidades >= 1 && p.precio >= 0)
		.map((p) => ({
			id: p.id,
			nombre: p.nombre.trim(),
			factorUnidades: Math.floor(Number(p.factorUnidades)),
			precio: Number(p.precio),
			cantidadInicial: Math.max(0, Math.floor(Number(p.cantidadInicial) || 0))
		}));
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const body: CrearProductoBody = await request.json();

	const nombre = body.nombre?.trim();
	const categoriaNombre = body.categoria?.trim();
	const marcaNombre = body.marca?.trim();
	const presentaciones = validarPresentaciones(body.presentaciones);

	if (!nombre || !categoriaNombre || presentaciones.length === 0) {
		error(400, 'Faltan datos requeridos: nombre, categoría y al menos una presentación.');
	}
	if (!presentaciones.some((p) => p.factorUnidades === 1)) {
		error(400, 'Debe existir una presentación base con factor 1 (ej. "Unidad").');
	}

	const db = platform!.env.DB;
	const codigoBarras = body.codigoBarras?.trim() || null;

	const [marca, categoria] = await Promise.all([
		marcaNombre ? crearMarcaSiNoExiste(db, marcaNombre) : Promise.resolve(null),
		crearCategoriaSiNoExiste(db, categoriaNombre)
	]);

	try {
		const id = await crearProducto(db, {
			nombre,
			marcaId: marca?.id ?? null,
			categoriaId: categoria.id,
			codigoBarras,
			costoUltimo:
				typeof body.costoUltimo === 'number' && body.costoUltimo >= 0 ? body.costoUltimo : null,
			presentaciones
		});
		const producto = await obtenerProducto(db, id);
		return json(producto, { status: 201 });
	} catch (err) {
		if (err instanceof Error) error(400, err.message);
		throw err;
	}
};
