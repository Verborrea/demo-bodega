import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	listProductos,
	crearProducto,
	crearMarcaSiNoExiste,
	crearCategoriaSiNoExiste,
	obtenerProducto,
	type PresentacionInput
} from '$lib/server/productos';

export const GET: RequestHandler = async ({ url, platform }) => {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 25));
	const search = url.searchParams.get('search') ?? '';
	const categoriaId = url.searchParams.get('categoriaId') ?? '';
	const marcaId = url.searchParams.get('marcaId') ?? '';

	const resultado = await listProductos(platform!.env.DB, {
		page,
		pageSize,
		search,
		categoriaId,
		marcaId
	});

	return json(resultado);
};

interface CrearProductoBody {
	nombre?: string;
	marca?: string;
	categoria?: string;
	codigoBarras?: string | null;
	presentaciones?: {
		id?: string;
		nombre: string;
		factorUnidades: number;
		precio: number;
		cantidadInicial?: number;
	}[];
}

function validarPresentaciones(presentaciones: CrearProductoBody['presentaciones']): PresentacionInput[] {
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
			presentaciones
		});
		const producto = await obtenerProducto(db, id);
		return json(producto, { status: 201 });
	} catch (err) {
		if (err instanceof Error) error(400, err.message);
		throw err;
	}
};
