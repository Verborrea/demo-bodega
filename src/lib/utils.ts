export function currency(value: number) {
	return `S/ ${value.toFixed(2)}`;
}

/**
 * Igual que currency() pero sin espacio ("S/45.00"). Solo para tickets/pedidos impresos:
 * en el driver de texto plano de la impresora térmica, el espacio entre "S/" y el monto
 * se trataba como punto de corte de línea y partía el precio en dos.
 */
export function currencyImpresion(value: number) {
	return `S/${value.toFixed(2)}`;
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

/**
 * Espera a que las <img> dentro de `selector` terminen de cargar antes de imprimir.
 * Sin esto, `window.print()` puede tomar la instantánea antes de que el logo
 * (servido como archivo aparte, no inlineado) termine de descargarse.
 */
export async function esperarImagenesListas(selector: string): Promise<void> {
	const imagenes = document.querySelectorAll<HTMLImageElement>(`${selector} img`);
	await Promise.all(Array.from(imagenes).map((img) => img.decode().catch(() => {})));
}

/** "Efectivo" si es un solo pago, o "Efectivo S/10.00 + Yape S/5.00" si está fraccionado. Solo para impresión. */
export function formatPagos(pagos: { metodo: string; monto: number }[]): string {
	if (pagos.length <= 1) return pagos[0]?.metodo ?? '';
	return pagos.map((p) => `${p.metodo} ${currencyImpresion(p.monto)}`).join(' + ');
}

/**
 * Ganancia de la presentación base contra el último costo registrado (ya normalizado a
 * costo por unidad base, ver crearPedido). null si el producto todavía no tiene costo.
 */
export function calcularGanancia(costoUltimo: number | null, precioVenta: number) {
	if (costoUltimo === null || costoUltimo <= 0) return null;
	const monto = precioVenta - costoUltimo;
	const porcentaje = (monto / costoUltimo) * 100;
	return { monto, porcentaje };
}
