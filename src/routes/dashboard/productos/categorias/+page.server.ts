import type { PageServerLoad } from './$types';
import { listCategoriasConConteo } from '$lib/server/productos';

export const load: PageServerLoad = async ({ platform }) => {
	const categorias = await listCategoriasConConteo(platform!.env.DB);
	return { categorias };
};
