import type { PageServerLoad } from './$types';
import { listMarcasConConteo } from '$lib/server/productos';

export const load: PageServerLoad = async ({ platform }) => {
	const marcas = await listMarcasConConteo(platform!.env.DB);
	return { marcas };
};
