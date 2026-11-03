-- Migration number: 0019 	 2026-11-03T00:00:00.000Z

-- El listado de Ventas arma, por cada fila que muestra, los pagos de esa venta con
--   SELECT metodo, monto FROM caja_movimientos WHERE venta_id = ? AND tipo = 'venta' ORDER BY creado_en
-- y caja_movimientos solo tenía índices por sesion_id: cada una de esas 20 búsquedas por página
-- recorría la tabla ENTERA (20 × ~12 mil filas ≈ 235 mil lecturas por carga, y creciendo con cada
-- venta). Era ~60% de todas las filas que lee la base. Con este índice cada búsqueda es directa.
-- También lo aprovechan anularVenta y corregirPagoVenta (DELETE ... WHERE venta_id = ? AND tipo = 'venta')
-- y la FK ON DELETE SET NULL de caja_movimientos.venta_id.
CREATE INDEX IF NOT EXISTS idx_caja_movimientos_venta ON caja_movimientos(venta_id, tipo, creado_en);
