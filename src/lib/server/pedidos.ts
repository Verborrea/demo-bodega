import type { OpcionSimple } from './productos';

export interface PedidoItemDTO {
	id: string;
	productoId: string | null;
	nombreProducto: string;
	presentacionId: string | null;
	nombrePresentacion: string;
	factorUnidades: number;
	cantidad: number;
	costoUnitario: number;
	subtotal: number;
}

export interface PedidoDTO {
	id: string;
	codigo: string | null;
	proveedorId: string | null;
	proveedorNombre: string;
	fecha: string;
	notas: string | null;
	total: number;
	items: PedidoItemDTO[];
}

interface RawPedidoRow {
	id: string;
	codigo: string | null;
	proveedorId: string | null;
	proveedorNombre: string;
	fecha: string;
	notas: string | null;
	itemsJson: string | null;
}

const PEDIDO_SELECT = `
	SELECT pe.id, pe.codigo, pe.proveedor_id AS proveedorId, pe.proveedor_nombre AS proveedorNombre,
		pe.fecha, pe.notas,
		(SELECT json_group_array(json_object(
				'id', id, 'productoId', producto_id, 'nombreProducto', nombre_producto,
				'presentacionId', presentacion_id, 'nombrePresentacion', nombre_presentacion,
				'factorUnidades', factor_unidades, 'cantidad', cantidad,
				'costoUnitario', costo_unitario, 'subtotal', subtotal
			))
		 FROM (SELECT id, producto_id, nombre_producto, presentacion_id, nombre_presentacion,
		              factor_unidades, cantidad, costo_unitario, subtotal
		       FROM pedido_items WHERE pedido_id = pe.id ORDER BY creado_en)) AS itemsJson
	FROM pedidos pe
`;

function mapRow(row: RawPedidoRow): PedidoDTO {
	const items: PedidoItemDTO[] = row.itemsJson ? JSON.parse(row.itemsJson) : [];
	return {
		id: row.id,
		codigo: row.codigo,
		proveedorId: row.proveedorId,
		proveedorNombre: row.proveedorNombre,
		fecha: row.fecha,
		notas: row.notas,
		total: items.reduce((acc, item) => acc + item.subtotal, 0),
		items
	};
}

export interface ListarPedidosParams {
	page: number;
	pageSize: number;
	search: string;
	proveedorId: string;
}

export async function listPedidos(db: D1Database, params: ListarPedidosParams) {
	const { page, pageSize, search, proveedorId } = params;
	const offset = (page - 1) * pageSize;

	const whereClauses: string[] = [];
	const whereValues: unknown[] = [];
	if (search) {
		whereClauses.push('(pe.codigo LIKE ? OR pe.proveedor_nombre LIKE ?)');
		whereValues.push(`%${search}%`, `%${search}%`);
	}
	if (proveedorId) {
		whereClauses.push('pe.proveedor_id = ?');
		whereValues.push(proveedorId);
	}
	const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

	const listSql = `${PEDIDO_SELECT} ${where} ORDER BY pe.fecha DESC LIMIT ? OFFSET ?`;
	const countSql = `SELECT count(*) AS total FROM pedidos pe ${where}`;

	const [listResult, countResult] = await Promise.all([
		db
			.prepare(listSql)
			.bind(...whereValues, pageSize, offset)
			.all<RawPedidoRow>(),
		db
			.prepare(countSql)
			.bind(...whereValues)
			.first<{ total: number }>()
	]);

	return {
		pedidos: listResult.results.map(mapRow),
		total: countResult?.total ?? 0
	};
}

export async function obtenerPedido(db: D1Database, id: string) {
	const row = await db.prepare(`${PEDIDO_SELECT} WHERE pe.id = ?`).bind(id).first<RawPedidoRow>();
	return row ? mapRow(row) : null;
}

export interface PedidoItemInput {
	productoId: string;
	presentacionId: string;
	cantidad: number;
	costoUnitario: number;
}

export interface CrearPedidoInput {
	codigo: string | null;
	proveedorId: string;
	fecha?: string;
	notas: string | null;
	items: PedidoItemInput[];
}

interface PresentacionInfo {
	id: string;
	nombre: string;
	factorUnidades: number;
	productoId: string;
	productoNombre: string;
}

export async function crearPedido(db: D1Database, data: CrearPedidoInput): Promise<string> {
	if (data.items.length === 0) throw new Error('El pedido debe tener al menos un producto.');

	const proveedor = await db
		.prepare('SELECT nombre FROM proveedores WHERE id = ?')
		.bind(data.proveedorId)
		.first<{ nombre: string }>();
	if (!proveedor) throw new Error('Proveedor no encontrado.');

	const presentacionIds = [...new Set(data.items.map((i) => i.presentacionId))];
	const placeholders = presentacionIds.map(() => '?').join(', ');
	const presentacionesResult = await db
		.prepare(
			`SELECT pp.id, pp.nombre, pp.factor_unidades AS factorUnidades,
				p.id AS productoId, p.nombre AS productoNombre
			 FROM producto_presentaciones pp
			 JOIN productos p ON p.id = pp.producto_id
			 WHERE pp.id IN (${placeholders})`
		)
		.bind(...presentacionIds)
		.all<PresentacionInfo>();
	const presentacionesPorId = new Map(presentacionesResult.results.map((p) => [p.id, p]));

	const id = crypto.randomUUID();
	const statements = [
		db
			.prepare(
				'INSERT INTO pedidos (id, codigo, proveedor_id, proveedor_nombre, fecha, notas) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.bind(
				id,
				data.codigo,
				data.proveedorId,
				proveedor.nombre,
				data.fecha ?? new Date().toISOString(),
				data.notas
			)
	];

	for (const item of data.items) {
		const presentacion = presentacionesPorId.get(item.presentacionId);
		if (!presentacion) throw new Error('Presentación no encontrada.');
		const subtotal = item.cantidad * item.costoUnitario;
		const deltaBase = item.cantidad * presentacion.factorUnidades;
		// Costo normalizado a "por unidad base": si se compra una Caja de 6 a S/12, el
		// producto queda con costo_ultimo = 2.00, comparable contra el precio de la
		// presentación base sin importar en qué presentación llegó este pedido.
		const costoPorUnidadBase = item.costoUnitario / presentacion.factorUnidades;

		statements.push(
			db
				.prepare(
					`INSERT INTO pedido_items
						(id, pedido_id, producto_id, nombre_producto, presentacion_id, nombre_presentacion, factor_unidades, cantidad, costo_unitario, subtotal)
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
					item.costoUnitario,
					subtotal
				),
			db
				.prepare('UPDATE producto_presentaciones SET cantidad = cantidad + ? WHERE id = ?')
				.bind(item.cantidad, presentacion.id),
			db
				.prepare('UPDATE productos SET cantidad = cantidad + ?, costo_ultimo = ? WHERE id = ?')
				.bind(deltaBase, costoPorUnidadBase, presentacion.productoId)
		);
	}

	await db.batch(statements);
	return id;
}

export async function listProveedores(db: D1Database) {
	const result = await db
		.prepare('SELECT id, nombre FROM proveedores ORDER BY nombre ASC')
		.all<OpcionSimple>();
	return result.results;
}

export async function crearProveedorSiNoExiste(db: D1Database, nombre: string) {
	const existente = await db
		.prepare('SELECT id, nombre FROM proveedores WHERE nombre = ? COLLATE NOCASE')
		.bind(nombre)
		.first<OpcionSimple>();
	if (existente) return existente;
	const id = crypto.randomUUID();
	await db.prepare('INSERT INTO proveedores (id, nombre) VALUES (?, ?)').bind(id, nombre).run();
	return { id, nombre };
}
