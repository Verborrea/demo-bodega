import { recalcularEsperadosSiCerrada, type MetodoCaja } from './caja';

export type TipoVenta = 'boleta' | 'nota_pedido';
export type EstadoVenta = 'activa' | 'anulada';

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
	itemsJson: string | null;
	pagosJson: string | null;
}

const VENTA_SELECT = `
	SELECT v.id, v.fecha, v.tipo, v.metodo, v.numero_documento, v.cliente, v.total, v.estado,
		v.cajero_id, v.cajero_nombre, v.sesion_caja_id,
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
		items: row.itemsJson ? JSON.parse(row.itemsJson) : [],
		pagos: row.pagosJson ? JSON.parse(row.pagosJson) : []
	};
}

export interface ListarVentasParams {
	page: number;
	pageSize: number;
	search?: string;
	fechaInicio?: string;
	fechaFin?: string;
}

export async function listVentas(db: D1Database, params: ListarVentasParams) {
	const { page, pageSize, search, fechaInicio, fechaFin } = params;
	const offset = (page - 1) * pageSize;

	const whereClauses: string[] = [];
	const whereValues: unknown[] = [];
	if (search) {
		whereClauses.push(
			`(v.cliente LIKE ? OR v.metodo LIKE ? OR v.cajero_nombre LIKE ? OR v.id IN (SELECT venta_id FROM venta_items WHERE nombre_producto LIKE ?))`
		);
		whereValues.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
	}
	if (fechaInicio) {
		whereClauses.push('date(v.fecha) >= date(?)');
		whereValues.push(fechaInicio);
	}
	if (fechaFin) {
		whereClauses.push('date(v.fecha) <= date(?)');
		whereValues.push(fechaFin);
	}
	const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

	const [listResult, resumenResult] = await Promise.all([
		db
			.prepare(`${VENTA_SELECT} ${where} ORDER BY v.fecha DESC LIMIT ? OFFSET ?`)
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

export async function guardarVenta(
	db: D1Database,
	data: GuardarVentaInput,
	sesionCajaId: string,
	cajero: CajeroInfo
): Promise<string> {
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

	const id = crypto.randomUUID();
	const statements = [
		db
			.prepare(
				`INSERT INTO ventas (id, fecha, tipo, metodo, numero_documento, cliente, total, estado, cajero_id, cajero_nombre, sesion_caja_id)
				 VALUES (?, ?, ?, ?, ?, ?, ?, 'activa', ?, ?, ?)`
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
				sesionCajaId
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
	return id;
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

export async function totalVentasDelDia(db: D1Database): Promise<number> {
	// fecha >= / < en vez de date(fecha) = date('now'): al no envolver la columna en una
	// función, SQLite puede usar el índice idx_ventas_estado_fecha para acotar el rango
	// en vez de evaluar date() fila por fila sobre toda la tabla.
	const row = await db
		.prepare(
			`SELECT COALESCE(SUM(total), 0) AS total FROM ventas
			 WHERE estado = 'activa' AND fecha >= date('now') AND fecha < date('now', '+1 day')`
		)
		.first<{ total: number }>();
	return row?.total ?? 0;
}

export interface ResumenVentas {
	dia: number;
	semana: number;
	mes: number;
	anio: number;
}

export async function resumenVentas(db: D1Database): Promise<ResumenVentas> {
	// Los 4 buckets (día/semana/mes/año) están siempre dentro del año calendario actual,
	// así que acotar por "fecha >= inicio del año" (comparación directa sobre la columna,
	// no envuelta en función) deja que idx_ventas_estado_fecha descarte de entrada los años
	// anteriores; sin este límite la consulta escaneaba TODA la historia de ventas activas
	// en cada carga del dashboard, cada vez más lento a medida que crece la tabla.
	const row = await db
		.prepare(
			`SELECT
				COALESCE(SUM(CASE WHEN date(fecha) = date('now') THEN total ELSE 0 END), 0) AS dia,
				COALESCE(SUM(CASE WHEN strftime('%Y-%W', fecha) = strftime('%Y-%W', 'now') THEN total ELSE 0 END), 0) AS semana,
				COALESCE(SUM(CASE WHEN strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now') THEN total ELSE 0 END), 0) AS mes,
				COALESCE(SUM(CASE WHEN strftime('%Y', fecha) = strftime('%Y', 'now') THEN total ELSE 0 END), 0) AS anio
			 FROM ventas WHERE estado = 'activa' AND fecha >= date('now', 'start of year')`
		)
		.first<ResumenVentas>();
	return row ?? { dia: 0, semana: 0, mes: 0, anio: 0 };
}
