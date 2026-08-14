-- Migration number: 0005 	 2026-08-11T12:00:00.000Z

CREATE TABLE usuarios (
	id TEXT PRIMARY KEY,
	usuario TEXT NOT NULL UNIQUE,
	nombre TEXT NOT NULL,
	rol TEXT NOT NULL DEFAULT 'admin',
	password_hash TEXT NOT NULL,
	password_salt TEXT NOT NULL,
	es_root INTEGER NOT NULL DEFAULT 0,
	activo INTEGER NOT NULL DEFAULT 1,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Usuario root/administrador por defecto. Contraseña inicial: LaTiendita2026!
-- (cámbiala una vez tengas una pantalla de gestión de usuarios; por ahora se
-- puede actualizar directamente en D1 si hace falta).
INSERT INTO usuarios (id, usuario, nombre, rol, password_hash, password_salt, es_root, activo) VALUES (
	'usuario-root',
	'admin',
	'Administrador',
	'admin',
	'098ec58ef99b465f6da59f395fe71069780e5ff010554b44ecda5f79298b0e67',
	'f8937094f7cf01318c7c1536368bc9f6',
	1,
	1
);
