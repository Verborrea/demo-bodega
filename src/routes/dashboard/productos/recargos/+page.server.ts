import type { PageServerLoad } from './$types';
import { listCategorias } from '$lib/server/productos';
import { listReglasRecargo } from '$lib/server/recargos';

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform!.env.DB;
	const [reglas, categorias] = await Promise.all([listReglasRecargo(db), listCategorias(db)]);
	return { reglas, categorias };
};
