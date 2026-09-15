-- Migration number: 0011 	 2026-09-13T00:00:00.000Z

-- Kardex: una fila por cada movimiento de stock, venga de donde venga. Hasta acá el
-- inventario solo guardaba el SALDO (productos.cantidad y producto_presentaciones.cantidad)
-- y el rastro había que reconstruirlo desde venta_items/pedido_items — que además dejaba
-- fuera los ajustes manuales (ver ajustarStockPresentacion y actualizarProducto en
-- src/lib/server/productos.ts): el stock cambiaba sin dejar huella y el saldo no cuadraba
-- con la suma de los movimientos conocidos.
--
-- Las columnas de nombre son copias del momento del movimiento (mismo criterio que
-- venta_items): el kardex tiene que seguir leyéndose aunque después se renombre el
-- producto o se lo borre del catálogo.
CREATE TABLE movimientos_stock (
	id TEXT PRIMARY KEY,
	producto_id TEXT REFERENCES productos(id) ON DELETE SET NULL,
	nombre_producto TEXT NOT NULL,
	presentacion_id TEXT REFERENCES producto_presentaciones(id) ON DELETE SET NULL,
	nombre_presentacion TEXT NOT NULL,
	factor_unidades INTEGER NOT NULL,
	-- Ambas con signo: positivo entra, negativo sale. `cantidad` va en unidades de ESA
	-- presentación (3 cajas) y `unidades_base` en unidades sueltas (3 × 6 = 18), que es la
	-- moneda común en la que se lleva el saldo del producto.
	cantidad INTEGER NOT NULL,
	unidades_base INTEGER NOT NULL,
	-- venta | anulacion | ingreso | ajuste | edicion
	tipo TEXT NOT NULL,
	venta_id TEXT REFERENCES ventas(id) ON DELETE SET NULL,
	pedido_id TEXT REFERENCES pedidos(id) ON DELETE SET NULL,
	-- Cuando la unidad salió dentro de un combo. Es la razón de fondo por la que anularVenta
	-- ya no reconstruye el desglose contra promo_items: desde que las promos se pueden
	-- editar, esa reconstrucción devolvía la composición de HOY y no la que realmente salió.
	promo_id TEXT REFERENCES promos(id) ON DELETE SET NULL,
	detalle TEXT,
	usuario_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
	usuario_nombre TEXT,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- El kardex siempre entra por producto y en orden cronológico inverso.
CREATE INDEX idx_movimientos_producto ON movimientos_stock(producto_id, creado_en DESC);
-- anularVenta levanta los movimientos de una venta para revertirlos exactamente.
CREATE INDEX idx_movimientos_venta ON movimientos_stock(venta_id);
