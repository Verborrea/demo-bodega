-- Backfill del kardex (movimientos_stock) con el historial anterior a la migración 0011.
--
-- CÓMO CORRERLO
--   Ensayo:      pnpm exec wrangler d1 execute tiendita-db --local  --file scripts/backfill-kardex.sql
--   Producción:  pnpm exec wrangler d1 execute tiendita-db --remote --file scripts/backfill-kardex.sql
--   Validar:     pnpm exec wrangler d1 execute tiendita-db --local|--remote --file scripts/validar-kardex.sql
--   Deshacer:    DELETE FROM movimientos_stock WHERE id LIKE 'bk-%';
--
-- Es idempotente por dos vías: cada fila lleva un id derivado de la fila de origen
-- ('bk-v-<venta_item_id>') y todos los INSERT son OR IGNORE, y además cada paso se saltea las
-- ventas y pedidos que YA tienen movimientos. Esa segunda guarda es la que permite correrlo
-- con el código nuevo ya desplegado: lo que la app registró en vivo no se vuelve a insertar
-- como fila de backfill (sin ella, toda venta posterior al despliegue quedaba contada dos
-- veces en el kardex). Lo que NO es
-- idempotente por sí solo es el saldo inicial (paso 5), que se calcula como residuo: por eso
-- también lleva id determinístico y solo entra una vez por presentación.
--
-- QUÉ RECONSTRUYE Y QUÉ NO
--   Sí:  ventas directas, ventas dentro de promo (contra promo_items), ingresos de pedidos,
--        y la devolución de las ventas anuladas.
--   No:  ajustes manuales de stock, ediciones de cantidad del formulario, el stock con el que
--        se dio de alta cada producto, y las ventas de promos que después se borraron
--        (al borrarlas, venta_items.promo_id quedó en NULL y promo_items se fue en cascada),
--        ni las líneas de productos ya eliminados del catálogo (producto_id en NULL).
--        Todo eso se concentra en la fila de "Saldo inicial" del paso 5.
--
-- Las fechas se normalizan a ISO con strftime porque conviven dos formatos en la base: lo que
-- escribe la app (new Date().toISOString(), con T y Z) y lo que pone el DEFAULT de SQLite
-- (datetime('now'), sin T ni Z). Ordenar por creado_en mezclando ambos daba un orden falso.

-- 1. Ventas directas (una línea por producto vendido suelto).
INSERT OR IGNORE INTO movimientos_stock
	(id, producto_id, nombre_producto, presentacion_id, nombre_presentacion,
	 factor_unidades, cantidad, unidades_base, tipo, venta_id, pedido_id, promo_id,
	 detalle, usuario_id, usuario_nombre, creado_en)
SELECT
	'bk-v-' || vi.id,
	vi.producto_id,
	vi.nombre_producto,
	vi.presentacion_id,
	vi.nombre_presentacion,
	vi.factor_unidades,
	-vi.cantidad,
	-vi.cantidad * vi.factor_unidades,
	'venta',
	v.id,
	NULL,
	NULL,
	CASE WHEN v.correlativo IS NOT NULL THEN 'Boleta #' || v.correlativo ELSE NULL END,
	v.cajero_id,
	v.cajero_nombre,
	strftime('%Y-%m-%dT%H:%M:%fZ', v.fecha)
FROM venta_items vi
JOIN ventas v ON v.id = vi.venta_id
WHERE vi.promo_id IS NULL
  AND vi.producto_id IS NOT NULL
  AND vi.presentacion_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM movimientos_stock m WHERE m.venta_id = v.id AND m.tipo = 'venta');

-- 2. Ventas dentro de una promo: la línea guarda cuántos combos salieron, el desglose está
--    en promo_items. Solo vale porque en producción las promos todavía no se podían editar;
--    si se hubieran editado, esto devolvería la composición de hoy y no la que salió.
INSERT OR IGNORE INTO movimientos_stock
	(id, producto_id, nombre_producto, presentacion_id, nombre_presentacion,
	 factor_unidades, cantidad, unidades_base, tipo, venta_id, pedido_id, promo_id,
	 detalle, usuario_id, usuario_nombre, creado_en)
SELECT
	'bk-p-' || vi.id || '-' || pi.id,
	pi.producto_id,
	pi.nombre_producto,
	pi.presentacion_id,
	pi.nombre_presentacion,
	pi.factor_unidades,
	-(pi.cantidad * vi.cantidad),
	-(pi.cantidad * vi.cantidad) * pi.factor_unidades,
	'venta',
	v.id,
	NULL,
	vi.promo_id,
	'Promo ' || vi.nombre_producto,
	v.cajero_id,
	v.cajero_nombre,
	strftime('%Y-%m-%dT%H:%M:%fZ', v.fecha)
FROM venta_items vi
JOIN ventas v ON v.id = vi.venta_id
JOIN promo_items pi ON pi.promo_id = vi.promo_id
WHERE vi.promo_id IS NOT NULL
  AND pi.producto_id IS NOT NULL
  AND pi.presentacion_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM movimientos_stock m WHERE m.venta_id = v.id AND m.tipo = 'venta');

-- 3. Devolución de las ventas anuladas: mismo desglose, al revés. La fecha real de la
--    anulación no se guardó (recién existe desde la migración 0012), así que se aproxima al
--    segundo siguiente de la venta y la fila lo dice.
INSERT OR IGNORE INTO movimientos_stock
	(id, producto_id, nombre_producto, presentacion_id, nombre_presentacion,
	 factor_unidades, cantidad, unidades_base, tipo, venta_id, pedido_id, promo_id,
	 detalle, usuario_id, usuario_nombre, creado_en)
SELECT
	'bk-a-' || m.id,
	m.producto_id,
	m.nombre_producto,
	m.presentacion_id,
	m.nombre_presentacion,
	m.factor_unidades,
	-m.cantidad,
	-m.unidades_base,
	'anulacion',
	m.venta_id,
	NULL,
	m.promo_id,
	'Anulación (fecha original no registrada)',
	m.usuario_id,
	m.usuario_nombre,
	strftime('%Y-%m-%dT%H:%M:%fZ', m.creado_en, '+1 second')
FROM movimientos_stock m
JOIN ventas v ON v.id = m.venta_id
WHERE (m.id LIKE 'bk-v-%' OR m.id LIKE 'bk-p-%')
  AND v.estado = 'anulada'
  AND NOT EXISTS (
      SELECT 1 FROM movimientos_stock a WHERE a.venta_id = m.venta_id AND a.tipo = 'anulacion');

-- 4. Ingresos de mercadería.
INSERT OR IGNORE INTO movimientos_stock
	(id, producto_id, nombre_producto, presentacion_id, nombre_presentacion,
	 factor_unidades, cantidad, unidades_base, tipo, venta_id, pedido_id, promo_id,
	 detalle, usuario_id, usuario_nombre, creado_en)
SELECT
	'bk-i-' || pei.id,
	pei.producto_id,
	pei.nombre_producto,
	pei.presentacion_id,
	pei.nombre_presentacion,
	pei.factor_unidades,
	pei.cantidad,
	pei.cantidad * pei.factor_unidades,
	'ingreso',
	NULL,
	pe.id,
	NULL,
	pe.proveedor_nombre,
	NULL,
	NULL,
	strftime('%Y-%m-%dT%H:%M:%fZ', pe.fecha)
FROM pedido_items pei
JOIN pedidos pe ON pe.id = pei.pedido_id
WHERE pei.producto_id IS NOT NULL
  AND pei.presentacion_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM movimientos_stock m WHERE m.pedido_id = pe.id);

-- 5. Saldo inicial: el residuo entre el stock real de cada presentación y todo lo que ya hay
--    en el kardex (lo reconstruido arriba MÁS lo que el código nuevo haya registrado desde
--    que se desplegó). Al calcularse como residuo, el kardex cierra exacto contra el
--    inventario por construcción, y lo irrecuperable queda concentrado y etiquetado en una
--    sola fila al principio de cada presentación, en vez de repartido como error invisible.
--    Puede salir negativo si hubo más ajustes hacia abajo que stock de alta; validar-kardex.sql
--    los lista aparte.
INSERT OR IGNORE INTO movimientos_stock
	(id, producto_id, nombre_producto, presentacion_id, nombre_presentacion,
	 factor_unidades, cantidad, unidades_base, tipo, venta_id, pedido_id, promo_id,
	 detalle, usuario_id, usuario_nombre, creado_en)
SELECT
	'bk-s-' || pp.id,
	pp.producto_id,
	p.nombre,
	pp.id,
	pp.nombre,
	pp.factor_unidades,
	pp.cantidad - COALESCE(
		(SELECT SUM(m.cantidad) FROM movimientos_stock m WHERE m.presentacion_id = pp.id), 0),
	(pp.cantidad - COALESCE(
		(SELECT SUM(m.cantidad) FROM movimientos_stock m WHERE m.presentacion_id = pp.id), 0)
	) * pp.factor_unidades,
	'inicial',
	NULL,
	NULL,
	NULL,
	'Saldo inicial (antes del kardex)',
	NULL,
	NULL,
	strftime('%Y-%m-%dT%H:%M:%fZ', pp.creado_en)
FROM producto_presentaciones pp
JOIN productos p ON p.id = pp.producto_id
WHERE pp.cantidad - COALESCE(
	(SELECT SUM(m.cantidad) FROM movimientos_stock m WHERE m.presentacion_id = pp.id), 0) <> 0;
