-- Migration number: 0012 	 2026-09-13T01:00:00.000Z

-- Hasta acá una venta anulada se sabía que lo estaba (ventas.estado), pero no cuándo: la
-- fila se pisaba en el sitio sin dejar fecha. Queda NULL para todas las anulaciones
-- anteriores a esta migración — ese dato no se guardó nunca y no es recuperable.
ALTER TABLE ventas ADD COLUMN anulada_en TEXT;
