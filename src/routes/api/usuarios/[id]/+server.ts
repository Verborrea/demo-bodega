import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { actualizarUsuario, eliminarUsuario, ROLES } from '$lib/server/usuarios';

interface ActualizarUsuarioBody {
	usuario?: string;
	nombre?: string;
	rol?: string;
	activo?: boolean;
	password?: string;
}

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	const body: ActualizarUsuarioBody = await request.json();

	const usuario = body.usuario?.trim();
	const nombre = body.nombre?.trim();
	const rol = body.rol;

	if (!usuario || !nombre) {
		error(400, 'Ingresa usuario y nombre.');
	}
	if (!rol || !ROLES.includes(rol as (typeof ROLES)[number])) {
		error(400, 'Rol inválido.');
	}
	if (body.password && body.password.length < 8) {
		error(400, 'La contraseña debe tener al menos 8 caracteres.');
	}

	try {
		await actualizarUsuario(platform!.env.DB, params.id, {
			usuario,
			nombre,
			rol: rol as (typeof ROLES)[number],
			activo: Boolean(body.activo),
			password: body.password || undefined
		});
		return json({ ok: true });
	} catch (err) {
		if (err instanceof Error && err.message.includes('UNIQUE')) {
			error(409, 'Ese nombre de usuario ya existe.');
		}
		throw err;
	}
};

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	if (params.id === locals.user!.id) {
		error(400, 'No puedes eliminar tu propio usuario.');
	}
	try {
		await eliminarUsuario(platform!.env.DB, params.id);
		return json({ ok: true });
	} catch (err) {
		if (err instanceof Error && err.message.includes('root')) {
			error(400, err.message);
		}
		throw err;
	}
};
