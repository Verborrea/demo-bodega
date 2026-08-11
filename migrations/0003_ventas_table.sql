-- Migration number: 0003 	 2026-08-11T00:00:00.000Z

CREATE TABLE ventas (
	id TEXT PRIMARY KEY,
	fecha TEXT NOT NULL,
	hora TEXT NOT NULL,
	metodo TEXT NOT NULL,
	comprobante TEXT NOT NULL,
	numero_documento TEXT,
	cliente TEXT,
	total REAL NOT NULL,
	items TEXT NOT NULL,
	estado TEXT NOT NULL DEFAULT 'activa'
);

CREATE INDEX idx_ventas_fecha ON ventas(fecha);
