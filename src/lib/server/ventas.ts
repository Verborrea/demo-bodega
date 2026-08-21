export type TipoVenta = 'boleta' | 'nota_pedido';
export type EstadoVenta = 'activa' | 'anulada';

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
		       FROM venta_items WHERE venta_id = v.id ORDER BY creado_en)) AS itemsJson
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
		items: row.itemsJson ? JSON.parse(row.itemsJson) : []
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

export class StockInsuficienteError extends Error {}

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
	metodo: string;
	numeroDocumento: string | null;
	cliente: string | null;
	total: number;
	items: ItemVentaInput[];
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
	const consumoPorPresentacion = new Map<string, number>();
	for (const item of itemsProducto) {
		consumoPorPresentacion.set(
			item.presentacionId,
			(consumoPorPresentacion.get(item.presentacionId) ?? 0) + item.cantidad
		);
	}
	for (const item of itemsPromo) {
		const componentes = promoItemsPorPromo.get(item.promoId);
		if (!componentes) throw new StockInsuficienteError('Promo no encontrada.');
		for (const comp of componentes) {
			consumoPorPresentacion.set(
				comp.presentacion_id,
				(consumoPorPresentacion.get(comp.presentacion_id) ?? 0) +
					comp.cantidadPorPromo * item.cantidad
			);
		}
	}

	function stockActual(presentacionId: string): { cantidad: number; nombre: string } {
		const directa = presentacionInfoPorId.get(presentacionId);
		if (directa) return { cantidad: directa.cantidad, nombre: directa.productoNombre };
		for (const lista of promoItemsPorPromo.values()) {
			const comp = lista.find((c) => c.presentacion_id === presentacionId);
			if (comp) return { cantidad: comp.stockPresentacion, nombre: comp.productoNombre };
		}
		return { cantidad: 0, nombre: 'producto' };
	}

	for (const [presentacionId, consumo] of consumoPorPresentacion) {
		const { cantidad, nombre } = stockActual(presentacionId);
		if (consumo > cantidad) {
			throw new StockInsuficienteError(`No hay suficiente stock de "${nombre}".`);
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
				data.metodo,
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

	const indicesDescuentoStock: number[] = [];
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

		indicesDescuentoStock.push(statements.length);
		statements.push(
			db
				.prepare(
					'UPDATE producto_presentaciones SET cantidad = cantidad - ? WHERE id = ? AND cantidad >= ?'
				)
				.bind(consumo, presentacionId, consumo),
			db
				.prepare('UPDATE productos SET cantidad = MAX(0, cantidad - ?) WHERE id = ?')
				.bind(consumo * factorUnidades, productoId)
		);
	}

	const totalItems = data.items.reduce((acc, item) => acc + item.cantidad, 0);
	const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
	statements.push(
		db
			.prepare(
				`INSERT INTO caja_movimientos (id, sesion_id, tipo, metodo, monto, descripcion, venta_id)
				 VALUES (?, ?, 'venta', ?, ?, ?, ?)`
			)
			.bind(
				crypto.randomUUID(),
				sesionCajaId,
				data.metodo,
				data.total,
				`${totalItems} producto${totalItems === 1 ? '' : 's'} · ${hora}`,
				id
			)
	);

	// El pre-chequeo de arriba cubre el caso normal (una sola caja vendiendo a la vez).
	// D1 no revierte un batch solo porque una fila afectó 0 registros (no es un error SQL),
	// así que esta guarda por presentación solo evita que el stock baje de 0 bajo una venta
	// simultánea muy poco probable en una tienda con una sola caja; no deshace la venta ya
	// registrada si eso llegara a pasar.
	const results = await db.batch(statements);
	for (const index of indicesDescuentoStock) {
		const meta = results[index]?.meta as { changes?: number } | undefined;
		if (meta && meta.changes === 0) {
			console.error(
				`Venta ${id}: stock insuficiente al momento de descontar, revisar manualmente.`
			);
		}
	}

	return id;
}

export async function totalVentasDelDia(db: D1Database): Promise<number> {
	const row = await db
		.prepare(
			`SELECT COALESCE(SUM(total), 0) AS total FROM ventas WHERE estado = 'activa' AND date(fecha) = date('now')`
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
	const row = await db
		.prepare(
			`SELECT
				COALESCE(SUM(CASE WHEN date(fecha) = date('now') THEN total ELSE 0 END), 0) AS dia,
				COALESCE(SUM(CASE WHEN strftime('%Y-%W', fecha) = strftime('%Y-%W', 'now') THEN total ELSE 0 END), 0) AS semana,
				COALESCE(SUM(CASE WHEN strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now') THEN total ELSE 0 END), 0) AS mes,
				COALESCE(SUM(CASE WHEN strftime('%Y', fecha) = strftime('%Y', 'now') THEN total ELSE 0 END), 0) AS anio
			 FROM ventas WHERE estado = 'activa'`
		)
		.first<ResumenVentas>();
	return row ?? { dia: 0, semana: 0, mes: 0, anio: 0 };
}
