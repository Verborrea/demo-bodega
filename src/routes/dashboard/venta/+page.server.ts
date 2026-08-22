import type { PageServerLoad } from './$types';
import { listPromos } from '$lib/server/promos';

export const load: PageServerLoad = async ({ platform, depends }) => {
	depends('productos:stock');
	const promos = await listPromos(platform!.env.DB);
	return { promos };
};
