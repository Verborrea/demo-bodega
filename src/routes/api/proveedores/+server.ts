import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listProveedores, crearProveedorSiNoExiste } from '$lib/server/pedidos';

export const GET: RequestHandler = async ({ platform }) => {
	const proveedores = await listProveedores(platform!.env.DB);
	return json(proveedores);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const body = (await request.json()) as { nombre?: string };
	const nombre = body.nombre?.trim();
	if (!nombre) error(400, 'Falta el nombre del proveedor.');

	const proveedor = await crearProveedorSiNoExiste(platform!.env.DB, nombre);
	return json(proveedor, { status: 201 });
};
