export interface ItemVentaDTO {
	nombre: string;
	cantidad: number;
	precioUnitario: number;
}

export type EstadoVenta = 'activa' | 'anulada';

export interface VentaDTO {
	id: string;
	fecha: string;
	hora: string;
	metodo: string;
	comprobante: string;
	numeroDocumento: string | null;
	cliente: string | null;
	total: number;
	items: ItemVentaDTO[];
	estado: EstadoVenta;
}

interface RawVentaRow {
	id: string;
	fecha: string;
	hora: string;
	metodo: string;
	comprobante: string;
	numero_documento: string | null;
	cliente: string | null;
	total: number;
	items: string;
	estado: EstadoVenta;
}

function mapRow(row: RawVentaRow): VentaDTO {
	return {
		id: row.id,
		fecha: row.fecha,
		hora: row.hora,
		metodo: row.metodo,
		comprobante: row.comprobante,
		numeroDocumento: row.numero_documento,
		cliente: row.cliente,
		total: row.total,
		items: JSON.parse(row.items),
		estado: row.estado
	};
}

export async function listVentas(db: D1Database, limit = 200) {
	const result = await db
		.prepare('SELECT * FROM ventas ORDER BY fecha DESC LIMIT ?')
		.bind(limit)
		.all<RawVentaRow>();
	return result.results.map(mapRow);
}

export interface GuardarVentaInput {
	metodo: string;
	comprobante: string;
	numeroDocumento: string | null;
	cliente: string | null;
	total: number;
	items: ItemVentaDTO[];
}

function horaActual() {
	return new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

export async function guardarVenta(db: D1Database, data: GuardarVentaInput): Promise<string> {
	const id = crypto.randomUUID();
	await db
		.prepare(
			`INSERT INTO ventas (id, fecha, hora, metodo, comprobante, numero_documento, cliente, total, items, estado)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'activa')`
		)
		.bind(
			id,
			new Date().toISOString(),
			horaActual(),
			data.metodo,
			data.comprobante,
			data.numeroDocumento,
			data.cliente,
			data.total,
			JSON.stringify(data.items)
		)
		.run();
	return id;
}
