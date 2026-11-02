import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { consultarDni, DniInvalidoError, DniNoEncontradoError } from '$lib/server/dni';

export const GET: RequestHandler = async ({ params, platform }) => {
	const token = platform!.env.FACTILIZA_TOKEN;
	if (!token) error(503, 'Consulta de DNI no configurada (falta FACTILIZA_TOKEN).');
	try {
		return json(await consultarDni(params.numero, token));
	} catch (err) {
		if (err instanceof DniInvalidoError) error(400, err.message);
		if (err instanceof DniNoEncontradoError) error(404, err.message);
		console.error('RENIEC: fallo al consultar DNI', err);
		error(502, 'No se pudo consultar RENIEC.');
	}
};
