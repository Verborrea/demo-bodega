import { OFFSET_LIMA } from './fecha';

export type MetodoCaja = 'Efectivo' | 'Yape' | 'Tarjeta';
export const METODOS_CAJA: MetodoCaja[] = ['Efectivo', 'Yape', 'Tarjeta'];
export type TipoMovimiento = 'venta' | 'ingreso' | 'egreso';

export interface MovimientoDTO {
	id: string;
	tipo: TipoMovimiento;
	metodo: MetodoCaja;
	monto: number;
	descripcion: string;
	creadoEn: string;
}

export interface SesionCajaDTO {
	id: string;
	aperturaEn: string;
	cierreEn: string | null;
	cajeroId: string | null;
	cajeroNombre: string;
	montosIniciales: Record<MetodoCaja, number>;
	esperados: Record<MetodoCaja, number>;
	montosFinales: Record<MetodoCaja, number> | null;
	movimientos: MovimientoDTO[];
}

interface RawSesionRow {
	id: string;
	apertura_en: string;
	cierre_en: string | null;
	cajero_id: string | null;
	cajero_nombre: string;
	efectivo_inicial: number;
	yape_inicial: number;
	tarjeta_inicial: number;
	efectivo_esperado: number | null;
	yape_esperado: number | null;
	tarjeta_esperado: number | null;
	efectivo_final: number | null;
	yape_final: number | null;
	tarjeta_final: number | null;
}

interface RawMovimientoRow {
	id: string;
	tipo: TipoMovimiento;
	metodo: MetodoCaja;
	monto: number;
	descripcion: string;
	creado_en: string;
}

function mapMovimiento(row: RawMovimientoRow): MovimientoDTO {
	return {
		id: row.id,
		tipo: row.tipo,
		metodo: row.metodo,
		monto: row.monto,
		descripcion: row.descripcion,
		creadoEn: row.creado_en
	};
}

async function montosEsperadosEnVivo(
	db: D1Database,
	sesionId: string,
	iniciales: Record<MetodoCaja, number>
): Promise<Record<MetodoCaja, number>> {
	const result = await db
		.prepare(
			`SELECT metodo, SUM(CASE WHEN tipo = 'egreso' THEN -monto ELSE monto END) AS neto
			 FROM caja_movimientos WHERE sesion_id = ? GROUP BY metodo`
		)
		.bind(sesionId)
		.all<{ metodo: MetodoCaja; neto: number }>();

	const esperados = { ...iniciales };
	for (const fila of result.results) {
		esperados[fila.metodo] = (esperados[fila.metodo] ?? 0) + fila.neto;
	}
	return esperados;
}

export async function obtenerSesionAbierta(db: D1Database): Promise<SesionCajaDTO | null> {
	const row = await db
		.prepare('SELECT * FROM caja_sesiones WHERE abierta = 1 LIMIT 1')
		.first<RawSesionRow>();
	if (!row) return null;

	const iniciales = {
		Efectivo: row.efectivo_inicial,
		Yape: row.yape_inicial,
		Tarjeta: row.tarjeta_inicial
	};

	const [movimientosResult, esperados] = await Promise.all([
		db
			.prepare(
				'SELECT id, tipo, metodo, monto, descripcion, creado_en FROM caja_movimientos WHERE sesion_id = ? ORDER BY creado_en DESC'
			)
			.bind(row.id)
			.all<RawMovimientoRow>(),
		montosEsperadosEnVivo(db, row.id, iniciales)
	]);

	return {
		id: row.id,
		aperturaEn: row.apertura_en,
		cierreEn: null,
		cajeroId: row.cajero_id,
		cajeroNombre: row.cajero_nombre,
		montosIniciales: iniciales,
		esperados,
		montosFinales: null,
		movimientos: movimientosResult.results.map(mapMovimiento)
	};
}

export interface MontosCaja {
	efectivo: number;
	yape: number;
	tarjeta: number;
}

export interface CajeroInfo {
	id: string;
	nombre: string;
}

export async function abrirSesion(
	db: D1Database,
	montos: MontosCaja,
	cajero: CajeroInfo
): Promise<string> {
	const abierta = await obtenerSesionAbierta(db);
	if (abierta) throw new Error('Ya hay una sesión de caja abierta.');

	const id = crypto.randomUUID();
	await db
		.prepare(
			`INSERT INTO caja_sesiones (id, abierta, apertura_en, cajero_id, cajero_nombre, efectivo_inicial, yape_inicial, tarjeta_inicial)
			 VALUES (?, 1, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			id,
			new Date().toISOString(),
			cajero.id,
			cajero.nombre,
			montos.efectivo,
			montos.yape,
			montos.tarjeta
		)
		.run();
	return id;
}

export async function cerrarSesion(db: D1Database, montosFinales: MontosCaja) {
	const sesion = await obtenerSesionAbierta(db);
	if (!sesion) throw new Error('No hay ninguna sesión de caja abierta.');

	// Cada regla de recargo temporal de precio (ver recargos.ts) que esté activa se apaga
	// al cerrar caja, sin excepción — así ninguna queda prendida por accidente para el
	// turno del día siguiente. UPDATE directo (no una función de recargos.ts) para que
	// viaje en el mismo db.batch que el cierre (atómico: o cierran los dos, o ninguno).
	const ahora = new Date().toISOString();
	await db.batch([
		db
			.prepare(
				`UPDATE caja_sesiones SET
					abierta = 0,
					cierre_en = ?,
					efectivo_esperado = ?, yape_esperado = ?, tarjeta_esperado = ?,
					efectivo_final = ?, yape_final = ?, tarjeta_final = ?
				 WHERE id = ?`
			)
			.bind(
				ahora,
				sesion.esperados.Efectivo,
				sesion.esperados.Yape,
				sesion.esperados.Tarjeta,
				montosFinales.efectivo,
				montosFinales.yape,
				montosFinales.tarjeta,
				sesion.id
			),
		db.prepare(`UPDATE recargos_precio SET activo = 0 WHERE activo = 1`)
	]);
}

// Si se corrige el pago de una venta que pertenece a una sesión YA cerrada, sus montos
// "esperados" quedaron congelados en el cierre y no se recalculan solos (a diferencia de
// una sesión abierta, que siempre los calcula en vivo desde caja_movimientos). Sin esto,
// corregir el método de pago de una venta antigua dejaría la caja cerrada con un cuadre
// desactualizado.
export async function recalcularEsperadosSiCerrada(db: D1Database, sesionId: string) {
	const sesion = await db
		.prepare(
			'SELECT abierta, efectivo_inicial, yape_inicial, tarjeta_inicial FROM caja_sesiones WHERE id = ?'
		)
		.bind(sesionId)
		.first<{
			abierta: number;
			efectivo_inicial: number;
			yape_inicial: number;
			tarjeta_inicial: number;
		}>();
	if (!sesion || sesion.abierta === 1) return;

	const iniciales = {
		Efectivo: sesion.efectivo_inicial,
		Yape: sesion.yape_inicial,
		Tarjeta: sesion.tarjeta_inicial
	};
	const esperados = await montosEsperadosEnVivo(db, sesionId, iniciales);
	await db
		.prepare(
			'UPDATE caja_sesiones SET efectivo_esperado = ?, yape_esperado = ?, tarjeta_esperado = ? WHERE id = ?'
		)
		.bind(esperados.Efectivo, esperados.Yape, esperados.Tarjeta, sesionId)
		.run();
}

export interface RegistrarMovimientoInput {
	tipo: 'ingreso' | 'egreso';
	metodo: MetodoCaja;
	monto: number;
	descripcion: string;
}

export async function registrarMovimiento(db: D1Database, datos: RegistrarMovimientoInput) {
	const sesion = await obtenerSesionAbierta(db);
	if (!sesion) throw new Error('No hay ninguna sesión de caja abierta.');

	await db
		.prepare(
			`INSERT INTO caja_movimientos (id, sesion_id, tipo, metodo, monto, descripcion)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.bind(crypto.randomUUID(), sesion.id, datos.tipo, datos.metodo, datos.monto, datos.descripcion)
		.run();
}

export interface ListarHistorialParams {
	page: number;
	pageSize: number;
	cajeroId?: string;
	fechaInicio?: string;
	fechaFin?: string;
}

export async function listHistorialCaja(db: D1Database, params: ListarHistorialParams) {
	const { page, pageSize, cajeroId, fechaInicio, fechaFin } = params;
	const offset = (page - 1) * pageSize;

	const whereClauses: string[] = ['abierta = 0'];
	const whereValues: unknown[] = [];
	if (cajeroId) {
		whereClauses.push('cajero_id = ?');
		whereValues.push(cajeroId);
	}
	if (fechaInicio) {
		whereClauses.push(`date(apertura_en, '${OFFSET_LIMA}') >= date(?)`);
		whereValues.push(fechaInicio);
	}
	if (fechaFin) {
		whereClauses.push(`date(apertura_en, '${OFFSET_LIMA}') <= date(?)`);
		whereValues.push(fechaFin);
	}
	const where = `WHERE ${whereClauses.join(' AND ')}`;

	const [listResult, countResult] = await Promise.all([
		db
			.prepare(`SELECT * FROM caja_sesiones ${where} ORDER BY cierre_en DESC LIMIT ? OFFSET ?`)
			.bind(...whereValues, pageSize, offset)
			.all<RawSesionRow>(),
		db
			.prepare(`SELECT count(*) AS total FROM caja_sesiones ${where}`)
			.bind(...whereValues)
			.first<{ total: number }>()
	]);

	const sesiones: SesionCajaDTO[] = listResult.results.map((row) => ({
		id: row.id,
		aperturaEn: row.apertura_en,
		cierreEn: row.cierre_en,
		cajeroId: row.cajero_id,
		cajeroNombre: row.cajero_nombre,
		montosIniciales: {
			Efectivo: row.efectivo_inicial,
			Yape: row.yape_inicial,
			Tarjeta: row.tarjeta_inicial
		},
		esperados: {
			Efectivo: row.efectivo_esperado ?? 0,
			Yape: row.yape_esperado ?? 0,
			Tarjeta: row.tarjeta_esperado ?? 0
		},
		montosFinales: {
			Efectivo: row.efectivo_final ?? 0,
			Yape: row.yape_final ?? 0,
			Tarjeta: row.tarjeta_final ?? 0
		},
		movimientos: []
	}));

	return { sesiones, total: countResult?.total ?? 0 };
}
