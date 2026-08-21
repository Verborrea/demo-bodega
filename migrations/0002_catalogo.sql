-- Migration number: 0002 	 2026-08-21T00:00:01.000Z

CREATE TABLE categorias (
	id TEXT PRIMARY KEY,
	nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE marcas (
	id TEXT PRIMARY KEY,
	nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE proveedores (
	id TEXT PRIMARY KEY,
	nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE productos (
	id TEXT PRIMARY KEY,
	nombre TEXT NOT NULL,
	marca_id TEXT REFERENCES marcas(id),
	categoria_id TEXT REFERENCES categorias(id),
	cantidad INTEGER NOT NULL DEFAULT 0,
	codigo_barras TEXT,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_productos_nombre ON productos(nombre);
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_marca ON productos(marca_id);
CREATE UNIQUE INDEX idx_productos_codigo_barras ON productos(codigo_barras) WHERE codigo_barras IS NOT NULL;

-- Cada producto puede tener varias presentaciones (Unidad, Caja, Sixpack...),
-- cada una con su propia equivalencia en unidades base, precio sugerido y
-- stock actual EN esa presentación. Debe existir siempre una presentación
-- base (factor_unidades = 1); el índice único de abajo evita que haya más de una.
CREATE TABLE producto_presentaciones (
	id TEXT PRIMARY KEY,
	producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
	nombre TEXT NOT NULL,
	factor_unidades INTEGER NOT NULL,
	precio REAL NOT NULL,
	cantidad INTEGER NOT NULL DEFAULT 0,
	orden INTEGER NOT NULL DEFAULT 0,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_presentaciones_producto ON producto_presentaciones(producto_id);
CREATE UNIQUE INDEX idx_presentaciones_base ON producto_presentaciones(producto_id) WHERE factor_unidades = 1;
