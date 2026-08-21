export type TipoVenta = 'boleta' | 'nota_pedido';
export type EstadoVenta = 'activa' | 'anulada';

export interface ItemVentaDTO {
	id: string;
	productoId: string | null;
	nombreProducto: string;
	presentacionId: string | null;
	nombrePresentacion: string;
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
				'cantidad', cantidad, 'precioUnitario', precio_unitario, 'subtotal', subtotal
			))
		 FROM (SELECT id, producto_id, nombre_producto, presentacion_id, nombre_presentacion,
		              cantidad, precio_unitario, subtotal
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

export async function listVentas(db: D1Database, limit = 200) {
	const result = await db
		.prepare(`${VENTA_SELECT} ORDER BY v.fecha DESC LIMIT ?`)
		.bind(limit)
		.all<RawVentaRow>();
	return result.results.map(mapRow);
}

export class StockInsuficienteError extends Error {}

export interface ItemVentaInput {
	productoId: string;
	presentacionId: string;
	cantidad: number;
	precioUnitario: number;
}

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

export async function guardarVenta(
	db: D1Database,
	data: GuardarVentaInput,
	sesionCajaId: string,
	cajero: CajeroInfo
): Promise<string> {
	const presentacionIds = [...new Set(data.items.map((i) => i.presentacionId))];
	const placeholders = presentacionIds.map(() => '?').join(', ');
	const presentacionesResult = await db
		.prepare(
			`SELECT pp.id, pp.nombre, pp.factor_unidades AS factorUnidades, pp.cantidad,
				p.id AS productoId, p.nombre AS productoNombre
			 FROM producto_presentaciones pp
			 JOIN productos p ON p.id = pp.producto_id
			 WHERE pp.id IN (${placeholders})`
		)
		.bind(...presentacionIds)
		.all<PresentacionInfo>();
	const presentacionesPorId = new Map(presentacionesResult.results.map((p) => [p.id, p]));

	const cantidadPorPresentacion = new Map<string, number>();
	for (const item of data.items) {
		cantidadPorPresentacion.set(
			item.presentacionId,
			(cantidadPorPresentacion.get(item.presentacionId) ?? 0) + item.cantidad
		);
	}
	for (const [presentacionId, cantidadPedida] of cantidadPorPresentacion) {
		const presentacion = presentacionesPorId.get(presentacionId);
		if (!presentacion) throw new StockInsuficienteError('Presentación no encontrada.');
		if (cantidadPedida > presentacion.cantidad) {
			throw new StockInsuficienteError(
				`No hay suficiente stock de "${presentacion.productoNombre} (${presentacion.nombre})".`
			);
		}
	}

	const id = crypto.randomUUID();
	const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

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
	const indicesDescuentoStock: number[] = [];

	for (const item of data.items) {
		const presentacion = presentacionesPorId.get(item.presentacionId)!;
		const subtotal = item.cantidad * item.precioUnitario;
		const deltaBase = item.cantidad * presentacion.factorUnidades;

		statements.push(
			db
				.prepare(
					`INSERT INTO venta_items
						(id, venta_id, producto_id, nombre_producto, presentacion_id, nombre_presentacion, factor_unidades, cantidad, precio_unitario, subtotal)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
		indicesDescuentoStock.push(statements.length);
		statements.push(
			db
				.prepare('UPDATE producto_presentaciones SET cantidad = cantidad - ? WHERE id = ? AND cantidad >= ?')
				.bind(item.cantidad, presentacion.id, item.cantidad),
			db
				.prepare('UPDATE productos SET cantidad = MAX(0, cantidad - ?) WHERE id = ?')
				.bind(deltaBase, presentacion.productoId)
		);
	}

	const totalItems = data.items.reduce((acc, item) => acc + item.cantidad, 0);
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
	// así que esta guarda por ítem solo evita que el stock de una presentación baje de 0
	// bajo una venta simultánea muy poco probable en una tienda con una sola caja; no
	// deshace la venta ya registrada si eso llegara a pasar.
	const results = await db.batch(statements);
	for (const index of indicesDescuentoStock) {
		const meta = results[index]?.meta as { changes?: number } | undefined;
		if (meta && meta.changes === 0) {
			console.error(`Venta ${id}: stock insuficiente al momento de descontar, revisar manualmente.`);
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
