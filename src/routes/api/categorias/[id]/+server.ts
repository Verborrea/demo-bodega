import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { actualizarCategoria, eliminarCategoria } from '$lib/server/productos';

interface ActualizarCategoriaBody {
	nombre?: string;
	productosQuitados?: string[];
	productosAgregados?: string[];
}

function soloIds(valor: unknown): string[] {
	return Array.isArray(valor)
		? valor.filter((id): id is string => typeof id === 'string' && id.length > 0)
		: [];
}

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	const body = (await request.json()) as ActualizarCategoriaBody;
	const nombre = body.nombre?.trim();
	if (body.nombre !== undefined && !nombre) error(400, 'Falta el nombre de la categoría.');

	try {
		const categoria = await actualizarCategoria(platform!.env.DB, params.id, {
			nombre,
			productosQuitados: soloIds(body.productosQuitados),
			productosAgregados: soloIds(body.productosAgregados)
		});
		return json(categoria);
	} catch (e) {
		const codigo = e instanceof Error ? e.message : '';
		if (codigo === 'CATEGORIA_NO_EXISTE') error(404, 'La categoría ya no existe.');
		if (codigo === 'CATEGORIA_DUPLICADA') error(409, 'Ya existe otra categoría con ese nombre.');
		throw e;
	}
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	// `modosEliminados` deja avisar en el toast cuántas reglas de recargo se fueron con la
	// categoría (las que aplicaban solo a ella).
	const { modosEliminados } = await eliminarCategoria(platform!.env.DB, params.id);
	return json({ ok: true, modosEliminados });
};
