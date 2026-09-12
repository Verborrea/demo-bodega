export interface PromoItemDTO {
	id: string;
	productoId: string | null;
	nombreProducto: string;
	presentacionId: string | null;
	nombrePresentacion: string;
	factorUnidades: number;
	cantidad: number;
}

export interface PromoDTO {
	id: string;
	nombre: string;
	precio: number;
	stockDisponible: number;
	items: PromoItemDTO[];
}

interface RawPromoRow {
	id: string;
	nombre: string;
	precio: number;
	stockDisponible: number | null;
	itemsJson: string | null;
}

const PROMO_SELECT = `
	SELECT pr.id, pr.nombre, pr.precio,
		(SELECT MIN(pp.cantidad / pi.cantidad)
		 FROM promo_items pi
		 JOIN producto_presentaciones pp ON pp.id = pi.presentacion_id
		 WHERE pi.promo_id = pr.id) AS stockDisponible,
		(SELECT json_group_array(json_object(
				'id', id, 'productoId', producto_id, 'nombreProducto', nombre_producto,
				'presentacionId', presentacion_id, 'nombrePresentacion', nombre_presentacion,
				'factorUnidades', factor_unidades, 'cantidad', cantidad
			))
		 FROM (SELECT id, producto_id, nombre_producto, presentacion_id, nombre_presentacion,
		              factor_unidades, cantidad
		       FROM promo_items WHERE promo_id = pr.id)) AS itemsJson
	FROM promos pr
`;

function mapRow(row: RawPromoRow): PromoDTO {
	return {
		id: row.id,
		nombre: row.nombre,
		precio: row.precio,
		stockDisponible: row.stockDisponible ?? 0,
		items: row.itemsJson ? JSON.parse(row.itemsJson) : []
	};
}

export async function listPromos(db: D1Database): Promise<PromoDTO[]> {
	const result = await db.prepare(`${PROMO_SELECT} ORDER BY pr.nombre ASC`).all<RawPromoRow>();
	return result.results.map(mapRow);
}

export interface PromoItemInput {
	productoId: string;
	presentacionId: string;
	cantidad: number;
}

export interface CrearPromoInput {
	nombre: string;
	precio: number;
	items: PromoItemInput[];
}

interface PresentacionInfo {
	id: string;
	nombre: string;
	factorUnidades: number;
	productoId: string;
	productoNombre: string;
}

// El nombre del producto y el de la presentación se copian dentro de promo_items (igual
// que en venta_items): la promo se imprime y se vende con el texto que tenía al armarla,
// sin depender de un JOIN que puede perder la fila si el producto se borra después.
async function resolverPresentaciones(db: D1Database, items: PromoItemInput[]) {
	const presentacionIds = [...new Set(items.map((i) => i.presentacionId))];
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
	return new Map(presentacionesResult.results.map((p) => [p.id, p]));
}

function sentenciasDeItems(
	db: D1Database,
	promoId: string,
	items: PromoItemInput[],
	presentacionesPorId: Map<string, PresentacionInfo>
): D1PreparedStatement[] {
	return items.map((item) => {
		const presentacion = presentacionesPorId.get(item.presentacionId);
		if (!presentacion) throw new Error('Presentación no encontrada.');
		return db
			.prepare(
				`INSERT INTO promo_items
					(id, promo_id, producto_id, nombre_producto, presentacion_id, nombre_presentacion, factor_unidades, cantidad)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				crypto.randomUUID(),
				promoId,
				presentacion.productoId,
				presentacion.productoNombre,
				presentacion.id,
				presentacion.nombre,
				presentacion.factorUnidades,
				item.cantidad
			);
	});
}

export async function crearPromo(db: D1Database, data: CrearPromoInput): Promise<string> {
	if (data.items.length === 0) throw new Error('La promo debe tener al menos un producto.');

	const presentacionesPorId = await resolverPresentaciones(db, data.items);
	const id = crypto.randomUUID();

	await db.batch([
		db
			.prepare('INSERT INTO promos (id, nombre, precio) VALUES (?, ?, ?)')
			.bind(id, data.nombre, data.precio),
		...sentenciasDeItems(db, id, data.items, presentacionesPorId)
	]);
	return id;
}

// Los items se reemplazan enteros (borrar + insertar) en vez de casarlos uno a uno con
// los que ya estaban: el diálogo devuelve siempre la composición completa y nada apunta a
// un promo_item viejo — las ventas ya hechas guardan su propia copia en venta_items y solo
// referencian promo_id.
export async function actualizarPromo(db: D1Database, id: string, data: CrearPromoInput) {
	if (data.items.length === 0) throw new Error('La promo debe tener al menos un producto.');

	const promo = await db.prepare('SELECT id FROM promos WHERE id = ?').bind(id).first<{
		id: string;
	}>();
	if (!promo) throw new Error('PROMO_NO_EXISTE');

	const presentacionesPorId = await resolverPresentaciones(db, data.items);

	await db.batch([
		db
			.prepare('UPDATE promos SET nombre = ?, precio = ? WHERE id = ?')
			.bind(data.nombre, data.precio, id),
		db.prepare('DELETE FROM promo_items WHERE promo_id = ?').bind(id),
		...sentenciasDeItems(db, id, data.items, presentacionesPorId)
	]);
}

export async function eliminarPromo(db: D1Database, id: string) {
	await db.prepare('DELETE FROM promos WHERE id = ?').bind(id).run();
}
