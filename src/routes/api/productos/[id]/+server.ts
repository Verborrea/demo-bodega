import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	actualizarProducto,
	crearProveedorSiNoExiste,
	crearCategoriaSiNoExiste,
	eliminarProducto
} from '$lib/server/productos';

interface ActualizarProductoBody {
	nombre?: string;
	proveedor?: string;
	categoria?: string;
	cantidad?: number;
	codigoBarras?: string | null;
	precios?: { nombre: string; valor: number }[];
}

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	const body: ActualizarProductoBody = await request.json();

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

	await actualizarProducto(db, params.id, {
		nombre,
		proveedorId: proveedor.id,
		categoriaId: categoria.id,
		cantidad: Math.max(0, Number(body.cantidad) || 0),
		codigoBarras,
		precios: precios.map((p) => ({ nombre: p.nombre.trim(), valor: Number(p.valor) }))
	});

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	await eliminarProducto(platform!.env.DB, params.id);
	return json({ ok: true });
};
