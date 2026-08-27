export type ModoRecargo = 'soles' | 'porcentaje';

export interface ReglaRecargoDTO {
	id: string;
	nombre: string;
	categoriaIds: string[];
	categoriaNombres: string[];
	monto: number;
	modo: ModoRecargo;
	activo: boolean;
	activadoEn: string | null;
	activadoPor: string | null;
}

interface RawReglaRow {
	id: string;
	nombre: string;
	monto: number;
	modo: ModoRecargo;
	activo: number;
	activado_en: string | null;
	activado_por: string | null;
	categoriasJson: string | null;
}

const REGLA_SELECT = `
	SELECT r.id, r.nombre, r.monto, r.modo, r.activo, r.activado_en, r.activado_por,
		(SELECT json_group_array(json_object('id', id, 'nombre', nombre))
		 FROM (SELECT rc.categoria_id AS id, cat.nombre
		       FROM recargo_categorias rc JOIN categorias cat ON cat.id = rc.categoria_id
		       WHERE rc.recargo_id = r.id ORDER BY cat.nombre)) AS categoriasJson
	FROM recargos_precio r
`;

function mapRow(row: RawReglaRow): ReglaRecargoDTO {
	const categorias: { id: string; nombre: string }[] = row.categoriasJson
		? JSON.parse(row.categoriasJson)
		: [];
	return {
		id: row.id,
		nombre: row.nombre,
		categoriaIds: categorias.map((c) => c.id),
		categoriaNombres: categorias.map((c) => c.nombre),
		monto: row.monto,
		modo: row.modo,
		activo: row.activo === 1,
		activadoEn: row.activado_en,
		activadoPor: row.activado_por
	};
}

export async function listReglasRecargo(db: D1Database): Promise<ReglaRecargoDTO[]> {
	const result = await db.prepare(`${REGLA_SELECT} ORDER BY r.creado_en ASC`).all<RawReglaRow>();
	return result.results.map(mapRow);
}

async function obtenerReglaPorId(db: D1Database, id: string): Promise<ReglaRecargoDTO> {
	const row = await db.prepare(`${REGLA_SELECT} WHERE r.id = ?`).bind(id).first<RawReglaRow>();
	if (!row) throw new RecargoInvalidoError('Ese recargo ya no existe.');
	return mapRow(row);
}

export class RecargoInvalidoError extends Error {}

export interface AgregarReglaInput {
	nombre: string;
	categoriaIds: string[]; // vacío = todas las categorías
	monto: number;
	modo: ModoRecargo;
}

export async function agregarReglaRecargo(
	db: D1Database,
	data: AgregarReglaInput
): Promise<ReglaRecargoDTO> {
	const nombre = data.nombre.trim();
	if (!nombre) throw new RecargoInvalidoError('Ingresa un nombre para el recargo.');
	if (!data.monto) throw new RecargoInvalidoError('Ingresa un monto distinto de cero.');

	const id = crypto.randomUUID();
	const categoriaIds = [...new Set(data.categoriaIds)];
	await db.batch([
		db
			.prepare('INSERT INTO recargos_precio (id, nombre, monto, modo) VALUES (?, ?, ?, ?)')
			.bind(id, nombre, data.monto, data.modo),
		...categoriaIds.map((categoriaId) =>
			db
				.prepare('INSERT INTO recargo_categorias (recargo_id, categoria_id) VALUES (?, ?)')
				.bind(id, categoriaId)
		)
	]);

	return obtenerReglaPorId(db, id);
}

export async function eliminarReglaRecargo(db: D1Database, id: string): Promise<void> {
	// recargo_categorias se limpia sola por ON DELETE CASCADE.
	await db.prepare('DELETE FROM recargos_precio WHERE id = ?').bind(id).run();
}

/** Cada regla se prende/apaga por su cuenta (ej. "nocturno" y "feriado" son ocasiones
 * independientes) — no hay un interruptor único que las controle a todas juntas. */
export async function activarReglaRecargo(
	db: D1Database,
	id: string,
	activadoPor: string,
	sesionCajaId: string | null
): Promise<ReglaRecargoDTO> {
	// new Date().toISOString() (no datetime('now') de SQLite): el resto de la app guarda
	// fechas así — SQLite las devuelve "YYYY-MM-DD HH:MM:SS" sin 'Z', y algunos motores JS
	// parsean ese formato como hora LOCAL en vez de UTC, corriendo la hora mostrada.
	const ahora = new Date().toISOString();
	await db
		.prepare(
			`UPDATE recargos_precio SET activo = 1, activado_en = ?, activado_por = ?, sesion_caja_id = ?
			 WHERE id = ?`
		)
		.bind(ahora, activadoPor, sesionCajaId, id)
		.run();
	return obtenerReglaPorId(db, id);
}

export async function desactivarReglaRecargo(db: D1Database, id: string): Promise<ReglaRecargoDTO> {
	await db.prepare(`UPDATE recargos_precio SET activo = 0 WHERE id = ?`).bind(id).run();
	return obtenerReglaPorId(db, id);
}
