import { recalcularEsperadosSiCerrada, type MetodoCaja } from './caja';
import { NEGOCIO } from '$lib/config/negocio';
import { OFFSET_LIMA, OFFSET_LIMA_INVERSO } from './fecha';

export type TipoVenta = 'boleta' | 'nota_pedido';
export type EstadoVenta = 'activa' | 'anulada';
export type EstadoSunat = 'no_aplica' | 'pendiente' | 'aceptado' | 'rechazado';

export interface PagoVentaDTO {
	metodo: MetodoCaja;
	monto: number;
}

export interface ItemVentaDTO {
	id: string;
	productoId: string | null;
	nombreProducto: string;
	presentacionId: string | null;
	nombrePresentacion: string;
	promoId: string | null;
	cantidad: number;
	precioUnitario: number;
	subtotal: number;
}

export interface VentaDTO {
	id: string;
	fecha: string;
	tipo: TipoVenta;
	metodo: string;
	numeroDocumento: string | null;
	cliente: string | null;
	total: number;
	estado: EstadoVenta;
	cajeroId: string | null;
	cajeroNombre: string;
	sesionCajaId: string | null;
	serie: string | null;
	correlativo: number | null;
	sunatEstado: EstadoSunat;
	sunatHash: string | null;
	sunatError: string | null;
	items: ItemVentaDTO[];
	pagos: PagoVentaDTO[];
}

interface RawVentaRow {
	id: string;
	fecha: string;
	tipo: TipoVenta;
	metodo: string;
	numero_documento: string | null;
	cliente: string | null;
	total: number;
	estado: EstadoVenta;
	cajero_id: string | null;
	cajero_nombre: string;
	sesion_caja_id: string | null;
	serie: string | null;
	correlativo: number | null;
	sunat_estado: EstadoSunat;
	sunat_hash: string | null;
	sunat_error: string | null;
	itemsJson: string | null;
	pagosJson: string | null;
}

const VENTA_SELECT = `
	SELECT v.id, v.fecha, v.tipo, v.metodo, v.numero_documento, v.cliente, v.total, v.estado,
		v.cajero_id, v.cajero_nombre, v.sesion_caja_id,
		v.serie, v.correlativo, v.sunat_estado, v.sunat_hash, v.sunat_error,
		(SELECT json_group_array(json_object(
				'id', id, 'productoId', producto_id, 'nombreProducto', nombre_producto,
				'presentacionId', presentacion_id, 'nombrePresentacion', nombre_presentacion,
				'promoId', promo_id, 'cantidad', cantidad, 'precioUnitario', precio_unitario, 'subtotal', subtotal
			))
		 FROM (SELECT id, producto_id, nombre_producto, presentacion_id, nombre_presentacion,
		              promo_id, cantidad, precio_unitario, subtotal
		       FROM venta_items WHERE venta_id = v.id ORDER BY creado_en)) AS itemsJson,
		(SELECT json_group_array(json_object('metodo', metodo, 'monto', monto))
		 FROM (SELECT metodo, monto FROM caja_movimientos
		       WHERE venta_id = v.id AND tipo = 'venta' ORDER BY creado_en)) AS pagosJson
	FROM ventas v
`;

function mapRow(row: RawVentaRow): VentaDTO {
	return {
		id: row.id,
		fecha: row.fecha,
		tipo: row.tipo,
		metodo: row.metodo,
		numeroDocumento: row.numero_documento,
		cliente: row.cliente,
		total: row.total,
		estado: row.estado,
		cajeroId: row.cajero_id,
		cajeroNombre: row.cajero_nombre,
		sesionCajaId: row.sesion_caja_id,
		serie: row.serie,
		correlativo: row.correlativo,
		sunatEstado: row.sunat_estado,
		sunatHash: row.sunat_hash,
		sunatError: row.sunat_error,
		items: row.itemsJson ? JSON.parse(row.itemsJson) : [],
		pagos: row.pagosJson ? JSON.parse(row.pagosJson) : []
	};
}

export type OrdenVenta = 'fecha' | 'cliente' | 'cajero' | 'total';

// Whitelist de columna → SQL real: nunca se interpola orderBy directo en la query
// (vendría del querystring de la API), así se evita inyección por ese lado.
const ORDEN_VENTA_SQL: Record<OrdenVenta, string> = {
	fecha: 'v.fecha',
	cliente: 'v.cliente',
	cajero: 'v.cajero_nombre',
	total: 'v.total'
};

export interface ListarVentasParams {
	page: number;
	pageSize: number;
	search?: string;
	fechaInicio?: string;
	fechaFin?: string;
	orderBy?: OrdenVenta;
	orderDir?: 'asc' | 'desc';
}

export async function listVentas(db: D1Database, params: ListarVentasParams) {
	const { page, pageSize, search, fechaInicio, fechaFin, orderBy, orderDir } = params;
	const offset = (page - 1) * pageSize;
	const columnaOrden = ORDEN_VENTA_SQL[orderBy ?? 'fecha'];
	const direccionOrden = orderDir === 'asc' ? 'ASC' : 'DESC';

	const whereClauses: string[] = [];
	const whereValues: unknown[] = [];
	if (search) {
		whereClauses.push(
			`(v.cliente LIKE ? OR v.metodo LIKE ? OR v.cajero_nombre LIKE ? OR v.id IN (SELECT venta_id FROM venta_items WHERE nombre_producto LIKE ?))`
		);
		whereValues.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
	}
	if (fechaInicio) {
		whereClauses.push(`date(v.fecha, '${OFFSET_LIMA}') >= date(?)`);
		whereValues.push(fechaInicio);
	}
	if (fechaFin) {
		whereClauses.push(`date(v.fecha, '${OFFSET_LIMA}') <= date(?)`);
		whereValues.push(fechaFin);
	}
	const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

	const [listResult, resumenResult] = await Promise.all([
		db
			.prepare(
				`${VENTA_SELECT} ${where} ORDER BY ${columnaOrden} ${direccionOrden}, v.fecha DESC LIMIT ? OFFSET ?`
			)
			.bind(...whereValues, pageSize, offset)
			.all<RawVentaRow>(),
		db
			.prepare(`SELECT count(*) AS total, COALESCE(SUM(total), 0) AS suma FROM ventas v ${where}`)
			.bind(...whereValues)
			.first<{ total: number; suma: number }>()
	]);

	return {
		ventas: listResult.results.map(mapRow),
		total: resumenResult?.total ?? 0,
		sumaTotal: resumenResult?.suma ?? 0
	};
}

export class VentaInvalidaError extends Error {}

export type ItemVentaInput =
	| {
			tipo: 'producto';
			productoId: string;
			presentacionId: string;
			cantidad: number;
			precioUnitario: number;
	  }
	| {
			tipo: 'promo';
			promoId: string;
			cantidad: number;
			precioUnitario: number;
	  };

export interface GuardarVentaInput {
	tipo: TipoVenta;
	pagos: PagoVentaDTO[];
	numeroDocumento: string | null;
	cliente: string | null;
	total: number;
	items: ItemVentaInput[];
}

/** "Efectivo" si es un solo método, o "Efectivo + Yape" si el pago está fraccionado. */
function resumenMetodos(pagos: PagoVentaDTO[]): string {
	return [...new Set(pagos.map((p) => p.metodo))].join(' + ');
}

export interface CajeroInfo {
	id: string;
	nombre: string;
}

interface PresentacionInfo {
	id: string;
	nombre: string;
	factorUnidades: number;
	cantidad: number;
	productoId: string;
	productoNombre: string;
}

interface PromoItemInfo {
	promo_id: string;
	presentacion_id: string;
	cantidadPorPromo: number;
	factorUnidades: number;
	stockPresentacion: number;
	nombrePresentacion: string;
	productoId: string;
	productoNombre: string;
}

export interface VentaGuardadaInfo {
	id: string;
	serie: string | null;
	correlativo: number | null;
	sunatEstado: EstadoSunat;
}

export async function guardarVenta(
	db: D1Database,
	data: GuardarVentaInput,
	sesionCajaId: string,
	cajero: CajeroInfo
): Promise<VentaGuardadaInfo> {
	if (data.pagos.length === 0) {
		throw new VentaInvalidaError('Debes indicar al menos un método de pago.');
	}
	const sumaPagos = data.pagos.reduce((acc, p) => acc + p.monto, 0);
	if (Math.abs(sumaPagos - data.total) > 0.01) {
		throw new VentaInvalidaError('La suma de los pagos no coincide con el total de la venta.');
	}

	const itemsProducto = data.items.filter((i) => i.tipo === 'producto');
	const itemsPromo = data.items.filter((i) => i.tipo === 'promo');

	const presentacionIds = [...new Set(itemsProducto.map((i) => i.presentacionId))];
	const promoIds = [...new Set(itemsPromo.map((i) => i.promoId))];

	const presentacionInfoPorId = new Map<string, PresentacionInfo>();
	const promoNombrePorId = new Map<string, string>();

	if (presentacionIds.length > 0) {
		const placeholders = presentacionIds.map(() => '?').join(', ');
		const result = await db
			.prepare(
				`SELECT pp.id, pp.nombre, pp.factor_unidades AS factorUnidades, pp.cantidad,
					p.id AS productoId, p.nombre AS productoNombre
				 FROM producto_presentaciones pp
				 JOIN productos p ON p.id = pp.producto_id
				 WHERE pp.id IN (${placeholders})`
			)
			.bind(...presentacionIds)
			.all<PresentacionInfo>();
		for (const row of result.results) presentacionInfoPorId.set(row.id, row);
	}

	const promoItemsPorPromo = new Map<string, PromoItemInfo[]>();
	if (promoIds.length > 0) {
		const placeholders = promoIds.map(() => '?').join(', ');
		const [itemsResult, promosResult] = await Promise.all([
			db
				.prepare(
					`SELECT pi.promo_id, pi.presentacion_id, pi.cantidad AS cantidadPorPromo,
						pp.factor_unidades AS factorUnidades, pp.cantidad AS stockPresentacion, pp.nombre AS nombrePresentacion,
						p.id AS productoId, p.nombre AS productoNombre
					 FROM promo_items pi
					 JOIN producto_presentaciones pp ON pp.id = pi.presentacion_id
					 JOIN productos p ON p.id = pp.producto_id
					 WHERE pi.promo_id IN (${placeholders})`
				)
				.bind(...promoIds)
				.all<PromoItemInfo>(),
			db
				.prepare(`SELECT id, nombre FROM promos WHERE id IN (${placeholders})`)
				.bind(...promoIds)
				.all<{ id: string; nombre: string }>()
		]);
		for (const row of itemsResult.results) {
			const lista = promoItemsPorPromo.get(row.promo_id) ?? [];
			lista.push(row);
			promoItemsPorPromo.set(row.promo_id, lista);
		}
		for (const row of promosResult.results) promoNombrePorId.set(row.id, row.nombre);
	}

	// Consumo agregado por presentación (en unidades de esa presentación, no en unidades base),
	// combinando ventas directas de producto y las que vienen empaquetadas dentro de una promo.
	// No se bloquea la venta si el stock no alcanza: la tienda vende igual y el inventario
	// queda en 0/negativo para que se note el déficit en vez de rechazar el cobro.
	const consumoPorPresentacion = new Map<string, number>();
	for (const item of itemsProducto) {
		consumoPorPresentacion.set(
			item.presentacionId,
			(consumoPorPresentacion.get(item.presentacionId) ?? 0) + item.cantidad
		);
	}
	for (const item of itemsPromo) {
		const componentes = promoItemsPorPromo.get(item.promoId);
		if (!componentes) throw new VentaInvalidaError('Promo no encontrada.');
		for (const comp of componentes) {
			consumoPorPresentacion.set(
				comp.presentacion_id,
				(consumoPorPresentacion.get(comp.presentacion_id) ?? 0) +
					comp.cantidadPorPromo * item.cantidad
			);
		}
	}

	// Solo una boleta es un comprobante fiscal: le toca numeración serie-correlativo. El
	// incremento va en su propia sentencia con RETURNING (atómica, sin hueco entre leer y
	// escribir) para que dos ventas simultáneas nunca reciban el mismo correlativo — no se
	// puede meter dentro del db.batch de abajo porque batch no permite usar el resultado de
	// una sentencia como input de otra.
	let serie: string | null = null;
	let correlativo: number | null = null;
	let sunatEstado: EstadoSunat = 'no_aplica';
	if (data.tipo === 'boleta') {
		serie = NEGOCIO.serieBoleta;
		const contador = await db
			.prepare(
				`UPDATE contadores_documentos SET ultimo_correlativo = ultimo_correlativo + 1
				 WHERE serie = ? RETURNING ultimo_correlativo`
			)
			.bind(serie)
			.first<{ ultimo_correlativo: number }>();
		correlativo = contador?.ultimo_correlativo ?? null;
		// Queda 'pendiente': el envío real a SUNAT todavía no está implementado (ver sunat.ts).
		sunatEstado = 'pendiente';
	}

	const id = crypto.randomUUID();
	const statements = [
		db
			.prepare(
				`INSERT INTO ventas (id, fecha, tipo, metodo, numero_documento, cliente, total, estado, cajero_id, cajero_nombre, sesion_caja_id, serie, correlativo, sunat_estado)
				 VALUES (?, ?, ?, ?, ?, ?, ?, 'activa', ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				id,
				new Date().toISOString(),
				data.tipo,
				resumenMetodos(data.pagos),
				data.numeroDocumento,
				data.cliente,
				data.total,
				cajero.id,
				cajero.nombre,
				sesionCajaId,
				serie,
				correlativo,
				sunatEstado
			)
	];

	for (const item of itemsProducto) {
		const presentacion = presentacionInfoPorId.get(item.presentacionId)!;
		const subtotal = item.cantidad * item.precioUnitario;
		statements.push(
			db
				.prepare(
					`INSERT INTO venta_items
						(id, venta_id, producto_id, nombre_producto, presentacion_id, nombre_presentacion, factor_unidades, cantidad, precio_unitario, subtotal, promo_id)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
				)
				.bind(
					crypto.randomUUID(),
					id,
					presentacion.productoId,
					presentacion.productoNombre,
					presentacion.id,
					presentacion.nombre,
					presentacion.factorUnidades,
					item.cantidad,
					item.precioUnitario,
					subtotal
				)
		);
	}

	for (const item of itemsPromo) {
		const subtotal = item.cantidad * item.precioUnitario;
		statements.push(
			db
				.prepare(
					`INSERT INTO venta_items
						(id, venta_id, producto_id, nombre_producto, presentacion_id, nombre_presentacion, factor_unidades, cantidad, precio_unitario, subtotal, promo_id)
					 VALUES (?, ?, NULL, ?, NULL, 'Promo', 1, ?, ?, ?, ?)`
				)
				.bind(
					crypto.randomUUID(),
					id,
					promoNombrePorId.get(item.promoId) ?? 'Promo',
					item.cantidad,
					item.precioUnitario,
					subtotal,
					item.promoId
				)
		);
	}

	// Se permite vender aunque no alcance el stock a propósito (la tienda lo pidió así):
	// el descuento no tiene guarda de "cantidad >= consumo" ni MAX(0, ...), así que el
	// inventario puede quedar en negativo para que se note el déficit en vez de bloquear el cobro.
	for (const [presentacionId, consumo] of consumoPorPresentacion) {
		const directa = presentacionInfoPorId.get(presentacionId);
		const factorUnidades =
			directa?.factorUnidades ??
			[...promoItemsPorPromo.values()].flat().find((c) => c.presentacion_id === presentacionId)
				?.factorUnidades ??
			1;
		const productoId =
			directa?.productoId ??
			[...promoItemsPorPromo.values()].flat().find((c) => c.presentacion_id === presentacionId)
				?.productoId;
		if (!productoId) continue;

		statements.push(
			db
				.prepare('UPDATE producto_presentaciones SET cantidad = cantidad - ? WHERE id = ?')
				.bind(consumo, presentacionId),
			db
				.prepare('UPDATE productos SET cantidad = cantidad - ? WHERE id = ?')
				.bind(consumo * factorUnidades, productoId)
		);
	}

	const totalItems = data.items.reduce((acc, item) => acc + item.cantidad, 0);
	const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
	const descripcion = `${totalItems} producto${totalItems === 1 ? '' : 's'} · ${hora}`;
	for (const pago of data.pagos) {
		statements.push(
			db
				.prepare(
					`INSERT INTO caja_movimientos (id, sesion_id, tipo, metodo, monto, descripcion, venta_id)
					 VALUES (?, ?, 'venta', ?, ?, ?, ?)`
				)
				.bind(crypto.randomUUID(), sesionCajaId, pago.metodo, pago.monto, descripcion, id)
		);
	}

	await db.batch(statements);
	return { id, serie, correlativo, sunatEstado };
}

/**
 * Corrige el/los método(s) de pago de una venta ya registrada (p.ej. la cajera marcó
 * Efectivo por error y en realidad fue Yape). Reemplaza sus caja_movimientos en vez de
 * editarlos en el sitio para no arrastrar valores viejos si cambia la cantidad de pagos.
 */
export async function corregirPagoVenta(
	db: D1Database,
	ventaId: string,
	nuevosPagos: PagoVentaDTO[]
): Promise<void> {
	if (nuevosPagos.length === 0) {
		throw new VentaInvalidaError('Debes indicar al menos un método de pago.');
	}

	const venta = await db
		.prepare('SELECT total, estado, sesion_caja_id FROM ventas WHERE id = ?')
		.bind(ventaId)
		.first<{ total: number; estado: EstadoVenta; sesion_caja_id: string | null }>();
	if (!venta) throw new VentaInvalidaError('Venta no encontrada.');
	if (venta.estado !== 'activa') {
		throw new VentaInvalidaError('No se puede editar el pago de una venta anulada.');
	}

	const sumaPagos = nuevosPagos.reduce((acc, p) => acc + p.monto, 0);
	if (Math.abs(sumaPagos - venta.total) > 0.01) {
		throw new VentaInvalidaError('La suma de los pagos no coincide con el total de la venta.');
	}

	const movimientoPrevio = await db
		.prepare(
			`SELECT descripcion FROM caja_movimientos WHERE venta_id = ? AND tipo = 'venta' LIMIT 1`
		)
		.bind(ventaId)
		.first<{ descripcion: string }>();
	const descripcion = movimientoPrevio?.descripcion ?? '';

	const statements = [
		db.prepare(`DELETE FROM caja_movimientos WHERE venta_id = ? AND tipo = 'venta'`).bind(ventaId),
		...nuevosPagos.map((pago) =>
			db
				.prepare(
					`INSERT INTO caja_movimientos (id, sesion_id, tipo, metodo, monto, descripcion, venta_id)
					 VALUES (?, ?, 'venta', ?, ?, ?, ?)`
				)
				.bind(
					crypto.randomUUID(),
					venta.sesion_caja_id,
					pago.metodo,
					pago.monto,
					descripcion,
					ventaId
				)
		),
		db
			.prepare('UPDATE ventas SET metodo = ? WHERE id = ?')
			.bind(resumenMetodos(nuevosPagos), ventaId)
	];
	await db.batch(statements);

	if (venta.sesion_caja_id) {
		await recalcularEsperadosSiCerrada(db, venta.sesion_caja_id);
	}
}

interface VentaItemAnularRow {
	producto_id: string | null;
	presentacion_id: string | null;
	promo_id: string | null;
	cantidad: number;
	factor_unidades: number;
}

interface PromoComponenteRow {
	promo_id: string;
	presentacion_id: string;
	cantidad: number;
	factor_unidades: number;
	producto_id: string;
}

/**
 * Anula una venta ya registrada: la marca 'anulada', borra sus caja_movimientos (mismo
 * patrón que corregirPagoVenta) y devuelve el stock consumido a producto_presentaciones/
 * productos. Los ítems de promo no guardan su desglose por componente en venta_items (solo
 * promo_id + cantidad de combos), así que ese desglose se reconstruye contra promo_items.
 */
export async function anularVenta(db: D1Database, ventaId: string): Promise<void> {
	const venta = await db
		.prepare('SELECT estado, sesion_caja_id FROM ventas WHERE id = ?')
		.bind(ventaId)
		.first<{ estado: EstadoVenta; sesion_caja_id: string | null }>();
	if (!venta) throw new VentaInvalidaError('Venta no encontrada.');
	if (venta.estado === 'anulada') throw new VentaInvalidaError('Esta venta ya está anulada.');

	const itemsResult = await db
		.prepare(
			`SELECT producto_id, presentacion_id, promo_id, cantidad, factor_unidades
			 FROM venta_items WHERE venta_id = ?`
		)
		.bind(ventaId)
		.all<VentaItemAnularRow>();

	const promoIds = [
		...new Set(itemsResult.results.filter((i) => i.promo_id).map((i) => i.promo_id!))
	];
	const componentesPorPromo = new Map<string, PromoComponenteRow[]>();
	if (promoIds.length > 0) {
		const placeholders = promoIds.map(() => '?').join(', ');
		const result = await db
			.prepare(
				`SELECT pi.promo_id, pi.presentacion_id, pi.cantidad, pp.factor_unidades, pp.producto_id
				 FROM promo_items pi
				 JOIN producto_presentaciones pp ON pp.id = pi.presentacion_id
				 WHERE pi.promo_id IN (${placeholders})`
			)
			.bind(...promoIds)
			.all<PromoComponenteRow>();
		for (const row of result.results) {
			const lista = componentesPorPromo.get(row.promo_id) ?? [];
			lista.push(row);
			componentesPorPromo.set(row.promo_id, lista);
		}
	}

	// presentacionId -> { productoId, factorUnidades, cantidad a devolver }
	const devolucionPorPresentacion = new Map<
		string,
		{ productoId: string; factorUnidades: number; cantidad: number }
	>();
	function acumular(
		presentacionId: string,
		productoId: string,
		factorUnidades: number,
		cantidad: number
	) {
		const actual = devolucionPorPresentacion.get(presentacionId);
		if (actual) {
			actual.cantidad += cantidad;
		} else {
			devolucionPorPresentacion.set(presentacionId, { productoId, factorUnidades, cantidad });
		}
	}

	for (const item of itemsResult.results) {
		if (item.promo_id) {
			const componentes = componentesPorPromo.get(item.promo_id) ?? [];
			for (const comp of componentes) {
				acumular(
					comp.presentacion_id,
					comp.producto_id,
					comp.factor_unidades,
					comp.cantidad * item.cantidad
				);
			}
		} else if (item.presentacion_id && item.producto_id) {
			acumular(item.presentacion_id, item.producto_id, item.factor_unidades, item.cantidad);
		}
	}

	const statements = [
		db.prepare(`UPDATE ventas SET estado = 'anulada' WHERE id = ?`).bind(ventaId),
		db.prepare(`DELETE FROM caja_movimientos WHERE venta_id = ? AND tipo = 'venta'`).bind(ventaId)
	];
	for (const [
		presentacionId,
		{ productoId, factorUnidades, cantidad }
	] of devolucionPorPresentacion) {
		statements.push(
			db
				.prepare('UPDATE producto_presentaciones SET cantidad = cantidad + ? WHERE id = ?')
				.bind(cantidad, presentacionId),
			db
				.prepare('UPDATE productos SET cantidad = cantidad + ? WHERE id = ?')
				.bind(cantidad * factorUnidades, productoId)
		);
	}
	await db.batch(statements);

	if (venta.sesion_caja_id) {
		await recalcularEsperadosSiCerrada(db, venta.sesion_caja_id);
	}
}

export interface ResumenVentas {
	dia: number;
	semana: number;
	mes: number;
	anio: number;
}

export async function resumenVentas(db: D1Database): Promise<ResumenVentas> {
	// Los 4 buckets (día/semana/mes/año) están siempre dentro del año calendario actual
	// en hora Lima, así que acotar por "fecha >= inicio del año" (comparación directa
	// sobre la columna, no envuelta en función) deja que idx_ventas_estado_fecha descarte
	// de entrada los años anteriores; sin este límite la consulta escaneaba TODA la
	// historia de ventas activas en cada carga del dashboard, cada vez más lento a medida
	// que crece la tabla. Los CASE de abajo sí envuelven fecha en date()/strftime() con el
	// offset de Lima (necesario para el corte de día/semana/mes/año correcto), pero ya
	// operan solo sobre el subconjunto del año actual gracias al WHERE.
	const row = await db
		.prepare(
			`SELECT
				COALESCE(SUM(CASE WHEN date(fecha, ?) = date('now', ?) THEN total ELSE 0 END), 0) AS dia,
				COALESCE(SUM(CASE WHEN strftime('%Y-%W', fecha, ?) = strftime('%Y-%W', 'now', ?) THEN total ELSE 0 END), 0) AS semana,
				COALESCE(SUM(CASE WHEN strftime('%Y-%m', fecha, ?) = strftime('%Y-%m', 'now', ?) THEN total ELSE 0 END), 0) AS mes,
				COALESCE(SUM(CASE WHEN strftime('%Y', fecha, ?) = strftime('%Y', 'now', ?) THEN total ELSE 0 END), 0) AS anio
			 FROM ventas WHERE estado = 'activa' AND fecha >= date('now', ?, 'start of year', ?)`
		)
		.bind(
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA_INVERSO
		)
		.first<ResumenVentas>();
	return row ?? { dia: 0, semana: 0, mes: 0, anio: 0 };
}
