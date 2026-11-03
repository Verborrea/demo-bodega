import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reporteGanancia, reporteStock, resumenCajaRango } from '$lib/server/reportes';
import { listHistorialCaja, type SesionCajaDTO } from '$lib/server/caja';
import { diaDeIso, hoyLima } from '$lib/server/fecha';

const TIPOS = ['ganancia', 'stock', 'caja'] as const;
type TipoReporte = (typeof TIPOS)[number];

function esTipoValido(valor: string): valor is TipoReporte {
	return (TIPOS as readonly string[]).includes(valor);
}

// listHistorialCaja pagina internamente — pedirle un pageSize fijo de 200 se recortaba
// en silencio si había más sesiones que eso en el rango (fácil de superar en un rango
// largo, ej. "todo el año"). Acá se pagina hasta juntarlas todas; al ser una llamada
// interna servidor-a-servidor (no HTTP expuesto a un cliente) no hace falta el mismo
// tope de seguridad que sí tiene /api/caja/historial.
const TAMANO_PAGINA_CAJA = 200;

async function obtenerTodasLasSesiones(
	db: D1Database,
	fechaInicio: string,
	fechaFin: string
): Promise<SesionCajaDTO[]> {
	const todas: SesionCajaDTO[] = [];
	let pagina = 1;
	for (;;) {
		const resultado = await listHistorialCaja(db, {
			page: pagina,
			pageSize: TAMANO_PAGINA_CAJA,
			fechaInicio,
			fechaFin
		});
		todas.push(...resultado.sesiones);
		if (todas.length >= resultado.total || resultado.sesiones.length < TAMANO_PAGINA_CAJA) break;
		pagina++;
	}
	return todas;
}

export const GET: RequestHandler = async ({ params, url, platform }) => {
	if (!esTipoValido(params.tipo)) error(404, 'Reporte no encontrado.');

	const db = platform!.env.DB;
	// Días de calendario de Lima ('YYYY-MM-DD'); un valor ausente o inválido cae en "hoy".
	const hoy = hoyLima();
	const desde = diaDeIso(url.searchParams.get('desde') ?? '') ?? hoy;
	const hasta = diaDeIso(url.searchParams.get('hasta') ?? '') ?? hoy;
	const rango = { desde, hasta };
	const categoriaId = url.searchParams.get('categoriaId') || undefined;

	switch (params.tipo) {
		case 'ganancia':
			// Una sola pasada por el catálogo y las ventas del rango (ver reporteGanancia).
			return json(await reporteGanancia(db, rango, categoriaId));
		case 'stock':
			// Agotados (cantidad <= 0, con los negativos incluidos) y disponibles juntos, de una
			// sola lectura del catálogo.
			return json(await reporteStock(db));
		case 'caja': {
			const [resumen, sesiones] = await Promise.all([
				resumenCajaRango(db, rango),
				obtenerTodasLasSesiones(db, desde, hasta)
			]);
			return json({ resumen, sesiones });
		}
	}
};
