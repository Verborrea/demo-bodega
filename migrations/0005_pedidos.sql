-- Migration number: 0005 	 2026-08-21T00:00:04.000Z

-- "Ingreso de Mercadería": cada pedido es una compra a un proveedor con
-- varias líneas de producto. Guardar el pedido es lo que da entrada al
-- stock (ver src/lib/server/pedidos.ts).
CREATE TABLE pedidos (
	id TEXT PRIMARY KEY,
	codigo TEXT,
	proveedor_id TEXT REFERENCES proveedores(id) ON DELETE SET NULL,
	proveedor_nombre TEXT NOT NULL,
	fecha TEXT NOT NULL DEFAULT (datetime('now')),
	notas TEXT,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_pedidos_fecha ON pedidos(fecha DESC);
CREATE INDEX idx_pedidos_proveedor ON pedidos(proveedor_id);

CREATE TABLE pedido_items (
	id TEXT PRIMARY KEY,
	pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
	producto_id TEXT REFERENCES productos(id) ON DELETE SET NULL,
	nombre_producto TEXT NOT NULL,
	presentacion_id TEXT REFERENCES producto_presentaciones(id) ON DELETE SET NULL,
	nombre_presentacion TEXT NOT NULL,
	factor_unidades INTEGER NOT NULL,
	cantidad INTEGER NOT NULL,
	costo_unitario REAL NOT NULL,
	subtotal REAL NOT NULL,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_pedido_items_pedido ON pedido_items(pedido_id);
CREATE INDEX idx_pedido_items_producto ON pedido_items(producto_id);
