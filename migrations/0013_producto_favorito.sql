-- Migration number: 0013 	 2026-09-23T00:00:00.000Z

-- Productos marcados a mano desde Inventario para la grilla "Favoritos" de Nueva Venta
-- (acceso de un toque, pensado sobre todo para lo que se vende sin código de barras).
-- Es curaduría fija, no un ranking por ventas: en pantalla van en orden alfabético
-- para que no cambien de lugar entre cargas.
ALTER TABLE productos ADD COLUMN favorito INTEGER NOT NULL DEFAULT 0;

-- Nueva Venta los lee en cada carga y después de cada cobro; el índice parcial guarda
-- solo las filas marcadas y ya en el orden que se necesita, así no se recorre el
-- catálogo entero para encontrar unas pocas (mismo criterio que
-- idx_caja_sesiones_unica_abierta / idx_presentaciones_base en migraciones previas).
CREATE INDEX idx_productos_favoritos ON productos(nombre) WHERE favorito = 1;
