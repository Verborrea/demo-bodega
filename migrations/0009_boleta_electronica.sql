-- Migration number: 0009 	 2026-08-25T00:00:00.000Z

-- Numeración oficial del comprobante (serie + correlativo, ej. B001-00000123), separada del
-- documento del CLIENTE (numero_documento, su DNI/RUC). Solo se asigna cuando tipo = 'boleta':
-- una nota_pedido no es un comprobante fiscal y no lleva numeración.
ALTER TABLE ventas ADD COLUMN serie TEXT;
ALTER TABLE ventas ADD COLUMN correlativo INTEGER;

-- Estado del envío a SUNAT de la boleta electrónica: 'no_aplica' (nota_pedido), 'pendiente'
-- (boleta creada; hoy siempre queda así porque el envío real todavía no está implementado,
-- ver src/lib/server/sunat.ts), 'aceptado' o 'rechazado' una vez que sí se envíe.
ALTER TABLE ventas ADD COLUMN sunat_estado TEXT NOT NULL DEFAULT 'no_aplica';
ALTER TABLE ventas ADD COLUMN sunat_hash TEXT;
ALTER TABLE ventas ADD COLUMN sunat_error TEXT;

-- Contador atómico por serie: se incrementa con "UPDATE ... RETURNING" (una sola sentencia,
-- sin hueco entre leer y escribir) para que dos ventas simultáneas nunca reciban el mismo
-- correlativo. Arranca en 0 porque el primer comprobante debe salir como 00000001.
CREATE TABLE contadores_documentos (
	serie TEXT PRIMARY KEY,
	ultimo_correlativo INTEGER NOT NULL DEFAULT 0
);
INSERT INTO contadores_documentos (serie, ultimo_correlativo) VALUES ('B001', 0);
