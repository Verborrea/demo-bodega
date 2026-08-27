import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { desactivarReglaRecargo } from '$lib/server/recargos';

// Sin restricción de rol propia (ver hooks.server.ts): cualquiera que esté en turno puede
// apagar cualquier regla, no solo quien la prendió.
export const POST: RequestHandler = async ({ params, platform }) => {
	const regla = await desactivarReglaRecargo(platform!.env.DB, params.id);
	return json(regla);
};
