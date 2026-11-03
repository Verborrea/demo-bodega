import { calcularGanancia } from '$lib/utils';
import { OFFSET_LIMA, inicioDiaLimaUtc, inicioDiaSiguienteLimaUtc } from './fecha';

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

export interface CategoriaRentabilidad {
	categoria: string;
	cantidadVendida: number;
	gananciaEstimada: number;
}

export interface ReporteGanancia {
	productos: ProductoMargen[];
	categorias: CategoriaRentabilidad[];
	productoMasVendido: ProductoVentaRango | null;
	productoMenosVendido: ProductoVentaRango | null;
}

interface FilaCatalogo {
	productoId: string;
	nombre: string;
	categoriaId: string | null;
	categoria: string | null;
	costoUltimo: number | null;
	precioBase: number | null;
}

interface VendidoPorProducto {
	productoId: string;
	cantidad: number;
	total: number;
}

/**
 * Reporte de ganancia: tabla de margen por producto, rollup por categoría y el producto más y
 * menos vendido del rango, todo de UNA sola pasada.
 *
 * Antes eran cuatro consultas independientes que cruzaban todo el catálogo contra TODO el
 * historial de venta_items (~55 mil filas leídas cada una, y creciendo con cada venta aunque el
 * rango fuera una semana). Ahora: el catálogo una vez (el reporte lista todos los productos, hasta
 * los que no vendieron — es la señal de "menos vendidos") y lo vendido agregado desde las ventas
 * del rango (índice por estado + fecha, rango sobre la columna), así que el costo depende del rango
 * pedido y no del historial completo.
 *
 * - Margen actual (costo de hoy vs. precio de hoy, ver calcularGanancia en utils.ts), no margen
 *   histórico: usa el costo_ultimo VIGENTE, no el costo real al momento de cada venta
 *   (venta_items no lo guarda), igual que el resto de la app calcula ganancia.
 * - `categorias` y `productoMasVendido/MenosVendido` son SIEMPRE sobre todo el catálogo, sin el
 *   filtro `categoriaId` que solo recorta la tabla de detalle (`productos`): responden "qué
 *   categoría/producto vende o gana más" sin importar qué categoría se esté mirando.
 */
export async function reporteGanancia(
	db: D1Database,
	rango: RangoFechas,
	categoriaId?: string
): Promise<ReporteGanancia> {
	const [catalogo, vendidos] = await Promise.all([
		db
			.prepare(
				`SELECT p.id AS productoId, p.nombre, p.categoria_id AS categoriaId, cat.nombre AS categoria,
					p.costo_ultimo AS costoUltimo, pp.precio AS precioBase
				 FROM productos p
				 LEFT JOIN categorias cat ON cat.id = p.categoria_id
				 LEFT JOIN producto_presentaciones pp ON pp.producto_id = p.id AND pp.factor_unidades = 1
				 ORDER BY p.nombre ASC`
			)
			.all<FilaCatalogo>(),
		db
			.prepare(
				`SELECT vi.producto_id AS productoId, SUM(vi.cantidad) AS cantidad, SUM(vi.subtotal) AS total
				 FROM ventas v
				 JOIN venta_items vi ON vi.venta_id = v.id
				 WHERE v.estado = 'activa' AND v.fecha >= ? AND v.fecha < ? AND vi.producto_id IS NOT NULL
				 GROUP BY vi.producto_id`
			)
			.bind(inicioDiaLimaUtc(rango.desde), inicioDiaSiguienteLimaUtc(rango.hasta))
			.all<VendidoPorProducto>()
	]);

	const vendidoPorProducto = new Map(vendidos.results.map((v) => [v.productoId, v]));
	const filas = catalogo.results.map((p) => ({
		...p,
		cantidadVendida: vendidoPorProducto.get(p.productoId)?.cantidad ?? 0,
		totalVendido: vendidoPorProducto.get(p.productoId)?.total ?? 0,
		ganancia: p.precioBase != null ? calcularGanancia(p.costoUltimo, p.precioBase) : null
	}));

	const productos: ProductoMargen[] = filas
		.filter((f) => !categoriaId || f.categoriaId === categoriaId)
		.map((f) => ({
			productoId: f.productoId,
			nombre: f.nombre,
			categoria: f.categoria,
			costoUltimo: f.costoUltimo,
			precioBase: f.precioBase,
			margenMonto: f.ganancia?.monto ?? null,
			margenPorcentaje: f.ganancia?.porcentaje ?? null,
			cantidadVendidaRango: f.cantidadVendida,
			gananciaEstimadaRango: f.ganancia
				? Math.round(f.ganancia.monto * f.cantidadVendida * 100) / 100
				: null
		}));
	// gananciaEstimadaRango depende de calcularGanancia (JS), así que el orden "el que más gana
	// primero" se aplica acá, no en el SQL. null (sin costo registrado) queda al final.
	productos.sort(
		(a, b) => (b.gananciaEstimadaRango ?? -Infinity) - (a.gananciaEstimadaRango ?? -Infinity)
	);

	const porCategoria = new Map<string, CategoriaRentabilidad>();
	for (const f of filas) {
		const nombre = f.categoria ?? 'Sin categoría';
		const actual = porCategoria.get(nombre) ?? {
			categoria: nombre,
			cantidadVendida: 0,
			gananciaEstimada: 0
		};
		actual.cantidadVendida += f.cantidadVendida;
		actual.gananciaEstimada += f.ganancia ? f.ganancia.monto * f.cantidadVendida : 0;
		porCategoria.set(nombre, actual);
	}
	const categorias = Array.from(porCategoria.values()).map((c) => ({
		...c,
		gananciaEstimada: Math.round(c.gananciaEstimada * 100) / 100
	}));

	// Los productos ya vienen por nombre: en un empate gana el primero, que es lo mismo que
	// ordenar por (cantidad, nombre).
	let mas: (typeof filas)[number] | null = null;
	let menos: (typeof filas)[number] | null = null;
	for (const f of filas) {
		if (!mas || f.cantidadVendida > mas.cantidadVendida) mas = f;
		if (!menos || f.cantidadVendida < menos.cantidadVendida) menos = f;
	}
	const aVentaRango = (f: (typeof filas)[number] | null): ProductoVentaRango | null =>
		f && {
			productoId: f.productoId,
			nombre: f.nombre,
			categoria: f.categoria,
			cantidadVendida: f.cantidadVendida,
			totalVendido: f.totalVendido
		};

	return {
		productos,
		categorias,
		productoMasVendido: aVentaRango(mas),
		productoMenosVendido: aVentaRango(menos)
	};
}

export interface ProductoStock {
	id: string;
	nombre: string;
	categoria: string | null;
	cantidad: number;
}

export interface ReporteStock {
	agotados: ProductoStock[];
	disponibles: ProductoStock[];
}

/**
 * Agotados (cantidad <= 0 — incluye los que quedaron en negativo: se vendió más de lo que había,
 * ver el comentario en guardarVenta) y disponibles (cantidad > 0), de UNA sola lectura del
 * catálogo. Orden por cantidad ASC en los dos: el mayor déficit (más negativo) primero entre los
 * agotados, y los que están por agotarse primero entre los disponibles.
 */
export async function reporteStock(db: D1Database): Promise<ReporteStock> {
	const result = await db
		.prepare(
			`SELECT p.id, p.nombre, cat.nombre AS categoria, p.cantidad
			 FROM productos p LEFT JOIN categorias cat ON cat.id = p.categoria_id
			 ORDER BY p.cantidad ASC, p.nombre ASC`
		)
		.all<ProductoStock>();
	return {
		agotados: result.results.filter((p) => p.cantidad <= 0),
		disponibles: result.results.filter((p) => p.cantidad > 0)
	};
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
