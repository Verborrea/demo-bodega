import type { PageServerLoad } from './$types';
import { listVentas } from '$lib/server/ventas';

export const load: PageServerLoad = async ({ platform }) => {
	const ventas = await listVentas(platform!.env.DB);
	return { ventas };
};
