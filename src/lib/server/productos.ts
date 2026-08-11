export interface Precio {
	id: string;
	nombre: string;
	valor: number;
}

export interface ProductoDTO {
	id: string;
	nombre: string;
	proveedorId: string | null;
	proveedor: string | null;
	categoriaId: string | null;
	categoria: string | null;
	cantidad: number;
	codigoBarras: string | null;
	precios: Precio[];
}

interface RawProductoRow {
	id: string;
	nombre: string;
	cantidad: number;
	codigoBarras: string | null;
	proveedorId: string | null;
	proveedor: string | null;
	categoriaId: string | null;
	categoria: string | null;
	preciosJson: string | null;
}

const PRODUCTO_SELECT = `
	SELECT p.id, p.nombre, p.cantidad, p.codigo_barras AS codigoBarras,
		p.proveedor_id AS proveedorId, prov.nombre AS proveedor,
		p.categoria_id AS categoriaId, cat.nombre AS categoria,
		(SELECT json_group_array(json_object('id', id, 'nombre', nombre, 'valor', valor))
		 FROM (SELECT id, nombre, valor FROM precios WHERE producto_id = p.id ORDER BY orden)) AS preciosJson
	FROM productos p
	LEFT JOIN proveedores prov ON prov.id = p.proveedor_id
	LEFT JOIN categorias cat ON cat.id = p.categoria_id
`;

function mapRow(row: RawProductoRow): ProductoDTO {
	return {
		id: row.id,
		nombre: row.nombre,
		proveedorId: row.proveedorId,
		proveedor: row.proveedor,
		categoriaId: row.categoriaId,
		categoria: row.categoria,
		cantidad: row.cantidad,
		codigoBarras: row.codigoBarras,
		precios: row.preciosJson ? JSON.parse(row.preciosJson) : []
	};
}

export interface ListarProductosParams {
	page: number;
	pageSize: number;
	search: string;
	categoriaId: string;
	proveedorId: string;
}

export async function listProductos(db: D1Database, params: ListarProductosParams) {
	const { page, pageSize, search, categoriaId, proveedorId } = params;
	const offset = (page - 1) * pageSize;

	const whereClauses: string[] = [];
	const whereValues: unknown[] = [];
	if (search) {
		whereClauses.push('p.nombre LIKE ?');
		whereValues.push(`%${search}%`);
	}
	if (categoriaId) {
		whereClauses.push('p.categoria_id = ?');
		whereValues.push(categoriaId);
	}
	if (proveedorId) {
		whereClauses.push('p.proveedor_id = ?');
		whereValues.push(proveedorId);
	}
	const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

	const listSql = `${PRODUCTO_SELECT} ${where} ORDER BY p.nombre ASC LIMIT ? OFFSET ?`;
	const countSql = `SELECT count(*) AS total FROM productos p ${where}`;

	const [listResult, countResult] = await Promise.all([
		db
			.prepare(listSql)
			.bind(...whereValues, pageSize, offset)
			.all<RawProductoRow>(),
		db
			.prepare(countSql)
			.bind(...whereValues)
			.first<{ total: number }>()
	]);

	return {
		productos: listResult.results.map(mapRow),
		total: countResult?.total ?? 0
	};
}

export async function buscarPorCodigoBarras(db: D1Database, codigo: string) {
	const row = await db
		.prepare(`${PRODUCTO_SELECT} WHERE p.codigo_barras = ?`)
		.bind(codigo)
		.first<RawProductoRow>();
	return row ? mapRow(row) : null;
}

export interface CrearProductoInput {
	nombre: string;
	proveedorId: string;
	categoriaId: string;
	cantidad: number;
	codigoBarras: string | null;
	precios: { nombre: string; valor: number }[];
}

export async function crearProducto(db: D1Database, data: CrearProductoInput): Promise<string> {
	const id = crypto.randomUUID();
	const statements = [
		db
			.prepare(
				'INSERT INTO productos (id, nombre, proveedor_id, categoria_id, cantidad, codigo_barras) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.bind(id, data.nombre, data.proveedorId, data.categoriaId, data.cantidad, data.codigoBarras),
		...data.precios.map((precio, index) =>
			db
				.prepare(
					'INSERT INTO precios (id, producto_id, nombre, valor, orden) VALUES (?, ?, ?, ?, ?)'
				)
				.bind(crypto.randomUUID(), id, precio.nombre, precio.valor, index)
		)
	];
	await db.batch(statements);
	return id;
}

export async function actualizarProducto(db: D1Database, id: string, data: CrearProductoInput) {
	const statements = [
		db
			.prepare(
				'UPDATE productos SET nombre = ?, proveedor_id = ?, categoria_id = ?, cantidad = ?, codigo_barras = ? WHERE id = ?'
			)
			.bind(data.nombre, data.proveedorId, data.categoriaId, data.cantidad, data.codigoBarras, id),
		db.prepare('DELETE FROM precios WHERE producto_id = ?').bind(id),
		...data.precios.map((precio, index) =>
			db
				.prepare(
					'INSERT INTO precios (id, producto_id, nombre, valor, orden) VALUES (?, ?, ?, ?, ?)'
				)
				.bind(crypto.randomUUID(), id, precio.nombre, precio.valor, index)
		)
	];
	await db.batch(statements);
}

export async function eliminarProducto(db: D1Database, id: string) {
	await db.prepare('DELETE FROM productos WHERE id = ?').bind(id).run();
}

export async function ajustarStock(db: D1Database, id: string, delta: number) {
	const row = await db
		.prepare('UPDATE productos SET cantidad = MAX(0, cantidad + ?) WHERE id = ? RETURNING cantidad')
		.bind(delta, id)
		.first<{ cantidad: number }>();
	return row?.cantidad ?? null;
}

export interface OpcionSimple {
	id: string;
	nombre: string;
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

export async function listCategorias(db: D1Database) {
	const result = await db
		.prepare('SELECT id, nombre FROM categorias ORDER BY nombre ASC')
		.all<OpcionSimple>();
	return result.results;
}

export async function crearCategoriaSiNoExiste(db: D1Database, nombre: string) {
	const existente = await db
		.prepare('SELECT id, nombre FROM categorias WHERE nombre = ? COLLATE NOCASE')
		.bind(nombre)
		.first<OpcionSimple>();
	if (existente) return existente;
	const id = crypto.randomUUID();
	await db.prepare('INSERT INTO categorias (id, nombre) VALUES (?, ?)').bind(id, nombre).run();
	return { id, nombre };
}
