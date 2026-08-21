-- Migration number: 0004 	 2026-08-21T00:00:03.000Z

CREATE TABLE ventas (
	id TEXT PRIMARY KEY,
	fecha TEXT NOT NULL DEFAULT (datetime('now')),
	tipo TEXT NOT NULL DEFAULT 'nota_pedido',
	metodo TEXT NOT NULL,
	numero_documento TEXT,
	cliente TEXT,
	total REAL NOT NULL,
	estado TEXT NOT NULL DEFAULT 'activa',
	cajero_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
	cajero_nombre TEXT NOT NULL,
	sesion_caja_id TEXT REFERENCES caja_sesiones(id) ON DELETE SET NULL,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ventas_fecha ON ventas(fecha DESC);
CREATE INDEX idx_ventas_sesion ON ventas(sesion_caja_id);

CREATE TABLE venta_items (
	id TEXT PRIMARY KEY,
	venta_id TEXT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
	producto_id TEXT REFERENCES productos(id) ON DELETE SET NULL,
	nombre_producto TEXT NOT NULL,
	presentacion_id TEXT REFERENCES producto_presentaciones(id) ON DELETE SET NULL,
	nombre_presentacion TEXT NOT NULL,
	factor_unidades INTEGER NOT NULL,
	cantidad INTEGER NOT NULL,
	precio_unitario REAL NOT NULL,
	subtotal REAL NOT NULL,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_venta_items_venta ON venta_items(venta_id);
CREATE INDEX idx_venta_items_producto ON venta_items(producto_id);
