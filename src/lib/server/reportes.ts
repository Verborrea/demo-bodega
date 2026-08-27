import { calcularGanancia } from '$lib/utils';
import { OFFSET_LIMA } from './fecha';

export interface RangoFechas {
	desde: string; // 'YYYY-MM-DD', ya en términos de calendario Lima
	hasta: string; // 'YYYY-MM-DD'
}

// date(columna, OFFSET_LIMA) convierte la columna UTC a fecha-calendario Lima antes de
// compararla contra el rango elegido (que ya viene en términos Lima desde el date picker).
function condicionFechaLocal(columna: string): string {
	return `date(${columna}, '${OFFSET_LIMA}') >= date(?) AND date(${columna}, '${OFFSET_LIMA}') <= date(?)`;
}

export interface ProductoVentaRango {
	productoId: string;
	nombre: string;
	categoria: string | null;
	cantidadVendida: number;
	totalVendido: number;
}

/**
 * Ranking de productos por cantidad vendida en el rango. LEFT JOIN desde productos (no
 * INNER desde venta_items) para que 'asc' también muestre productos con cero ventas en
 * el rango — es justamente la señal útil de "menos vendidos".
 */
export async function productosVentaRango(
	db: D1Database,
	rango: RangoFechas,
	orden: 'asc' | 'desc',
	limite = 20,
	categoriaId?: string
): Promise<ProductoVentaRango[]> {
	const condFecha = `${condicionFechaLocal('v.fecha')} AND v.estado = 'activa'`;
	const direccion = orden === 'asc' ? 'ASC' : 'DESC';
	const condCategoria = categoriaId ? 'AND p.categoria_id = ?' : '';
	const binds: (string | number)[] = [rango.desde, rango.hasta];
	if (categoriaId) binds.push(categoriaId);
	binds.push(limite);

	const result = await db
		.prepare(
			`SELECT p.id AS productoId, p.nombre, cat.nombre AS categoria,
				COALESCE(SUM(vi.cantidad), 0) AS cantidadVendida,
				COALESCE(SUM(vi.subtotal), 0) AS totalVendido
			 FROM productos p
			 LEFT JOIN categorias cat ON cat.id = p.categoria_id
			 LEFT JOIN venta_items vi ON vi.producto_id = p.id
				AND vi.venta_id IN (SELECT v.id FROM ventas v WHERE ${condFecha})
			 WHERE 1=1 ${condCategoria}
			 GROUP BY p.id, p.nombre, cat.nombre
			 ORDER BY cantidadVendida ${direccion}, p.nombre ASC
			 LIMIT ?`
		)
		.bind(...binds)
		.all<ProductoVentaRango>();
	return result.results;
}

export interface ProductoMargen {
	productoId: string;
	nombre: string;
	categoria: string | null;
	costoUltimo: number | null;
	precioBase: number | null;
	margenMonto: number | null;
	margenPorcentaje: number | null;
	cantidadVendidaRango: number;
	gananciaEstimadaRango: number | null;
}

interface MargenProductoBase {
	productoId: string;
	nombre: string;
	categoria: string | null;
	costoUltimo: number | null;
	precioBase: number | null;
	cantidadVendidaRango: number;
}

async function margenProductosBase(
	db: D1Database,
	rango: RangoFechas,
	categoriaId?: string
): Promise<MargenProductoBase[]> {
	const condFecha = `${condicionFechaLocal('v.fecha')} AND v.estado = 'activa'`;
	const condCategoria = categoriaId ? 'AND p.categoria_id = ?' : '';
	const binds: string[] = [rango.desde, rango.hasta];
	if (categoriaId) binds.push(categoriaId);

	const result = await db
		.prepare(
			`SELECT p.id AS productoId, p.nombre, cat.nombre AS categoria,
				p.costo_ultimo AS costoUltimo, pp.precio AS precioBase,
				COALESCE(SUM(vi.cantidad), 0) AS cantidadVendidaRango
			 FROM productos p
			 LEFT JOIN categorias cat ON cat.id = p.categoria_id
			 LEFT JOIN producto_presentaciones pp ON pp.producto_id = p.id AND pp.factor_unidades = 1
			 LEFT JOIN venta_items vi ON vi.producto_id = p.id
				AND vi.venta_id IN (SELECT v.id FROM ventas v WHERE ${condFecha})
			 WHERE 1=1 ${condCategoria}
			 GROUP BY p.id, p.nombre, cat.nombre, p.costo_ultimo, pp.precio
			 ORDER BY p.nombre ASC`
		)
		.bind(...binds)
		.all<MargenProductoBase>();
	return result.results;
}

/** Margen actual (costo de hoy vs. precio de hoy, ver calcularGanancia en utils.ts) por
 * producto, más la cantidad vendida en el rango para estimar la ganancia del período.
 * No es margen histórico: usa el costo_ultimo VIGENTE, no el costo real al momento de
 * cada venta (venta_items no lo guarda), igual que el resto de la app calcula ganancia. */
export async function margenProductos(
	db: D1Database,
	rango: RangoFechas,
	categoriaId?: string
): Promise<ProductoMargen[]> {
	const base = await margenProductosBase(db, rango, categoriaId);

	const filas = base.map((row) => {
		const ganancia =
			row.precioBase != null ? calcularGanancia(row.costoUltimo, row.precioBase) : null;
		return {
			productoId: row.productoId,
			nombre: row.nombre,
			categoria: row.categoria,
			costoUltimo: row.costoUltimo,
			precioBase: row.precioBase,
			margenMonto: ganancia?.monto ?? null,
			margenPorcentaje: ganancia?.porcentaje ?? null,
			cantidadVendidaRango: row.cantidadVendidaRango,
			gananciaEstimadaRango: ganancia
				? Math.round(ganancia.monto * row.cantidadVendidaRango * 100) / 100
				: null
		};
	});

	// gananciaEstimadaRango se calcula en JS (depende de calcularGanancia), así que el orden
	// "el que más gana primero" se aplica acá, no en el SQL. null (sin costo registrado)
	// queda al final, ni arriba ni abajo del todo por monto.
	filas.sort((a, b) => (b.gananciaEstimadaRango ?? -Infinity) - (a.gananciaEstimadaRango ?? -Infinity));
	return filas;
}

export interface CategoriaRentabilidad {
	categoria: string;
	cantidadVendida: number;
	gananciaEstimada: number;
}

/**
 * Rollup por categoría (SIEMPRE sobre todo el catálogo, sin el filtro de categoría que
 * se le pueda aplicar a la tabla de detalle de margenProductos) — responde "qué
 * categoría vende/gana más" en términos absolutos, sin importar qué categoría esté
 * mirando el usuario en la tabla al mismo tiempo.
 */
export async function categoriasRentabilidad(
	db: D1Database,
	rango: RangoFechas
): Promise<CategoriaRentabilidad[]> {
	const base = await margenProductosBase(db, rango);

	const porCategoria = new Map<string, CategoriaRentabilidad>();
	for (const row of base) {
		const nombre = row.categoria ?? 'Sin categoría';
		const ganancia =
			row.precioBase != null ? calcularGanancia(row.costoUltimo, row.precioBase) : null;
		const actual = porCategoria.get(nombre) ?? {
			categoria: nombre,
			cantidadVendida: 0,
			gananciaEstimada: 0
		};
		actual.cantidadVendida += row.cantidadVendidaRango;
		actual.gananciaEstimada += ganancia ? ganancia.monto * row.cantidadVendidaRango : 0;
		porCategoria.set(nombre, actual);
	}

	return Array.from(porCategoria.values()).map((c) => ({
		...c,
		gananciaEstimada: Math.round(c.gananciaEstimada * 100) / 100
	}));
}

export interface ProductoStock {
	id: string;
	nombre: string;
	categoria: string | null;
	cantidad: number;
}

/** Productos con cantidad <= 0 — incluye tanto agotados (0) como los que quedaron en
 * negativo (se vendió más de lo que había en el momento; guardarVenta en ventas.ts no
 * bloquea el cobro por falta de stock, ver comentario ahí). Orden por cantidad ASC: el
 * déficit más grande (más negativo) aparece primero, como la urgencia más clara. */
export async function productosSinStock(db: D1Database): Promise<ProductoStock[]> {
	const result = await db
		.prepare(
			`SELECT p.id, p.nombre, cat.nombre AS categoria, p.cantidad
			 FROM productos p LEFT JOIN categorias cat ON cat.id = p.categoria_id
			 WHERE p.cantidad <= 0
			 ORDER BY p.cantidad ASC, p.nombre ASC`
		)
		.all<ProductoStock>();
	return result.results;
}

/** Productos con cantidad > 0. Orden por cantidad ASC: los que están por agotarse
 * pronto (menos unidades disponibles) aparecen primero. */
export async function productosDisponibles(db: D1Database): Promise<ProductoStock[]> {
	const result = await db
		.prepare(
			`SELECT p.id, p.nombre, cat.nombre AS categoria, p.cantidad
			 FROM productos p LEFT JOIN categorias cat ON cat.id = p.categoria_id
			 WHERE p.cantidad > 0
			 ORDER BY p.cantidad ASC, p.nombre ASC`
		)
		.all<ProductoStock>();
	return result.results;
}

export interface ResumenCajaRango {
	sesiones: number;
	totalEsperado: number;
	totalFinal: number;
	totalDiferencia: number;
}

export async function resumenCajaRango(
	db: D1Database,
	rango: RangoFechas
): Promise<ResumenCajaRango> {
	// apertura_en (no cierre_en) para calzar exactamente con el mismo filtro que ya usa
	// listHistorialCaja (ver caja.ts) — así el resumen y el detalle de sesiones del
	// reporte de Caja siempre muestran el mismo conjunto de sesiones.
	const condFecha = `abierta = 0 AND ${condicionFechaLocal('apertura_en')}`;

	const row = await db
		.prepare(
			`SELECT COUNT(*) AS sesiones,
				COALESCE(SUM(efectivo_esperado + yape_esperado + tarjeta_esperado), 0) AS totalEsperado,
				COALESCE(SUM(efectivo_final + yape_final + tarjeta_final), 0) AS totalFinal
			 FROM caja_sesiones WHERE ${condFecha}`
		)
		.bind(rango.desde, rango.hasta)
		.first<{ sesiones: number; totalEsperado: number; totalFinal: number }>();

	const totalEsperado = row?.totalEsperado ?? 0;
	const totalFinal = row?.totalFinal ?? 0;
	return {
		sesiones: row?.sesiones ?? 0,
		totalEsperado,
		totalFinal,
		totalDiferencia: Math.round((totalFinal - totalEsperado) * 100) / 100
	};
}
