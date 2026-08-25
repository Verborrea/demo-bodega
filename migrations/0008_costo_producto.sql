-- Migration number: 0008 	 2026-08-22T00:00:00.000Z

-- Último costo de compra del producto, normalizado a costo POR UNIDAD BASE (independiente
-- de en qué presentación llegó el pedido), para que sea comparable contra el precio de la
-- presentación base al calcular la ganancia. NULL si el producto nunca tuvo un ingreso de
-- mercadería ni se le puso un costo manual.
ALTER TABLE productos ADD COLUMN costo_ultimo REAL;
