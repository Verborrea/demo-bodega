import type { LayoutServerLoad } from './$types';
import { obtenerSesionAbierta } from '$lib/server/caja';
import { listReglasRecargo } from '$lib/server/recargos';

export const load: LayoutServerLoad = async ({ locals, platform, depends }) => {
	depends('caja:sesion');
	depends('recargo:precio');
	const db = platform!.env.DB;
	const [sesionActual, reglasRecargo] = await Promise.all([
		obtenerSesionAbierta(db),
		listReglasRecargo(db)
	]);
	return { user: locals.user, sesionActual, reglasRecargo };
};
