import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listMarcas, listMarcasConConteo, crearMarcaSiNoExiste } from '$lib/server/productos';

export const GET: RequestHandler = async ({ url, platform }) => {
	// La pantalla de Marcas necesita además cuántos productos tiene cada una; el resto de
	// la app (selects, formulario de producto) solo quiere id + nombre.
	const marcas = url.searchParams.has('conConteo')
		? await listMarcasConConteo(platform!.env.DB)
		: await listMarcas(platform!.env.DB);
	return json(marcas);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const body = (await request.json()) as { nombre?: string };
	const nombre = body.nombre?.trim();
	if (!nombre) error(400, 'Falta el nombre de la marca.');

	const marca = await crearMarcaSiNoExiste(platform!.env.DB, nombre);
	return json(marca, { status: 201 });
};
