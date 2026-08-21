export interface PresentacionDTO {
	id: string;
	nombre: string;
	factorUnidades: number;
	precio: number;
	cantidad: number;
}

export interface ProductoDTO {
	id: string;
	nombre: string;
	marcaId: string | null;
	marca: string | null;
	categoriaId: string | null;
	categoria: string | null;
	cantidad: number;
	codigoBarras: string | null;
	presentaciones: PresentacionDTO[];
	presentacionBaseId: string | null;
}

interface RawProductoRow {
	id: string;
	nombre: string;
	cantidad: number;
	codigoBarras: string | null;
	marcaId: string | null;
	marca: string | null;
	categoriaId: string | null;
	categoria: string | null;
	presentacionesJson: string | null;
}

const PRODUCTO_SELECT = `
	SELECT p.id, p.nombre, p.cantidad, p.codigo_barras AS codigoBarras,
		p.marca_id AS marcaId, marc.nombre AS marca,
		p.categoria_id AS categoriaId, cat.nombre AS categoria,
		(SELECT json_group_array(json_object(
				'id', id, 'nombre', nombre, 'factorUnidades', factor_unidades,
				'precio', precio, 'cantidad', cantidad
			))
		 FROM (SELECT id, nombre, factor_unidades, precio, cantidad
		       FROM producto_presentaciones WHERE producto_id = p.id ORDER BY orden)) AS presentacionesJson
	FROM productos p
	LEFT JOIN marcas marc ON marc.id = p.marca_id
	LEFT JOIN categorias cat ON cat.id = p.categoria_id
`;

function mapRow(row: RawProductoRow): ProductoDTO {
	const presentaciones: PresentacionDTO[] = row.presentacionesJson
		? JSON.parse(row.presentacionesJson)
		: [];
	return {
		id: row.id,
		nombre: row.nombre,
		marcaId: row.marcaId,
		marca: row.marca,
		categoriaId: row.categoriaId,
		categoria: row.categoria,
		cantidad: row.cantidad,
		codigoBarras: row.codigoBarras,
		presentaciones,
		presentacionBaseId: presentaciones.find((p) => p.factorUnidades === 1)?.id ?? null
	};
}

export interface ListarProductosParams {
	page: number;
	pageSize: number;
	search: string;
	categoriaId: string;
	marcaId: string;
}

export async function listProductos(db: D1Database, params: ListarProductosParams) {
	const { page, pageSize, search, categoriaId, marcaId } = params;
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
	if (marcaId) {
		whereClauses.push('p.marca_id = ?');
		whereValues.push(marcaId);
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

export async function obtenerProducto(db: D1Database, id: string) {
	const row = await db.prepare(`${PRODUCTO_SELECT} WHERE p.id = ?`).bind(id).first<RawProductoRow>();
	return row ? mapRow(row) : null;
}

export async function buscarPorCodigoBarras(db: D1Database, codigo: string) {
	const row = await db
		.prepare(`${PRODUCTO_SELECT} WHERE p.codigo_barras = ?`)
		.bind(codigo)
		.first<RawProductoRow>();
	return row ? mapRow(row) : null;
}

export interface PresentacionInput {
	id?: string;
	nombre: string;
	factorUnidades: number;
	precio: number;
	cantidadInicial?: number;
}

export interface CrearProductoInput {
	nombre: string;
	marcaId: string | null;
	categoriaId: string;
	codigoBarras: string | null;
	presentaciones: PresentacionInput[];
}

function validarPresentacionBase(presentaciones: PresentacionInput[]) {
	const base = presentaciones.filter((p) => p.factorUnidades === 1);
	if (base.length !== 1) {
		throw new Error('Debe existir exactamente una presentación base (factor 1, ej. "Unidad").');
	}
}

export async function crearProducto(db: D1Database, data: CrearProductoInput): Promise<string> {
	validarPresentacionBase(data.presentaciones);
	const id = crypto.randomUUID();
	const cantidadTotal = data.presentaciones.reduce(
		(acc, p) => acc + (p.cantidadInicial ?? 0) * p.factorUnidades,
		0
	);

	const statements = [
		db
			.prepare(
				'INSERT INTO productos (id, nombre, marca_id, categoria_id, cantidad, codigo_barras) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.bind(id, data.nombre, data.marcaId, data.categoriaId, cantidadTotal, data.codigoBarras),
		...data.presentaciones.map((p, index) =>
			db
				.prepare(
					'INSERT INTO producto_presentaciones (id, producto_id, nombre, factor_unidades, precio, cantidad, orden) VALUES (?, ?, ?, ?, ?, ?, ?)'
				)
				.bind(
					crypto.randomUUID(),
					id,
					p.nombre,
					p.factorUnidades,
					p.precio,
					p.cantidadInicial ?? 0,
					index
				)
		)
	];
	await db.batch(statements);
	return id;
}

export async function actualizarProducto(db: D1Database, id: string, data: CrearProductoInput) {
	validarPresentacionBase(data.presentaciones);

	const existentes = await db
		.prepare('SELECT id, cantidad FROM producto_presentaciones WHERE producto_id = ?')
		.bind(id)
		.all<{ id: string; cantidad: number }>();
	const existentesPorId = new Map(existentes.results.map((r) => [r.id, r.cantidad]));

	const idsEnviados = new Set(data.presentaciones.filter((p) => p.id).map((p) => p.id));
	for (const existente of existentes.results) {
		if (!idsEnviados.has(existente.id) && existente.cantidad > 0) {
			throw new Error(
				'No se puede quitar una presentación con stock. Ajusta su stock a 0 antes de eliminarla.'
			);
		}
	}

	const statements = [];
	let cantidadTotal = 0;

	for (const p of data.presentaciones) {
		if (p.id && existentesPorId.has(p.id)) {
			const cantidadActual = existentesPorId.get(p.id)!;
			cantidadTotal += cantidadActual * p.factorUnidades;
			statements.push(
				db
					.prepare(
						'UPDATE producto_presentaciones SET nombre = ?, factor_unidades = ?, precio = ? WHERE id = ?'
					)
					.bind(p.nombre, p.factorUnidades, p.precio, p.id)
			);
		} else {
			const nuevoId = crypto.randomUUID();
			statements.push(
				db
					.prepare(
						'INSERT INTO producto_presentaciones (id, producto_id, nombre, factor_unidades, precio, cantidad, orden) VALUES (?, ?, ?, ?, ?, 0, ?)'
					)
					.bind(nuevoId, id, p.nombre, p.factorUnidades, p.precio, statements.length)
			);
		}
	}

	for (const existente of existentes.results) {
		if (!idsEnviados.has(existente.id)) {
			statements.push(db.prepare('DELETE FROM producto_presentaciones WHERE id = ?').bind(existente.id));
		}
	}

	statements.push(
		db
			.prepare(
				'UPDATE productos SET nombre = ?, marca_id = ?, categoria_id = ?, codigo_barras = ?, cantidad = ? WHERE id = ?'
			)
			.bind(data.nombre, data.marcaId, data.categoriaId, data.codigoBarras, cantidadTotal, id)
	);

	await db.batch(statements);
}

export async function eliminarProducto(db: D1Database, id: string) {
	await db.prepare('DELETE FROM productos WHERE id = ?').bind(id).run();
}

export async function ajustarStockPresentacion(db: D1Database, presentacionId: string, delta: number) {
	const presentacion = await db
		.prepare('SELECT producto_id, factor_unidades, cantidad FROM producto_presentaciones WHERE id = ?')
		.bind(presentacionId)
		.first<{ producto_id: string; factor_unidades: number; cantidad: number }>();
	if (!presentacion) throw new Error('Presentación no encontrada.');

	const nuevaCantidad = Math.max(0, presentacion.cantidad + delta);
	const deltaBase = (nuevaCantidad - presentacion.cantidad) * presentacion.factor_unidades;

	const [, productoRow] = await db.batch([
		db
			.prepare('UPDATE producto_presentaciones SET cantidad = ? WHERE id = ?')
			.bind(nuevaCantidad, presentacionId),
		db
			.prepare('UPDATE productos SET cantidad = MAX(0, cantidad + ?) WHERE id = ? RETURNING cantidad')
			.bind(deltaBase, presentacion.producto_id)
	]);

	const productoCantidad = (productoRow.results[0] as { cantidad: number } | undefined)?.cantidad ?? null;
	return { presentacionCantidad: nuevaCantidad, productoCantidad };
}

export interface OpcionSimple {
	id: string;
	nombre: string;
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

export async function listMarcas(db: D1Database) {
	const result = await db
		.prepare('SELECT id, nombre FROM marcas ORDER BY nombre ASC')
		.all<OpcionSimple>();
	return result.results;
}

export async function crearMarcaSiNoExiste(db: D1Database, nombre: string) {
	const existente = await db
		.prepare('SELECT id, nombre FROM marcas WHERE nombre = ? COLLATE NOCASE')
		.bind(nombre)
		.first<OpcionSimple>();
	if (existente) return existente;
	const id = crypto.randomUUID();
	await db.prepare('INSERT INTO marcas (id, nombre) VALUES (?, ?)').bind(id, nombre).run();
	return { id, nombre };
}
