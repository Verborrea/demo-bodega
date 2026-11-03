// Perú no usa horario de verano: un offset fijo UTC-5 es seguro todo el año. `fecha` en
// las tablas se guarda con new Date().toISOString() (UTC), y el 'now' de SQLite también
// es UTC — sin este offset, el corte de "día" quedaba 5 horas antes de la medianoche
// real en Lima, así que una venta hecha entre las 7pm y medianoche se contaba en el
// día siguiente.
export const OFFSET_LIMA = '-5 hours';

// Inverso de OFFSET_LIMA: para calcular un límite tipo "inicio del año en hora Lima" sin
// envolver la columna `fecha` en una función (y así seguir usando el índice), se arma el
// límite completo en UTC: 'now' → restar 5h (llevar a hora Lima) → truncar → sumar 5h
// (volver a UTC). Ese último paso usa este offset.
export const OFFSET_LIMA_INVERSO = '+5 hours';

/**
 * Hoy en fecha-calendario de Lima ('YYYY-MM-DD'). El servidor corre en UTC, así que entre
 * las 7pm y la medianoche de Lima un `new Date()` pelado ya está en el día siguiente.
 */
export function hoyLima(): string {
	return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Fecha ('YYYY-MM-DD') y hora ('HH:MM:SS') en hora de Lima, a partir de un ISO UTC
 * guardado en la base (mismo truco que hoyLima(): restar el offset antes de formatear). */
export function fechaHoraLima(iso: string): { fecha: string; hora: string } {
	const limaIso = new Date(new Date(iso).getTime() - 5 * 60 * 60 * 1000).toISOString();
	return { fecha: limaIso.slice(0, 10), hora: limaIso.slice(11, 19) };
}

/** Días de calendario (Lima) completos entre la fecha de `iso` y hoy. */
export function diasCalendarioLimaDesde(iso: string): number {
	const msPorDia = 24 * 60 * 60 * 1000;
	return Math.round(
		(new Date(hoyLima()).getTime() - new Date(fechaHoraLima(iso).fecha).getTime()) / msPorDia
	);
}

/** Día de calendario ('YYYY-MM-DD', fecha UTC del instante) de un ISO recibido por la API; null si
 * no es una fecha válida. Es lo mismo que hacía `date(?)` en SQL con el valor del cliente. */
export function diaDeIso(iso: string | undefined): string | null {
	if (!iso) return null;
	const t = new Date(iso);
	return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10);
}

/** Instante UTC (ISO) en que EMPIEZA el día `dia` ('YYYY-MM-DD') en hora de Lima. Filtrar con
 * `fecha >= inicioDiaLimaUtc(d)` equivale a `date(fecha, '-5 hours') >= d`, pero deja usar el
 * índice de `fecha` en vez de evaluar date() sobre cada fila. */
export function inicioDiaLimaUtc(dia: string): string {
	return `${dia}T05:00:00.000Z`;
}

/** Instante UTC (ISO) en que empieza el día SIGUIENTE a `dia` en Lima: cota exclusiva para "hasta
 * ese día inclusive" (`fecha < ...` equivale a `date(fecha, '-5 hours') <= dia`). */
export function inicioDiaSiguienteLimaUtc(dia: string): string {
	const [anio, mes, dd] = dia.split('-').map(Number);
	return inicioDiaLimaUtc(new Date(Date.UTC(anio, mes - 1, dd + 1)).toISOString().slice(0, 10));
}
