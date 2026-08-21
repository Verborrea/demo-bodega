import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { abrirSesion } from '$lib/server/caja';

interface AbrirSesionBody {
	efectivo?: number;
	yape?: number;
	tarjeta?: number;
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const body: AbrirSesionBody = await request.json();

	const efectivo = Math.max(0, Number(body.efectivo) || 0);
	const yape = Math.max(0, Number(body.yape) || 0);
	const tarjeta = Math.max(0, Number(body.tarjeta) || 0);

	if (efectivo === 0 && yape === 0 && tarjeta === 0) {
		error(400, 'Ingresa al menos un monto inicial.');
	}

	const cajero = locals.user!;

	try {
		const id = await abrirSesion(
			platform!.env.DB,
			{ efectivo, yape, tarjeta },
			{ id: cajero.id, nombre: cajero.nombre }
		);
		return json({ id }, { status: 201 });
	} catch (err) {
		if (err instanceof Error) error(409, err.message);
		throw err;
	}
};
