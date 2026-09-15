import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { obtenerProducto } from '$lib/server/productos';
import { kardexProducto } from '$lib/server/movimientos';
import { hoyLima } from '$lib/server/fecha';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = platform!.env.DB;

	const producto = await obtenerProducto(db, params.id);
	if (!producto) error(404, 'Producto no encontrado.');

	// Mismo rango por defecto que Reportes: el mes en curso.
	const hasta = hoyLima();
	const desde = `${hasta.slice(0, 8)}01`;
	const kardex = await kardexProducto(db, params.id, { desde, hasta });

	return { producto, kardex, desde, hasta };
};
