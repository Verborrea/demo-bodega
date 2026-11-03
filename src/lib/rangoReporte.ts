/**
 * Los reportes con rango de fechas (Reportes → Productos/Caja y la exportación de Ventas) no pasan de
 * 3 meses: un rango más largo hace leer y armar miles de filas de más — en D1, en el servidor y en el
 * navegador que genera el PDF/Excel — para un informe que nadie lee entero. Módulo compartido entre
 * el cliente (que ajusta el selector antes de pedir nada) y el servidor (que lo exige igual).
 */
export const MESES_MAX_REPORTE = 3;
export const MENSAJE_RANGO_MAXIMO = `El rango máximo es de ${MESES_MAX_REPORTE} meses.`;

/** Suma meses a un día 'YYYY-MM-DD' conservando el día del mes, o el último del mes destino si ese
 * día no existe (30 nov + 3 meses → 28 feb). */
export function sumarMeses(dia: string, meses: number): string {
	const [anio, mes, diaDelMes] = dia.split('-').map(Number);
	const destino = new Date(Date.UTC(anio, mes - 1 + meses, 1));
	const ultimoDiaDelDestino = new Date(
		Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)
	).getUTCDate();
	destino.setUTCDate(Math.min(diaDelMes, ultimoDiaDelDestino));
	return destino.toISOString().slice(0, 10);
}

/** Último día que puede tener un rango que empieza en `desde`: el mismo día del mes, tres meses
 * después (3 ago → 3 nov), inclusive. */
export function hastaMaximo(desde: string): string {
	return sumarMeses(desde, MESES_MAX_REPORTE);
}

export function rangoExcedeMaximo(desde: string, hasta: string): boolean {
	return hasta > hastaMaximo(desde);
}
