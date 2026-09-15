import { OFFSET_LIMA } from './fecha';

// 'inicial' no lo escribe la app: lo pone el backfill (scripts/backfill-kardex.sql) como
// saldo de apertura de cada presentación, el residuo entre el stock real y lo que se pudo
// reconstruir del historial anterior al kardex.
export type TipoMovimiento = 'inicial' | 'venta' | 'anulacion' | 'ingreso' | 'ajuste' | 'edicion';

export interface MovimientoInput {
	productoId: string;
	nombreProducto: string;
	presentacionId: string | null;
	nombrePresentacion: string;
	factorUnidades: number;
	/** En unidades de ESA presentación, con signo: positivo entra, negativo sale. */
	cantidad: number;
	tipo: TipoMovimiento;
	ventaId?: string | null;
	pedidoId?: string | null;
	promoId?: string | null;
	detalle?: string | null;
}

/** Quién hizo el movimiento. Todo null si la acción no pasó por un usuario logueado. */
export interface ActorMovimiento {
	id: string | null;
	nombre: string | null;
}

export const SIN_ACTOR: ActorMovimiento = { id: null, nombre: null };

/** Traduce el usuario de la sesión (event.locals.user) al actor del movimiento. */
export function actorDe(user: { id: string; nombre: string } | null): ActorMovimiento {
	return user ? { id: user.id, nombre: user.nombre } : SIN_ACTOR;
}

/**
 * Devuelve las sentencias del INSERT en vez de ejecutarlas: quien registra un movimiento
 * (venta, pedido, ajuste) ya arma su propio db.batch, y el movimiento tiene que entrar en
 * ESE batch — si se guardara aparte podría quedar un stock actualizado sin su fila de
 * kardex, o al revés.
 */
export function sentenciasMovimientos(
	db: D1Database,
	movimientos: MovimientoInput[],
	actor: ActorMovimiento
): D1PreparedStatement[] {
	const creadoEn = new Date().toISOString();
	return movimientos
		.filter((m) => m.cantidad !== 0)
		.map((m) =>
			db
				.prepare(
					`INSERT INTO movimientos_stock
						(id, producto_id, nombre_producto, presentacion_id, nombre_presentacion,
						 factor_unidades, cantidad, unidades_base, tipo, venta_id, pedido_id, promo_id,
						 detalle, usuario_id, usuario_nombre, creado_en)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					crypto.randomUUID(),
					m.productoId,
					m.nombreProducto,
					m.presentacionId,
					m.nombrePresentacion,
					m.factorUnidades,
					m.cantidad,
					m.cantidad * m.factorUnidades,
					m.tipo,
					m.ventaId ?? null,
					m.pedidoId ?? null,
					m.promoId ?? null,
					m.detalle ?? null,
					actor.id,
					actor.nombre,
					creadoEn
				)
		);
}

export interface MovimientoVentaRow {
	presentacion_id: string | null;
	producto_id: string | null;
	nombre_producto: string;
	nombre_presentacion: string;
	factor_unidades: number;
	cantidad: number;
	promo_id: string | null;
	detalle: string | null;
}

/** Los movimientos que descontó una venta, para poder revertirlos tal cual al anularla. */
export async function movimientosDeVenta(db: D1Database, ventaId: string) {
	const result = await db
		.prepare(
			`SELECT presentacion_id, producto_id, nombre_producto, nombre_presentacion,
				factor_unidades, cantidad, promo_id, detalle
			 FROM movimientos_stock
			 WHERE venta_id = ? AND tipo = 'venta'`
		)
		.bind(ventaId)
		.all<MovimientoVentaRow>();
	return result.results;
}

export interface MovimientoDTO {
	id: string;
	fecha: string;
	tipo: TipoMovimiento;
	nombreProducto: string;
	nombrePresentacion: string;
	factorUnidades: number;
	cantidad: number;
	unidadesBase: number;
	ventaId: string | null;
	pedidoId: string | null;
	promoId: string | null;
	detalle: string | null;
	usuarioNombre: string | null;
	/** Saldo del producto (en unidades base) justo DESPUÉS de este movimiento. */
	saldo: number;
}

interface RawMovimientoRow extends Omit<MovimientoDTO, 'saldo'> {
	/** ventas.correlativo: solo las boletas lo tienen, las notas de pedido van sin numerar. */
	codigoVenta: number | null;
	codigoPedido: string | null;
}

export interface KardexProducto {
	id: string;
	nombre: string;
	marca: string | null;
	categoria: string | null;
	cantidad: number;
}

export interface Kardex {
	movimientos: MovimientoDTO[];
	/** Total de entradas y salidas del rango, en unidades base. */
	entradas: number;
	salidas: number;
	/** Saldo al cerrar el rango y saldo con el que se abrió. */
	saldoFinal: number;
	saldoInicial: number;
}

// date(columna, OFFSET_LIMA) lleva la fecha UTC guardada a fecha-calendario de Lima antes
// de compararla contra el rango elegido, igual que en reportes.ts.
function condicionFechaLocal(columna: string): string {
	return `date(${columna}, '${OFFSET_LIMA}') >= date(?) AND date(${columna}, '${OFFSET_LIMA}') <= date(?)`;
}

/**
 * Kardex de un producto en un rango. El saldo NO se acumula desde cero: los movimientos
 * existen recién desde la migración 0011, así que sumarlos desde el principio daría un
 * saldo inventado. Se ancla en el stock real de hoy (productos.cantidad) y se camina
 * hacia atrás descontando lo que pasó después del rango; así la última fila del rango
 * siempre cuadra con lo que el inventario muestra hoy.
 */
export async function kardexProducto(
	db: D1Database,
	productoId: string,
	rango: { desde: string; hasta: string }
): Promise<Kardex> {
	const [movimientosResult, posteriores, producto] = await Promise.all([
		db
			.prepare(
				`SELECT m.id, m.creado_en AS fecha, m.tipo, m.nombre_producto AS nombreProducto,
					m.nombre_presentacion AS nombrePresentacion, m.factor_unidades AS factorUnidades,
					m.cantidad, m.unidades_base AS unidadesBase, m.venta_id AS ventaId,
					m.pedido_id AS pedidoId, m.promo_id AS promoId, m.detalle,
					m.usuario_nombre AS usuarioNombre,
					v.correlativo AS codigoVenta, pe.codigo AS codigoPedido
				 FROM movimientos_stock m
				 LEFT JOIN ventas v ON v.id = m.venta_id
				 LEFT JOIN pedidos pe ON pe.id = m.pedido_id
				 WHERE m.producto_id = ? AND ${condicionFechaLocal('m.creado_en')}
				 ORDER BY m.creado_en DESC, m.rowid DESC`
			)
			.bind(productoId, rango.desde, rango.hasta)
			.all<RawMovimientoRow>(),
		db
			.prepare(
				`SELECT COALESCE(SUM(unidades_base), 0) AS total
				 FROM movimientos_stock
				 WHERE producto_id = ? AND date(creado_en, '${OFFSET_LIMA}') > date(?)`
			)
			.bind(productoId, rango.hasta)
			.first<{ total: number }>(),
		db
			.prepare('SELECT cantidad FROM productos WHERE id = ?')
			.bind(productoId)
			.first<{ cantidad: number }>()
	]);

	const stockHoy = producto?.cantidad ?? 0;
	const saldoFinal = stockHoy - (posteriores?.total ?? 0);

	let saldo = saldoFinal;
	const movimientos: MovimientoDTO[] = movimientosResult.results.map((row) => {
		const { codigoVenta, codigoPedido, ...resto } = row;
		const movimiento: MovimientoDTO = {
			...resto,
			// El detalle propio manda (nombre de la promo, motivo del ajuste); si no hay, se
			// cae al número de comprobante o al código del pedido.
			detalle: resto.detalle ?? etiquetaReferencia(codigoVenta, codigoPedido),
			saldo
		};
		saldo -= row.unidadesBase;
		return movimiento;
	});

	const entradas = movimientos.reduce(
		(acc, m) => acc + (m.unidadesBase > 0 ? m.unidadesBase : 0),
		0
	);
	const salidas = movimientos.reduce(
		(acc, m) => acc + (m.unidadesBase < 0 ? -m.unidadesBase : 0),
		0
	);

	return { movimientos, entradas, salidas, saldoFinal, saldoInicial: saldo };
}

function etiquetaReferencia(
	correlativo: number | null,
	codigoPedido: string | null
): string | null {
	if (correlativo !== null) return `Boleta #${correlativo}`;
	if (codigoPedido) return `Pedido ${codigoPedido}`;
	return null;
}
