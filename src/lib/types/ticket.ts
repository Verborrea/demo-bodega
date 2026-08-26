export interface ItemTicket {
	id: string;
	cantidad: number;
	nombreProducto: string;
	precioUnitario: number;
}

export interface VentaTicket {
	tipo: string;
	esBoleta: boolean;
	/** Serie-correlativo del comprobante (ej. "B001-00000123"), null si no es boleta. */
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
