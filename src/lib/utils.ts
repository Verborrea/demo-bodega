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

/** Fecha corta y humana, ej. "25 ago 2026", en hora local. */
export function formatFecha(fecha: string | Date): string {
	const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
	return d
		.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
		.replace('.', '');
}

/**
 * Igual que formatFecha() pero para un string "YYYY-MM-DD" SIN hora (ej. lo que devuelven
 * los reportes agrupados por día). new Date("YYYY-MM-DD") interpreta ese string como
 * medianoche UTC, y en una zona con offset negativo (Lima, UTC-5) eso se muestra como el
 * día ANTERIOR — por eso acá se arman las partes con el constructor local en vez de parsear
 * el string directo.
 */
export function formatFechaSolo(fechaYYYYMMDD: string): string {
	const [anio, mes, dia] = fechaYYYYMMDD.split('-').map(Number);
	return formatFecha(new Date(anio, mes - 1, dia));
}

/** Fecha + hora humanas, ej. "25 ago 2026, 02:32 p. m.", en hora local. */
export function formatFechaHora(fecha: string | Date): string {
	return `${formatFecha(fecha)}, ${formatHora(fecha)}`;
}

/** Solo la hora, ej. "02:32 p. m.", en hora local. */
export function formatHora(fecha: string | Date): string {
	const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
	return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
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

interface ReglaRecargoLike {
	categoriaIds: string[];
	monto: number;
	modo: 'soles' | 'porcentaje';
	activo: boolean;
}

/**
 * Precio efectivo de venta con el recargo temporal aplicado — cada regla se activa por su
 * cuenta (ej. "nocturno" y "feriado" son ocasiones independientes, no un interruptor único
 * para todas) y puede cubrir varias categorías a la vez, así que acá se busca entre las
 * reglas ACTIVAS una que incluya la categoría del producto, o una sin categorías (aplica a
 * "todas") si no hay ninguna específica (la específica gana si existen las dos). Nunca
 * toca el precio guardado en producto_presentaciones — solo se usa al armar el carrito en
 * Nueva Venta, así el recargo desaparece solo al desactivar esa regla puntual, sin dejar
 * rastro en el catálogo.
 */
export function precioConRecargo(
	precioBase: number,
	categoriaId: string | null,
	reglas: ReglaRecargoLike[] | null | undefined
): number {
	if (!reglas?.length) return precioBase;
	const activas = reglas.filter((r) => r.activo);
	const regla =
		activas.find((r) => categoriaId !== null && r.categoriaIds.includes(categoriaId)) ??
		activas.find((r) => r.categoriaIds.length === 0);
	if (!regla) return precioBase;
	const ajustado =
		regla.modo === 'soles' ? precioBase + regla.monto : precioBase * (1 + regla.monto / 100);
	return Math.max(0, Math.round(ajustado * 100) / 100);
}
