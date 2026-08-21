import type { LayoutServerLoad } from './$types';
import { obtenerSesionAbierta } from '$lib/server/caja';

export const load: LayoutServerLoad = async ({ locals, platform, depends }) => {
	depends('caja:sesion');
	const sesionActual = await obtenerSesionAbierta(platform!.env.DB);
	return { user: locals.user, sesionActual };
};
