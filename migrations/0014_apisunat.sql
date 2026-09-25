-- Migration number: 0014 	 2026-09-24T00:00:00.000Z

-- Links que devuelve apisunat.pe al emitir/consultar una boleta.
ALTER TABLE ventas ADD COLUMN sunat_xml_url TEXT;
ALTER TABLE ventas ADD COLUMN sunat_cdr_url TEXT;
ALTER TABLE ventas ADD COLUMN sunat_pdf_ticket_url TEXT;
ALTER TABLE ventas ADD COLUMN sunat_pdf_a4_url TEXT;
ALTER TABLE ventas ADD COLUMN sunat_actualizado_en TEXT;

-- Resultado de anular la boleta EN SUNAT (resumen diario) cuando se anula la venta acá.
-- NULL = no aplica / no se intentó. Ver src/lib/server/ventas.ts (bajaSunat).
-- 'aceptada' | 'en_proceso' | 'fallida' | 'sin_confirmar' | 'fuera_de_plazo' | 'no_requerida'
-- 'fuera_de_plazo': más de 5 días desde la emisión, requiere nota de crédito manual.
ALTER TABLE ventas ADD COLUMN sunat_baja_estado TEXT;
ALTER TABLE ventas ADD COLUMN sunat_baja_error TEXT;
