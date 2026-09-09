import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	productosVentaRango,
	margenProductos,
	categoriasRentabilidad,
	productosSinStock,
	productosDisponibles,
	resumenCajaRango
} from '$lib/server/reportes';
import { listHistorialCaja, type SesionCajaDTO } from '$lib/server/caja';

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
	const hoy = new Date().toISOString().slice(0, 10);
	const desde = url.searchParams.get('desde') || hoy;
	const hasta = url.searchParams.get('hasta') || hoy;
	const rango = { desde, hasta };
	const categoriaId = url.searchParams.get('categoriaId') || undefined;

	switch (params.tipo) {
		case 'ganancia': {
			// masVendido/menosVendido SIEMPRE globales (sin categoriaId) — mismo criterio que
			// las tarjetas de categoriasRentabilidad: reflejan todo el catálogo, independiente
			// del filtro de categoría que se le aplique a la tabla de detalle de abajo.
			const [productos, categorias, masVendido, menosVendido] = await Promise.all([
				margenProductos(db, rango, categoriaId),
				categoriasRentabilidad(db, rango),
				productosVentaRango(db, rango, 'desc', 1),
				productosVentaRango(db, rango, 'asc', 1)
			]);
			return json({
				productos,
				categorias,
				productoMasVendido: masVendido[0] ?? null,
				productoMenosVendido: menosVendido[0] ?? null
			});
		}
		case 'stock': {
			// productosSinStock ya trae cantidad <= 0 — agotados (0) y negativos (se vendió más
			// de lo que había) juntos bajo un solo estado "Agotado", sin distinguirlos.
			const [agotados, disponibles] = await Promise.all([
				productosSinStock(db),
				productosDisponibles(db)
			]);
			return json({ agotados, disponibles });
		}
		case 'caja': {
			const [resumen, sesiones] = await Promise.all([
				resumenCajaRango(db, rango),
				obtenerTodasLasSesiones(db, desde, hasta)
			]);
			return json({ resumen, sesiones });
		}
	}
};
