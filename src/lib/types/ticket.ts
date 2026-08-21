export interface ItemTicket {
	id: string;
	cantidad: number;
	nombreProducto: string;
	precioUnitario: number;
}

export interface VentaTicket {
	tipo: string;
	numeroDocumento?: string | null;
	cliente?: string | null;
	fechaLabel: string;
	horaLabel: string;
	pago: string;
	items: ItemTicket[];
	total: number;
}
