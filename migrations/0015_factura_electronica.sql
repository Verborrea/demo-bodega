-- Migration number: 0015 	 2026-09-24T00:00:00.000Z

-- Serie propia de facturas (SUNAT exige numeración independiente de la de boletas,
-- prefijo F en vez de B). OR IGNORE: si por lo que sea ya existiera la fila, no la
-- pisa (OR REPLACE reiniciaría el contador a 0 → correlativos duplicados).
INSERT OR IGNORE INTO contadores_documentos (serie, ultimo_correlativo) VALUES ('F001', 0);
