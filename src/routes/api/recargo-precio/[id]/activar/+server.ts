import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { activarReglaRecargo, RecargoInvalidoError } from '$lib/server/recargos';
import { obtenerSesionAbierta } from '$lib/server/caja';

// Sin restricción de rol propia (ver hooks.server.ts): cajera o admin pueden prender
// cualquier regla durante su turno — cada una es independiente (ej. nocturno vs. feriado),
// usando la config que ya haya dejado la admin.
export const POST: RequestHandler = async ({ params, platform, locals }) => {
	const db = platform!.env.DB;
	const sesion = await obtenerSesionAbierta(db);
	try {
		const regla = await activarReglaRecargo(db, params.id, locals.user!.nombre, sesion?.id ?? null);
		return json(regla);
	} catch (err) {
		if (err instanceof RecargoInvalidoError) error(400, err.message);
		throw err;
	}
};
