import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listUsuarios, crearUsuario, ROLES } from '$lib/server/usuarios';

export const GET: RequestHandler = async ({ platform }) => {
	const usuarios = await listUsuarios(platform!.env.DB);
	return json({ usuarios });
};

interface CrearUsuarioBody {
	usuario?: string;
	nombre?: string;
	rol?: string;
	password?: string;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const body: CrearUsuarioBody = await request.json();

	const usuario = body.usuario?.trim();
	const nombre = body.nombre?.trim();
	const rol = body.rol;
	const password = body.password;

	if (!usuario || !nombre || !password) {
		error(400, 'Ingresa usuario, nombre y contraseña.');
	}
	if (password.length < 8) {
		error(400, 'La contraseña debe tener al menos 8 caracteres.');
	}
	if (!rol || !ROLES.includes(rol as (typeof ROLES)[number])) {
		error(400, 'Rol inválido.');
	}

	try {
		const id = await crearUsuario(platform!.env.DB, {
			usuario,
			nombre,
			rol: rol as (typeof ROLES)[number],
			password
		});
		return json({ id }, { status: 201 });
	} catch (err) {
		if (err instanceof Error && err.message.includes('UNIQUE')) {
			error(409, 'Ese nombre de usuario ya existe.');
		}
		throw err;
	}
};
