import type { TipoVenta } from '$lib/server/ventas';

export interface ItemTicket {
	id: string;
	cantidad: number;
	nombreProducto: string;
	precioUnitario: number;
}

export interface VentaTicket {
	tipo: TipoVenta;
	/** Serie-correlativo del comprobante (ej. "B001-00000123"), null si no es un comprobante electrónico. */
	numeroComprobante?: string | null;
	sunatEstado?: 'no_aplica' | 'pendiente' | 'aceptado' | 'rechazado';
	/** Documento del CLIENTE (DNI/RUC), no el número del comprobante. */
	numeroDocumento?: string | null;
	cliente?: string | null;
	fechaLabel: string;
	horaLabel: string;
	pago: string;
	items: ItemTicket[];
	total: number;
}
