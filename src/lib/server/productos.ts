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
	costoUltimo: number | null;
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
	costoUltimo: number | null;
	presentacionesJson: string | null;
}

const PRODUCTO_SELECT = `
	SELECT p.id, p.nombre, p.cantidad, p.codigo_barras AS codigoBarras, p.costo_ultimo AS costoUltimo,
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
		costoUltimo: row.costoUltimo,
		presentaciones,
		presentacionBaseId: presentaciones.find((p) => p.factorUnidades === 1)?.id ?? null
	};
}

// Mapa único de acentos → sin acento, usado tanto para armar la expresión SQL de la
// columna como para normalizar el término de búsqueda, así "cafe"/"café" encuentran lo
// mismo. SQLite no tiene un LOWER()/unaccent que sepa de tildes sin una extensión, así
// que se resuelve con REPLACE() encadenados (la tabla es chica, un full scan ya existía
// de todos modos por el LIKE '%...%' con comodín al inicio, que tampoco usa índice).
const MAPA_ACENTOS: [string, string][] = [
	['á', 'a'],
	['é', 'e'],
	['í', 'i'],
	['ó', 'o'],
	['ú', 'u'],
	['ñ', 'n'],
	['Á', 'a'],
	['É', 'e'],
	['Í', 'i'],
	['Ó', 'o'],
	['Ú', 'u'],
	['Ñ', 'n']
];

function sqlSinAcentos(columna: string): string {
	return MAPA_ACENTOS.reduce((sql, [con, sin]) => `REPLACE(${sql}, '${con}', '${sin}')`, columna);
}

function quitarAcentos(texto: string): string {
	return MAPA_ACENTOS.reduce((t, [con, sin]) => t.split(con).join(sin), texto);
}

export type OrdenProducto = 'nombre' | 'categoria' | 'cantidad' | 'costo';

// Whitelist de columna → SQL real: nunca se interpola orderBy directo (vendría del
// querystring de la API), así se evita inyección por ese lado.
const ORDEN_PRODUCTO_SQL: Record<OrdenProducto, string> = {
	nombre: 'p.nombre',
	categoria: 'cat.nombre',
	cantidad: 'p.cantidad',
	costo: 'p.costo_ultimo'
};

export interface ListarProductosParams {
	page: number;
	pageSize: number;
	search: string;
	categoriaId: string;
	marcaId: string;
	orderBy?: OrdenProducto;
	orderDir?: 'asc' | 'desc';
}

export async function listProductos(db: D1Database, params: ListarProductosParams) {
	const { page, pageSize, search, categoriaId, marcaId, orderBy, orderDir } = params;
	const offset = (page - 1) * pageSize;
	const columnaOrden = ORDEN_PRODUCTO_SQL[orderBy ?? 'nombre'];
	const direccionOrden = orderDir === 'desc' ? 'DESC' : 'ASC';

	const whereClauses: string[] = [];
	const whereValues: unknown[] = [];
	if (search) {
		// Un código escaneado llega completo y solo dígitos: en ese caso se busca con "="
		// exacto contra el índice único idx_productos_codigo_barras (sin full scan, no importa
		// cuánto crezca la tabla) en vez de meterlo como otro LIKE '%...%' en el OR de abajo,
		// que hubiera obligado a escanear la tabla completa igual que el nombre.
		if (/^\d{4,}$/.test(search)) {
			whereClauses.push('p.codigo_barras = ?');
			whereValues.push(search);
		} else {
			whereClauses.push(`${sqlSinAcentos('p.nombre')} LIKE ?`);
			whereValues.push(`%${quitarAcentos(search)}%`);
		}
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

	const listSql = `${PRODUCTO_SELECT} ${where} ORDER BY ${columnaOrden} ${direccionOrden}, p.nombre ASC LIMIT ? OFFSET ?`;
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
	const row = await db
		.prepare(`${PRODUCTO_SELECT} WHERE p.id = ?`)
		.bind(id)
		.first<RawProductoRow>();
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
	cantidadInicial?: number; // stock inicial, solo al crear el producto
	cantidad?: number; // nueva cantidad absoluta de esta presentación, solo al editar
}

export interface CrearProductoInput {
	nombre: string;
	marcaId: string | null;
	categoriaId: string;
	codigoBarras: string | null;
	costoUltimo?: number | null;
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
				'INSERT INTO productos (id, nombre, marca_id, categoria_id, cantidad, codigo_barras, costo_ultimo) VALUES (?, ?, ?, ?, ?, ?, ?)'
			)
			.bind(
				id,
				data.nombre,
				data.marcaId,
				data.categoriaId,
				cantidadTotal,
				data.codigoBarras,
				data.costoUltimo ?? null
			),
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
			const nuevaCantidad = p.cantidad ?? cantidadActual;
			cantidadTotal += nuevaCantidad * p.factorUnidades;
			statements.push(
				db
					.prepare(
						'UPDATE producto_presentaciones SET nombre = ?, factor_unidades = ?, precio = ?, cantidad = ? WHERE id = ?'
					)
					.bind(p.nombre, p.factorUnidades, p.precio, nuevaCantidad, p.id)
			);
		} else {
			const nuevoId = crypto.randomUUID();
			const cantidadNueva = p.cantidad ?? 0;
			cantidadTotal += cantidadNueva * p.factorUnidades;
			statements.push(
				db
					.prepare(
						'INSERT INTO producto_presentaciones (id, producto_id, nombre, factor_unidades, precio, cantidad, orden) VALUES (?, ?, ?, ?, ?, ?, ?)'
					)
					.bind(nuevoId, id, p.nombre, p.factorUnidades, p.precio, cantidadNueva, statements.length)
			);
		}
	}

	for (const existente of existentes.results) {
		if (!idsEnviados.has(existente.id)) {
			statements.push(
				db.prepare('DELETE FROM producto_presentaciones WHERE id = ?').bind(existente.id)
			);
		}
	}

	statements.push(
		db
			.prepare(
				'UPDATE productos SET nombre = ?, marca_id = ?, categoria_id = ?, codigo_barras = ?, cantidad = ?, costo_ultimo = ? WHERE id = ?'
			)
			.bind(
				data.nombre,
				data.marcaId,
				data.categoriaId,
				data.codigoBarras,
				cantidadTotal,
				data.costoUltimo ?? null,
				id
			)
	);

	await db.batch(statements);
}

export async function eliminarProducto(db: D1Database, id: string) {
	await db.prepare('DELETE FROM productos WHERE id = ?').bind(id).run();
}

export async function ajustarStockPresentacion(
	db: D1Database,
	presentacionId: string,
	delta: number
) {
	const presentacion = await db
		.prepare(
			'SELECT producto_id, factor_unidades, cantidad FROM producto_presentaciones WHERE id = ?'
		)
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
			.prepare(
				'UPDATE productos SET cantidad = MAX(0, cantidad + ?) WHERE id = ? RETURNING cantidad'
			)
			.bind(deltaBase, presentacion.producto_id)
	]);

	const productoCantidad =
		(productoRow.results[0] as { cantidad: number } | undefined)?.cantidad ?? null;
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

export interface CategoriaConConteo extends OpcionSimple {
	productos: number;
	/** Cuántos modos de precio nombran esta categoría (se les quitará de la lista). */
	modos: number;
	/** Nombres de los modos que aplican SOLO a esta categoría: al borrarla se eliminan. */
	modosAEliminar: string[];
}

interface RawCategoriaRow extends OpcionSimple {
	productos: number;
	modos: number;
	modosAEliminarJson: string | null;
}

// Una regla de recargo sin ninguna categoría aplica a TODAS (ver migración 0010), así que
// borrar una categoría no puede limitarse a dejar caer el ON DELETE CASCADE de
// recargo_categorias: la regla que se quedara vacía pasaría de aplicar a una categoría a
// aplicar a todo el catálogo. Por eso se separan los dos casos y la pantalla los avisa
// antes de confirmar (ver eliminarCategoria).
export async function listCategoriasConConteo(db: D1Database): Promise<CategoriaConConteo[]> {
	const result = await db
		.prepare(
			`SELECT c.id, c.nombre,
				(SELECT COUNT(*) FROM productos p WHERE p.categoria_id = c.id) AS productos,
				(SELECT COUNT(*) FROM recargo_categorias rc
				 WHERE rc.categoria_id = c.id) AS modos,
				(SELECT json_group_array(r.nombre)
				 FROM recargo_categorias rc
				 JOIN recargos_precio r ON r.id = rc.recargo_id
				 WHERE rc.categoria_id = c.id
				   AND (SELECT COUNT(*) FROM recargo_categorias rc2
				        WHERE rc2.recargo_id = rc.recargo_id) = 1) AS modosAEliminarJson
			 FROM categorias c ORDER BY c.nombre ASC`
		)
		.all<RawCategoriaRow>();

	return result.results.map((row) => ({
		id: row.id,
		nombre: row.nombre,
		productos: row.productos,
		modos: row.modos,
		modosAEliminar: row.modosAEliminarJson ? JSON.parse(row.modosAEliminarJson) : []
	}));
}

export interface ProductoDeCategoria {
	id: string;
	nombre: string;
	marca: string | null;
	cantidad: number;
}

export async function listProductosDeCategoria(db: D1Database, categoriaId: string) {
	const result = await db
		.prepare(
			`SELECT p.id, p.nombre, marc.nombre AS marca, p.cantidad
			 FROM productos p
			 LEFT JOIN marcas marc ON marc.id = p.marca_id
			 WHERE p.categoria_id = ?
			 ORDER BY p.nombre ASC`
		)
		.bind(categoriaId)
		.all<ProductoDeCategoria>();
	return result.results;
}

// Renombrar, quitar y agregar productos viajan juntos porque son el "Guardar" de un
// mismo diálogo: o se aplica todo o no se aplica nada. Quitar un producto no lo borra,
// solo lo deja sin categoría (categoria_id = NULL); agregarlo lo mueve desde la que
// tuviera antes, porque un producto pertenece a una sola categoría.
export async function actualizarCategoria(
	db: D1Database,
	id: string,
	data: { nombre?: string; productosQuitados?: string[]; productosAgregados?: string[] }
): Promise<OpcionSimple> {
	const categoria = await db
		.prepare('SELECT id, nombre FROM categorias WHERE id = ?')
		.bind(id)
		.first<OpcionSimple>();
	if (!categoria) throw new Error('CATEGORIA_NO_EXISTE');

	const nombre = data.nombre?.trim();
	const sentencias: D1PreparedStatement[] = [];

	if (nombre && nombre !== categoria.nombre) {
		const duplicada = await db
			.prepare('SELECT id FROM categorias WHERE nombre = ? COLLATE NOCASE AND id <> ?')
			.bind(nombre, id)
			.first<{ id: string }>();
		if (duplicada) throw new Error('CATEGORIA_DUPLICADA');
		sentencias.push(db.prepare('UPDATE categorias SET nombre = ? WHERE id = ?').bind(nombre, id));
	}

	const quitados = data.productosQuitados ?? [];
	if (quitados.length > 0) {
		const marcadores = quitados.map(() => '?').join(', ');
		sentencias.push(
			db
				.prepare(
					`UPDATE productos SET categoria_id = NULL
					 WHERE categoria_id = ? AND id IN (${marcadores})`
				)
				.bind(id, ...quitados)
		);
	}

	const agregados = data.productosAgregados ?? [];
	if (agregados.length > 0) {
		const marcadores = agregados.map(() => '?').join(', ');
		sentencias.push(
			db
				.prepare(`UPDATE productos SET categoria_id = ? WHERE id IN (${marcadores})`)
				.bind(id, ...agregados)
		);
	}

	if (sentencias.length > 0) await db.batch(sentencias);
	return { id, nombre: nombre || categoria.nombre };
}

// Los productos NO se borran: quedan sin categoría, igual que si se los sacara uno por
// uno desde el diálogo. Con los modos de precio hay dos casos:
//   - el modo apunta a varias categorías → basta con sacarle esta (lo hace el ON DELETE
//     CASCADE de recargo_categorias);
//   - el modo apuntaba SOLO a esta → se elimina la regla entera, porque quedarse sin
//     categorías la convertiría en un recargo sobre todo el catálogo (migración 0010).
export async function eliminarCategoria(db: D1Database, id: string) {
	const huerfanos = await db
		.prepare(
			`SELECT rc.recargo_id AS id FROM recargo_categorias rc
			 WHERE rc.categoria_id = ?
			   AND (SELECT COUNT(*) FROM recargo_categorias rc2
			        WHERE rc2.recargo_id = rc.recargo_id) = 1`
		)
		.bind(id)
		.all<{ id: string }>();

	const sentencias: D1PreparedStatement[] = [
		db.prepare('UPDATE productos SET categoria_id = NULL WHERE categoria_id = ?').bind(id)
	];

	const idsHuerfanos = huerfanos.results.map((r) => r.id);
	if (idsHuerfanos.length > 0) {
		const marcadores = idsHuerfanos.map(() => '?').join(', ');
		sentencias.push(
			db.prepare(`DELETE FROM recargos_precio WHERE id IN (${marcadores})`).bind(...idsHuerfanos)
		);
	}

	sentencias.push(db.prepare('DELETE FROM categorias WHERE id = ?').bind(id));
	await db.batch(sentencias);

	return { modosEliminados: idsHuerfanos.length };
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
