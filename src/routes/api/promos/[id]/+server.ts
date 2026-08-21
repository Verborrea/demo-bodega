import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eliminarPromo } from '$lib/server/promos';

export const DELETE: RequestHandler = async ({ params, platform }) => {
	await eliminarPromo(platform!.env.DB, params.id);
	return json({ ok: true });
};
