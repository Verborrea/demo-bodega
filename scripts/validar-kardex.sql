-- Validación del kardex después del backfill (scripts/backfill-kardex.sql).
--   pnpm exec wrangler d1 execute tiendita-db --local|--remote --file scripts/validar-kardex.sql
--
-- Las consultas 1 y 2 TIENEN que dar 0. La 3, 4 y 5 son para mirar, no para aprobar.
--
-- Todo va con LEFT JOIN + GROUP BY y no con subconsultas correlacionadas: la primera versión
-- usaba subconsultas y contra D1 remoto se pasaba de los 300s (una pasada por movimientos_stock
-- por cada presentación). Así es una sola pasada.

-- 1. Descuadres por presentación: el saldo de cada presentación contra la suma de su kardex.
--    Es lo que el saldo inicial cierra por construcción, así que cualquier fila acá es un
--    error del backfill.
SELECT COUNT(*) AS presentaciones_descuadradas FROM (
	SELECT pp.id, pp.cantidad - COALESCE(SUM(m.cantidad), 0) AS diferencia
	FROM producto_presentaciones pp
	LEFT JOIN movimientos_stock m ON m.presentacion_id = pp.id
	GROUP BY pp.id, pp.cantidad
) WHERE diferencia <> 0;

-- 2. Lo mismo a nivel producto, en unidades sueltas.
SELECT COUNT(*) AS productos_descuadrados FROM (
	SELECT p.id, p.cantidad - COALESCE(SUM(m.unidades_base), 0) AS diferencia
	FROM productos p
	LEFT JOIN movimientos_stock m ON m.producto_id = p.id
	GROUP BY p.id, p.cantidad
) WHERE diferencia <> 0;

-- 3. Productos donde los DOS contadores de stock ya venían desincronizados entre sí
--    (productos.cantidad contra la suma de sus presentaciones). Esto no lo causa el backfill:
--    es anterior, y lo saca a la luz. Si la consulta 2 da > 0, es acá donde está la razón.
SELECT nombre, stock_producto, suma_presentaciones FROM (
	SELECT p.id, p.nombre, p.cantidad AS stock_producto,
		COALESCE(SUM(pp.cantidad * pp.factor_unidades), 0) AS suma_presentaciones
	FROM productos p
	LEFT JOIN producto_presentaciones pp ON pp.producto_id = p.id
	GROUP BY p.id, p.nombre, p.cantidad
) WHERE stock_producto <> suma_presentaciones
ORDER BY ABS(stock_producto - suma_presentaciones) DESC
LIMIT 30;

-- 4. Saldos iniciales negativos: el producto tuvo más ajustes hacia abajo que stock de alta.
--    No rompe nada (el kardex cierra igual), pero vale la pena mirarlos.
SELECT nombre_producto, nombre_presentacion, cantidad AS saldo_inicial
FROM movimientos_stock
WHERE tipo = 'inicial' AND cantidad < 0
ORDER BY cantidad ASC
LIMIT 30;

-- 5. Resumen de lo que quedó cargado.
SELECT tipo, COUNT(*) AS filas, SUM(unidades_base) AS unidades_netas
FROM movimientos_stock
GROUP BY tipo
ORDER BY tipo;
