import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eliminarReglaRecargo } from '$lib/server/recargos';

// Solo admin (ver hooks.server.ts).
export const DELETE: RequestHandler = async ({ params, platform }) => {
	await eliminarReglaRecargo(platform!.env.DB, params.id);
	return json({ ok: true });
};
