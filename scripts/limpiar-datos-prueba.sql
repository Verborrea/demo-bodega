-- Borra solo datos operativos de prueba (cajas, ventas, pedidos). Se conservan intactos:
-- productos, producto_presentaciones, marcas, categorias, proveedores, usuarios, promos.
-- Orden pensado para respetar FKs (hijos antes que padres) sin depender de que D1 tenga
-- ON DELETE CASCADE activo.

DELETE FROM caja_movimientos;
DELETE FROM venta_items;
DELETE FROM ventas;
DELETE FROM pedido_items;
DELETE FROM pedidos;
DELETE FROM caja_sesiones;
