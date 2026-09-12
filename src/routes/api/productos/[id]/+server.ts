import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	actualizarProducto,
	crearMarcaSiNoExiste,
	crearCategoriaSiNoExiste,
	eliminarProducto,
	obtenerProducto,
	type PresentacionInput
} from '$lib/server/productos';

interface ActualizarProductoBody {
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
		cantidad?: number;
	}[];
}

function validarPresentaciones(
	presentaciones: ActualizarProductoBody['presentaciones']
): PresentacionInput[] {
	return (presentaciones ?? [])
		.filter((p) => p.nombre?.trim() && p.factorUnidades >= 1 && p.precio >= 0)
		.map((p) => ({
			id: p.id,
			nombre: p.nombre.trim(),
			factorUnidades: Math.floor(Number(p.factorUnidades)),
			precio: Number(p.precio),
			cantidad:
				p.cantidad !== undefined ? Math.max(0, Math.floor(Number(p.cantidad)) || 0) : undefined
		}));
}

// Lo usa el diálogo "Editar promo": de la promo guardada solo vuelve la presentación
// elegida, y el <select> necesita todas las del producto para poder cambiarla.
export const GET: RequestHandler = async ({ params, platform }) => {
	const producto = await obtenerProducto(platform!.env.DB, params.id);
	if (!producto) error(404, 'El producto ya no existe.');
	return json(producto);
};

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	const body: ActualizarProductoBody = await request.json();

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
		await actualizarProducto(db, params.id, {
			nombre,
			marcaId: marca?.id ?? null,
			categoriaId: categoria.id,
			codigoBarras,
			costoUltimo:
				typeof body.costoUltimo === 'number' && body.costoUltimo >= 0 ? body.costoUltimo : null,
			presentaciones
		});
		return json({ ok: true });
	} catch (err) {
		if (err instanceof Error) error(400, err.message);
		throw err;
	}
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	await eliminarProducto(platform!.env.DB, params.id);
	return json({ ok: true });
};
