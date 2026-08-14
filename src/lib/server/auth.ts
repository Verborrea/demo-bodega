export interface Usuario {
	id: string;
	usuario: string;
	nombre: string;
	rol: string;
	esRoot: boolean;
}

interface RawUsuarioRow {
	id: string;
	usuario: string;
	nombre: string;
	rol: string;
	password_hash: string;
	password_salt: string;
	es_root: number;
}

const PBKDF2_ITERACIONES = 100_000;

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/** Comparación en tiempo constante para evitar timing attacks al comparar hashes. */
function compararConstante(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

async function derivarHash(password: string, saltHex: string): Promise<string> {
	const salt = hexToBytes(saltHex);
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERACIONES, hash: 'SHA-256' },
		keyMaterial,
		256
	);
	return bytesToHex(new Uint8Array(bits));
}

/** Genera hash + salt para guardar una contraseña nueva (por ejemplo, al crear un usuario). */
export async function hashearPassword(password: string) {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const saltHex = bytesToHex(salt);
	const hash = await derivarHash(password, saltHex);
	return { hash, salt: saltHex };
}

export async function verificarCredenciales(
	db: D1Database,
	usuario: string,
	password: string
): Promise<Usuario | null> {
	const row = await db
		.prepare('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1')
		.bind(usuario)
		.first<RawUsuarioRow>();
	if (!row) return null;

	const hashCalculado = await derivarHash(password, row.password_salt);
	if (!compararConstante(hashCalculado, row.password_hash)) return null;

	return {
		id: row.id,
		usuario: row.usuario,
		nombre: row.nombre,
		rol: row.rol,
		esRoot: row.es_root === 1
	};
}

/** Protege al usuario root: nunca puede eliminarse, sin importar quién lo pida. */
export async function eliminarUsuario(db: D1Database, id: string) {
	const row = await db
		.prepare('SELECT es_root FROM usuarios WHERE id = ?')
		.bind(id)
		.first<{ es_root: number }>();
	if (!row) return;
	if (row.es_root === 1) {
		throw new Error('No se puede eliminar al usuario root.');
	}
	await db.prepare('DELETE FROM usuarios WHERE id = ?').bind(id).run();
}
