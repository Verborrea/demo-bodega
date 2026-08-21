export function currency(value: number) {
	return `S/ ${value.toFixed(2)}`;
}

/** Formatea un datetime ISO como "dd/mm/aaaa hh:mm" en hora local. */
export function formatFechaHora(iso: string): string {
	const fecha = new Date(iso);
	const fechaStr = fecha.toLocaleDateString('es-PE', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});
	const horaStr = fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
	return `${fechaStr} ${horaStr}`;
}

/** Solo la hora, ej. "14:32", en hora local. */
export function formatHora(iso: string): string {
	return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}