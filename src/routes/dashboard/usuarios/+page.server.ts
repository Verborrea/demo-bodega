import type { PageServerLoad } from './$types';
import { listUsuarios } from '$lib/server/usuarios';

export const load: PageServerLoad = async ({ platform }) => {
	const usuarios = await listUsuarios(platform!.env.DB);
	return { usuarios };
};
