-- Migration number: 0001 	 2026-08-10T21:51:26.693Z

CREATE TABLE proveedores (
	id TEXT PRIMARY KEY,
	nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE categorias (
	id TEXT PRIMARY KEY,
	nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE productos (
	id TEXT PRIMARY KEY,
	nombre TEXT NOT NULL,
	proveedor_id TEXT REFERENCES proveedores(id),
	categoria_id TEXT REFERENCES categorias(id),
	cantidad INTEGER NOT NULL DEFAULT 0,
	codigo_barras TEXT,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE precios (
	id TEXT PRIMARY KEY,
	producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
	nombre TEXT NOT NULL,
	valor REAL NOT NULL,
	orden INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_productos_nombre ON productos(nombre);
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_proveedor ON productos(proveedor_id);
CREATE UNIQUE INDEX idx_productos_codigo_barras ON productos(codigo_barras) WHERE codigo_barras IS NOT NULL;
CREATE INDEX idx_precios_producto ON precios(producto_id);
