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
import { listHistorialCaja } from '$lib/server/caja';

const TIPOS = ['productos', 'ganancia', 'stock', 'caja'] as const;
type TipoReporte = (typeof TIPOS)[number];

function esTipoValido(valor: string): valor is TipoReporte {
	return (TIPOS as readonly string[]).includes(valor);
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
		case 'productos': {
			const limite = Math.min(50, Math.max(1, Number(url.searchParams.get('limite')) || 20));
			const [masVendidos, menosVendidos] = await Promise.all([
				productosVentaRango(db, rango, 'desc', limite, categoriaId),
				productosVentaRango(db, rango, 'asc', limite, categoriaId)
			]);
			return json({ masVendidos, menosVendidos });
		}
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
			const [resumen, historial] = await Promise.all([
				resumenCajaRango(db, rango),
				listHistorialCaja(db, { page: 1, pageSize: 200, fechaInicio: desde, fechaFin: hasta })
			]);
			return json({ resumen, sesiones: historial.sesiones });
		}
	}
};
