-- Migration number: 0003 	 2026-08-21T00:00:02.000Z

CREATE TABLE caja_sesiones (
	id TEXT PRIMARY KEY,
	abierta INTEGER NOT NULL DEFAULT 1,
	apertura_en TEXT NOT NULL DEFAULT (datetime('now')),
	cierre_en TEXT,
	cajero_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
	cajero_nombre TEXT NOT NULL,
	efectivo_inicial REAL NOT NULL DEFAULT 0,
	yape_inicial REAL NOT NULL DEFAULT 0,
	tarjeta_inicial REAL NOT NULL DEFAULT 0,
	efectivo_esperado REAL,
	yape_esperado REAL,
	tarjeta_esperado REAL,
	efectivo_final REAL,
	yape_final REAL,
	tarjeta_final REAL,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Solo puede haber una sesión abierta a la vez.
CREATE UNIQUE INDEX idx_caja_sesiones_unica_abierta ON caja_sesiones(abierta) WHERE abierta = 1;
CREATE INDEX idx_caja_sesiones_historial ON caja_sesiones(abierta, cierre_en DESC);

CREATE TABLE caja_movimientos (
	id TEXT PRIMARY KEY,
	sesion_id TEXT NOT NULL REFERENCES caja_sesiones(id) ON DELETE CASCADE,
	tipo TEXT NOT NULL,
	metodo TEXT NOT NULL,
	monto REAL NOT NULL,
	descripcion TEXT NOT NULL,
	venta_id TEXT REFERENCES ventas(id) ON DELETE SET NULL,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_caja_movimientos_sesion ON caja_movimientos(sesion_id);
