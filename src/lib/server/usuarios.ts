import { hashearPassword, eliminarUsuario as eliminarUsuarioAuth } from './auth';

export type Rol = 'admin' | 'cajero';
export const ROLES: Rol[] = ['admin', 'cajero'];

export interface UsuarioDTO {
	id: string;
	usuario: string;
	nombre: string;
	rol: string;
	esRoot: boolean;
	activo: boolean;
	creadoEn: string;
}

interface RawUsuarioRow {
	id: string;
	usuario: string;
	nombre: string;
	rol: string;
	es_root: number;
	activo: number;
	creado_en: string;
}

function mapRow(row: RawUsuarioRow): UsuarioDTO {
	return {
		id: row.id,
		usuario: row.usuario,
		nombre: row.nombre,
		rol: row.rol,
		esRoot: row.es_root === 1,
		activo: row.activo === 1,
		creadoEn: row.creado_en
	};
}

export async function listUsuarios(db: D1Database): Promise<UsuarioDTO[]> {
	const result = await db
		.prepare(
			'SELECT id, usuario, nombre, rol, es_root, activo, creado_en FROM usuarios ORDER BY es_root DESC, nombre ASC'
		)
		.all<RawUsuarioRow>();
	return result.results.map(mapRow);
}

export interface CrearUsuarioInput {
	usuario: string;
	nombre: string;
	rol: Rol;
	password: string;
}

export async function crearUsuario(db: D1Database, data: CrearUsuarioInput): Promise<string> {
	const id = crypto.randomUUID();
	const { hash, salt } = await hashearPassword(data.password);
	await db
		.prepare(
			'INSERT INTO usuarios (id, usuario, nombre, rol, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?)'
		)
		.bind(id, data.usuario, data.nombre, data.rol, hash, salt)
		.run();
	return id;
}

export interface ActualizarUsuarioInput {
	usuario: string;
	nombre: string;
	rol: Rol;
	activo: boolean;
	password?: string;
}

/** Al usuario root se le ignoran los cambios de rol/estado: siempre queda admin y activo. */
export async function actualizarUsuario(db: D1Database, id: string, data: ActualizarUsuarioInput) {
	const row = await db
		.prepare('SELECT es_root FROM usuarios WHERE id = ?')
		.bind(id)
		.first<{ es_root: number }>();
	if (!row) throw new Error('Usuario no encontrado.');

	const esRoot = row.es_root === 1;
	const rol = esRoot ? 'admin' : data.rol;
	const activo = esRoot ? 1 : data.activo ? 1 : 0;

	if (data.password) {
		const { hash, salt } = await hashearPassword(data.password);
		await db
			.prepare(
				'UPDATE usuarios SET usuario = ?, nombre = ?, rol = ?, activo = ?, password_hash = ?, password_salt = ? WHERE id = ?'
			)
			.bind(data.usuario, data.nombre, rol, activo, hash, salt, id)
			.run();
	} else {
		await db
			.prepare('UPDATE usuarios SET usuario = ?, nombre = ?, rol = ?, activo = ? WHERE id = ?')
			.bind(data.usuario, data.nombre, rol, activo, id)
			.run();
	}
}

export const eliminarUsuario = eliminarUsuarioAuth;
