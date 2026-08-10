import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	listProductos,
	crearProducto,
	crearProveedorSiNoExiste,
	crearCategoriaSiNoExiste
} from '$lib/server/productos';

export const GET: RequestHandler = async ({ url, platform }) => {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 25));
	const search = url.searchParams.get('search') ?? '';
	const categoriaId = url.searchParams.get('categoriaId') ?? '';
	const proveedorId = url.searchParams.get('proveedorId') ?? '';

	const resultado = await listProductos(platform!.env.DB, {
		page,
		pageSize,
		search,
		categoriaId,
		proveedorId
	});

	return json(resultado);
};

interface CrearProductoBody {
	nombre?: string;
	proveedor?: string;
	categoria?: string;
	cantidad?: number;
	codigoBarras?: string | null;
	precios?: { nombre: string; valor: number }[];
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const body: CrearProductoBody = await request.json();

	const nombre = body.nombre?.trim();
	const proveedorNombre = body.proveedor?.trim();
	const categoriaNombre = body.categoria?.trim();
	const precios = (body.precios ?? []).filter((p) => p.nombre?.trim() && p.valor >= 0);

	if (!nombre || !proveedorNombre || !categoriaNombre || precios.length === 0) {
		error(400, 'Faltan datos requeridos: nombre, proveedor, categoría y al menos un precio.');
	}

	const db = platform!.env.DB;
	const codigoBarras = body.codigoBarras?.trim() || null;

	const [proveedor, categoria] = await Promise.all([
		crearProveedorSiNoExiste(db, proveedorNombre),
		crearCategoriaSiNoExiste(db, categoriaNombre)
	]);

	const id = await crearProducto(db, {
		nombre,
		proveedorId: proveedor.id,
		categoriaId: categoria.id,
		cantidad: Math.max(0, Number(body.cantidad) || 0),
		codigoBarras,
		precios: precios.map((p) => ({ nombre: p.nombre.trim(), valor: Number(p.valor) }))
	});

	return json({ id, proveedor, categoria }, { status: 201 });
};
