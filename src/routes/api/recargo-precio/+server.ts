import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listReglasRecargo, agregarReglaRecargo, RecargoInvalidoError, type ModoRecargo } from '$lib/server/recargos';

export const GET: RequestHandler = async ({ platform }) => {
	const reglas = await listReglasRecargo(platform!.env.DB);
	return json(reglas);
};

interface Body {
	nombre: string;
	categoriaIds: string[];
	monto: number;
	modo: ModoRecargo;
}

// Solo admin (ver hooks.server.ts): la cajera puede activar/desactivar cada regla pero no
// agregar ni quitar el nombre, las categorías o el monto.
export const POST: RequestHandler = async ({ request, platform }) => {
	const body = (await request.json()) as Partial<Body>;
	const monto = Number(body.monto);
	if (!Number.isFinite(monto)) error(400, 'Ingresa un monto válido.');
	if (body.modo !== 'soles' && body.modo !== 'porcentaje') error(400, 'Modo inválido.');
	if (typeof body.nombre !== 'string') error(400, 'Falta el nombre del recargo.');

	try {
		const regla = await agregarReglaRecargo(platform!.env.DB, {
			nombre: body.nombre,
			categoriaIds: Array.isArray(body.categoriaIds) ? body.categoriaIds : [],
			monto,
			modo: body.modo
		});
		return json(regla, { status: 201 });
	} catch (err) {
		if (err instanceof RecargoInvalidoError) error(400, err.message);
		throw err;
	}
};
