import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { registrarMovimiento, METODOS_CAJA, type MetodoCaja } from '$lib/server/caja';

interface RegistrarMovimientoBody {
	tipo?: 'ingreso' | 'egreso';
	metodo?: string;
	monto?: number;
	descripcion?: string;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const body: RegistrarMovimientoBody = await request.json();

	if (body.tipo !== 'ingreso' && body.tipo !== 'egreso') {
		error(400, 'Tipo de movimiento inválido.');
	}
	if (!body.metodo || !METODOS_CAJA.includes(body.metodo as MetodoCaja)) {
		error(400, 'Método de pago inválido.');
	}
	const monto = Number(body.monto);
	if (!monto || monto <= 0) {
		error(400, 'Ingresa un monto válido.');
	}

	try {
		await registrarMovimiento(platform!.env.DB, {
			tipo: body.tipo,
			metodo: body.metodo as MetodoCaja,
			monto,
			descripcion:
				body.descripcion?.trim() || (body.tipo === 'ingreso' ? 'Ingreso extra' : 'Egreso extra')
		});
		return json({ ok: true }, { status: 201 });
	} catch (err) {
		if (err instanceof Error) error(409, err.message);
		throw err;
	}
};
