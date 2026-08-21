import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listMarcas, crearMarcaSiNoExiste } from '$lib/server/productos';

export const GET: RequestHandler = async ({ platform }) => {
	const marcas = await listMarcas(platform!.env.DB);
	return json(marcas);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const body = (await request.json()) as { nombre?: string };
	const nombre = body.nombre?.trim();
	if (!nombre) error(400, 'Falta el nombre de la marca.');

	const marca = await crearMarcaSiNoExiste(platform!.env.DB, nombre);
	return json(marca, { status: 201 });
};
