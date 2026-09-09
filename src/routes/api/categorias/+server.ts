import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	listCategorias,
	listCategoriasConConteo,
	crearCategoriaSiNoExiste
} from '$lib/server/productos';

export const GET: RequestHandler = async ({ url, platform }) => {
	// La pantalla de Categorías necesita además cuántos productos tiene cada una; el resto
	// de la app (selects, formulario de producto) solo quiere id + nombre.
	const categorias = url.searchParams.has('conConteo')
		? await listCategoriasConConteo(platform!.env.DB)
		: await listCategorias(platform!.env.DB);
	return json(categorias);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const body = (await request.json()) as { nombre?: string };
	const nombre = body.nombre?.trim();
	if (!nombre) error(400, 'Falta el nombre de la categoría.');

	const categoria = await crearCategoriaSiNoExiste(platform!.env.DB, nombre);
	return json(categoria, { status: 201 });
};
