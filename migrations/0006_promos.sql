-- Migration number: 0006 	 2026-08-21T00:00:05.000Z

-- Una promo es un atajo: varios productos (con su presentación y cantidad)
-- vendidos juntos a un precio fijo, ej. "Coca Cola + Oreos: S/5". Vive en su
-- propia tabla y se vende/imprime como una sola línea, pero descuenta stock
-- de cada producto que la compone (ver guardarVenta en src/lib/server/ventas.ts).
CREATE TABLE promos (
	id TEXT PRIMARY KEY,
	nombre TEXT NOT NULL,
	precio REAL NOT NULL,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE promo_items (
	id TEXT PRIMARY KEY,
	promo_id TEXT NOT NULL REFERENCES promos(id) ON DELETE CASCADE,
	producto_id TEXT REFERENCES productos(id) ON DELETE SET NULL,
	nombre_producto TEXT NOT NULL,
	presentacion_id TEXT REFERENCES producto_presentaciones(id) ON DELETE SET NULL,
	nombre_presentacion TEXT NOT NULL,
	factor_unidades INTEGER NOT NULL,
	cantidad INTEGER NOT NULL
);

CREATE INDEX idx_promo_items_promo ON promo_items(promo_id);

-- Cuando una venta incluye una promo, se guarda como una sola fila en
-- venta_items (nombre_producto = nombre de la promo) en vez de una fila por
-- cada producto que la compone; promo_id la distingue para reportes.
ALTER TABLE venta_items ADD COLUMN promo_id TEXT REFERENCES promos(id) ON DELETE SET NULL;
