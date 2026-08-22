-- Migration number: 0007 	 2026-08-22T00:00:00.000Z

-- obtenerSesionAbierta() corre en cada navegación dentro de /dashboard (layout
-- server load) y ordena los movimientos por creado_en DESC; el índice compuesto
-- cubre el filtro por sesión Y el orden, evitando un sort aparte.
CREATE INDEX idx_caja_movimientos_sesion_creado ON caja_movimientos(sesion_id, creado_en DESC);

-- resumenVentas()/totalVentasDelDia() (dashboard) filtran siempre por
-- estado = 'activa'; sin este índice cada carga del dashboard escaneaba
-- también las ventas anuladas para descartarlas.
CREATE INDEX idx_ventas_estado_fecha ON ventas(estado, fecha DESC);

-- Filtro por cajero en el historial de caja (/dashboard/caja).
CREATE INDEX idx_caja_sesiones_cajero ON caja_sesiones(cajero_id);
