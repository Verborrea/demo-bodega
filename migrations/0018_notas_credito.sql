-- Migration number: 0018 	 2026-10-07T00:00:00.000Z

-- Nota de crédito electrónica por anulación de la operación (código 01) sobre una boleta.
-- Un contribuyente del Nuevo RUS puede emitir notas de crédito, pero solo vinculadas a
-- boletas (RS 340-2017/SUNAT). Una boleta ya entregada al cliente o con más de 5 días de
-- emitida no se puede dar de baja con resumen diario: se anula con esto.
--
-- Serie propia (BC01: la B indica que modifica una boleta) con su contador atómico, igual
-- que B001 (ver contadores_documentos en la migración 0009).
INSERT OR IGNORE INTO contadores_documentos (serie, ultimo_correlativo) VALUES ('BC01', 0);

CREATE TABLE notas_credito (
	id TEXT PRIMARY KEY,
	venta_id TEXT NOT NULL REFERENCES ventas(id),
	serie TEXT NOT NULL,
	correlativo INTEGER NOT NULL,
	-- Fecha en que se emite la nota (no la de la boleta): la que se le declara a apisunat.pe.
	fecha TEXT NOT NULL,
	-- pendiente | aceptado | rechazado — mismo criterio que ventas.sunat_estado.
	estado TEXT NOT NULL DEFAULT 'pendiente',
	hash TEXT,
	error TEXT,
	xml_url TEXT,
	cdr_url TEXT,
	pdf_ticket_url TEXT,
	pdf_a4_url TEXT,
	actualizado_en TEXT,
	UNIQUE (serie, correlativo)
);

-- Una boleta se anula una sola vez (anulación total): una única nota por venta.
CREATE UNIQUE INDEX idx_notas_credito_venta ON notas_credito(venta_id);
