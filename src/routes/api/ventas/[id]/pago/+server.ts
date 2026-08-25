import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { corregirPagoVenta, VentaInvalidaError, type PagoVentaDTO } from '$lib/server/ventas';
import { METODOS_CAJA, type MetodoCaja } from '$lib/server/caja';

interface PagoBody {
	metodo?: string;
	monto?: number;
}

function validarPagos(pagos: PagoBody[]): PagoVentaDTO[] {
	return pagos
		.filter(
			(p): p is { metodo: MetodoCaja; monto: number } =>
				!!p.metodo &&
				METODOS_CAJA.includes(p.metodo as MetodoCaja) &&
				typeof p.monto === 'number' &&
				p.monto > 0
		)
		.map((p) => ({ metodo: p.metodo, monto: p.monto }));
}

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	const body = (await request.json()) as { pagos?: PagoBody[] };
	const pagos = validarPagos(body.pagos ?? []);

	if (pagos.length === 0) {
		error(400, 'Debes indicar al menos un método de pago con un monto válido.');
	}

	try {
		await corregirPagoVenta(platform!.env.DB, params.id, pagos);
		return json({ ok: true });
	} catch (err) {
		if (err instanceof VentaInvalidaError) error(409, err.message);
		throw err;
	}
};
