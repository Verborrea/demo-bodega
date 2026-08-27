-- Migration number: 0010 	 2026-08-27T12:00:00.000Z

-- Reglas de recargo temporal de precio, con nombre propio (ej. "Recargo por feriados",
-- "Recargo nocturno") — cada una puede aplicar a VARIAS categorías a la vez (ver
-- recargo_categorias abajo), y CADA UNA con su propio activo/inactivo: son ocasiones
-- independientes (nocturno, feriado...), no un interruptor único para todas a la vez. Se
-- administran desde Inventario → Recargo, mismo patrón que "Promos". Nunca tocan
-- producto_presentaciones.precio: el recargo se suma en el momento de la venta (ver
-- precioConRecargo en src/lib/utils.ts), no se guarda como precio permanente — apagar la
-- regla alcanza para volver al precio normal.
-- activo/activado_en/activado_por/sesion_caja_id son togglables durante el turno por
-- cualquier rol logueado (cajera o admin, ver hooks.server.ts); crear/editar/eliminar
-- reglas es admin-only. Cada regla activa se apaga sola al cerrar caja (ver cerrarSesion
-- en caja.ts), sin excepción.
CREATE TABLE recargos_precio (
	id TEXT PRIMARY KEY,
	nombre TEXT NOT NULL,
	monto REAL NOT NULL,
	modo TEXT NOT NULL DEFAULT 'soles',
	activo INTEGER NOT NULL DEFAULT 0,
	activado_en TEXT,
	activado_por TEXT,
	sesion_caja_id TEXT REFERENCES caja_sesiones(id) ON DELETE SET NULL,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Categorías a las que aplica cada recargo. Un recargo SIN ninguna fila acá aplica a
-- TODAS las categorías (equivalente al categoria_id NULL de la versión anterior).
CREATE TABLE recargo_categorias (
	recargo_id TEXT NOT NULL REFERENCES recargos_precio(id) ON DELETE CASCADE,
	categoria_id TEXT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
	PRIMARY KEY (recargo_id, categoria_id)
);
