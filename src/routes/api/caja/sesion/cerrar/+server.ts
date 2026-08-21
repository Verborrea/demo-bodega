import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cerrarSesion } from '$lib/server/caja';

interface CerrarSesionBody {
	efectivo?: number;
	yape?: number;
	tarjeta?: number;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const body: CerrarSesionBody = await request.json();

	const efectivo = Math.max(0, Number(body.efectivo) || 0);
	const yape = Math.max(0, Number(body.yape) || 0);
	const tarjeta = Math.max(0, Number(body.tarjeta) || 0);

	try {
		await cerrarSesion(platform!.env.DB, { efectivo, yape, tarjeta });
		return json({ ok: true });
	} catch (err) {
		if (err instanceof Error) error(409, err.message);
		throw err;
	}
};
