-- Migration number: 0016 	 2026-09-27T00:00:00.000Z

-- El negocio está afecto al Nuevo RUS: tiene prohibido emitir facturas (ver el comentario
-- en src/lib/config/negocio.ts). Nunca se emitió ninguna (0 filas en ventas con
-- tipo = 'factura'), así que se limpia el contador de la serie F001 que quedó sin uso.
DELETE FROM contadores_documentos WHERE serie = 'F001';
