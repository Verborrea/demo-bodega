import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	actualizarProducto,
	crearMarcaSiNoExiste,
	crearCategoriaSiNoExiste,
	eliminarProducto,
	type PresentacionInput
} from '$lib/server/productos';

interface ActualizarProductoBody {
	nombre?: string;
	marca?: string;
	categoria?: string;
	codigoBarras?: string | null;
	presentaciones?: {
		id?: string;
		nombre: string;
		factorUnidades: number;
		precio: number;
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
			precio: Number(p.precio)
		}));
}

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
