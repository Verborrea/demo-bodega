import { redirect, type Handle } from '@sveltejs/kit';
import { jwtVerify } from 'jose';

const COOKIE_SESION = 'sesion';
const RUTAS_API_PUBLICAS = ['/api/auth/login'];

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;

	const token = event.cookies.get(COOKIE_SESION);
	if (token) {
		try {
			const secret = new TextEncoder().encode(event.platform!.env.JWT_SECRET);
			const { payload } = await jwtVerify(token, secret);
			event.locals.user = {
				id: payload.sub as string,
				usuario: payload.usuario as string,
				nombre: payload.nombre as string,
				rol: payload.rol as string,
				esRoot: payload.esRoot as boolean
			};
		} catch {
			// Token ausente, vencido o inválido: seguimos como no autenticado sin tocar la BD.
			event.locals.user = null;
		}
	}

	const path = event.url.pathname;
	const metodo = event.request.method;
	const esRutaPagina = path.startsWith('/dashboard');
	const esRutaApiProtegida = path.startsWith('/api/') && !RUTAS_API_PUBLICAS.includes(path);

	// Cajeros solo ven Dashboard, Ventas, Pedidos y Nueva Venta. Inventario, Usuarios,
	// Historial de Caja y Reportes quedan solo para admin.
	const esPaginaSoloAdmin =
		path.startsWith('/dashboard/usuarios') ||
		path.startsWith('/dashboard/productos') ||
		path.startsWith('/dashboard/caja') ||
		path.startsWith('/dashboard/reportes');

	// A nivel de API se protege lo mismo, más fino por método: /api/productos (listar/crear)
	// se deja abierto porque Venta y Pedidos lo usan para buscar y para dar de alta productos
	// nuevos, ambas pantallas accesibles para cajeros; solo se bloquea editar/eliminar un
	// producto puntual y ajustar stock por presentación (acciones que solo existen en
	// Inventario). /api/recargo-precio (GET, /[id]/activar, /[id]/desactivar) queda abierto
	// a cualquier rol a propósito: la cajera prende/apaga cada regla de recargo (cada una
	// independiente, ej. nocturno vs. feriado) durante su turno; solo agregar (POST en la
	// ruta exacta) o quitar (DELETE) una regla es exclusivo de la administradora.
	const esApiSoloAdmin =
		path.startsWith('/api/usuarios') ||
		path.startsWith('/api/caja/historial') ||
		path.startsWith('/api/presentaciones') ||
		path.startsWith('/api/reportes') ||
		(path === '/api/recargo-precio' && metodo === 'POST') ||
		(path.startsWith('/api/recargo-precio/') && metodo === 'DELETE') ||
		(path.startsWith('/api/productos/') && metodo !== 'GET') ||
		(path.startsWith('/api/promos') && metodo !== 'GET');

	const esRutaSoloAdmin = esPaginaSoloAdmin || esApiSoloAdmin;

	if (!event.locals.user) {
		if (esRutaApiProtegida) {
			return new Response(JSON.stringify({ message: 'No autenticado' }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			});
		}
		if (esRutaPagina) {
			redirect(303, '/');
		}
	} else if (path === '/') {
		redirect(303, '/dashboard');
	} else if (esRutaSoloAdmin && event.locals.user.rol !== 'admin') {
		if (path.startsWith('/api/')) {
			return new Response(JSON.stringify({ message: 'No autorizado' }), {
				status: 403,
				headers: { 'content-type': 'application/json' }
			});
		}
		redirect(303, '/dashboard');
	}

	return resolve(event);
};
