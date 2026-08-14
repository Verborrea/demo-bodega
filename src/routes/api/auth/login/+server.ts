import { json, error } from '@sveltejs/kit';
import { SignJWT } from 'jose';
import type { RequestHandler } from './$types';
import { verificarCredenciales } from '$lib/server/auth';

interface LoginBody {
	usuario?: string;
	password?: string;
}

export const POST: RequestHandler = async ({ request, platform, cookies, url }) => {
	const body: LoginBody = await request.json();
	const usuario = body.usuario?.trim();
	const password = body.password;

	if (!usuario || !password) {
		error(400, 'Ingresa tu usuario y contraseña.');
	}

	const user = await verificarCredenciales(platform!.env.DB, usuario, password);
	if (!user) {
		error(401, 'Usuario o contraseña incorrectos.');
	}

	const secret = new TextEncoder().encode(platform!.env.JWT_SECRET);
	const token = await new SignJWT({
		usuario: user.usuario,
		nombre: user.nombre,
		rol: user.rol,
		esRoot: user.esRoot
	})
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(user.id)
		.setIssuedAt()
		.setExpirationTime('7d')
		.sign(secret);

	cookies.set('sesion', token, {
		path: '/',
		httpOnly: true,
		secure: url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 7
	});

	return json({ usuario: user.usuario, nombre: user.nombre, rol: user.rol });
};
