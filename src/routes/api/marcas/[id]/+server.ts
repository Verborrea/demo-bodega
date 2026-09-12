import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { actualizarMarca, eliminarMarca } from '$lib/server/productos';

interface ActualizarMarcaBody {
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
	const body = (await request.json()) as ActualizarMarcaBody;
	const nombre = body.nombre?.trim();
	if (body.nombre !== undefined && !nombre) error(400, 'Falta el nombre de la marca.');

	try {
		const marca = await actualizarMarca(platform!.env.DB, params.id, {
			nombre,
			productosQuitados: soloIds(body.productosQuitados),
			productosAgregados: soloIds(body.productosAgregados)
		});
		return json(marca);
	} catch (e) {
		const codigo = e instanceof Error ? e.message : '';
		if (codigo === 'MARCA_NO_EXISTE') error(404, 'La marca ya no existe.');
		if (codigo === 'MARCA_DUPLICADA') error(409, 'Ya existe otra marca con ese nombre.');
		throw e;
	}
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	await eliminarMarca(platform!.env.DB, params.id);
	return json({ ok: true });
};
