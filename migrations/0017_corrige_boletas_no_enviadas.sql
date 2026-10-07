-- Migration number: 0017 	2026-09-27T00:00:00.000Z

-- Antes de esta fecha, tipo = 'boleta' numeraba (serie/correlativo) pero apisunat.pe nunca
-- estuvo realmente conectado (sin APISUNAT_TOKEN/APISUNAT_BASE_URL configurados) -- ninguna
-- de estas boletas llegó jamás a SUNAT (confirmado: todas quedaron en sunat_estado =
-- 'pendiente', sin sunat_hash). El negocio las quiere como lo que realmente fueron: notas de
-- venta internas, no comprobantes fiscales. Se limpian también los campos de SUNAT para que
-- no quede rastro de una numeración/envío que nunca ocurrió de verdad.
UPDATE ventas
SET tipo = 'nota_pedido',
	serie = NULL,
	correlativo = NULL,
	sunat_estado = 'no_aplica',
	sunat_hash = NULL,
	sunat_error = NULL,
	sunat_xml_url = NULL,
	sunat_cdr_url = NULL,
	sunat_pdf_ticket_url = NULL,
	sunat_pdf_a4_url = NULL,
	sunat_actualizado_en = NULL,
	sunat_baja_estado = NULL,
	sunat_baja_error = NULL
WHERE tipo = 'boleta';

-- Libera la numeración: la primera boleta real (ahora que apisunat.pe sí está conectado)
-- debe arrancar en B001-00000001, no continuar después de números que nunca se declararon
-- a SUNAT.
UPDATE contadores_documentos SET ultimo_correlativo = 0 WHERE serie = 'B001';
