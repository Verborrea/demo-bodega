const FACTILIZA_URL = 'https://api.factiliza.com/v1/dni/info';
const TIMEOUT_MS = 6000;

export interface DniResultado {
	numeroDoc: string;
	nombre: string;
}

interface FactilizaRespuesta {
	success: boolean;
	message: string;
	data?: {
		numero: string;
		nombres: string;
		apellido_paterno: string;
		apellido_materno: string;
	};
}

export class DniInvalidoError extends Error {}
export class DniNoEncontradoError extends Error {}

/** Consulta RENIEC vía Factiliza. El token va como secret (FACTILIZA_TOKEN), nunca en el código. */
export async function consultarDni(dni: string, token: string): Promise<DniResultado> {
	if (!/^\d{8}$/.test(dni)) {
		throw new DniInvalidoError('El DNI debe tener 8 dígitos.');
	}

	const res = await fetch(`${FACTILIZA_URL}/${dni}`, {
		headers: { Authorization: `Bearer ${token}` },
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});

	if (res.status === 404) throw new DniNoEncontradoError('DNI no encontrado.');
	if (!res.ok) throw new Error(`Factiliza respondió con error (${res.status}).`);

	const data = (await res.json()) as FactilizaRespuesta;
	if (!data.success || !data.data) {
		throw new DniNoEncontradoError(data.message || 'DNI no encontrado.');
	}

	// Apellidos + nombres (convención peruana), no "nombre_completo": Factiliza lo devuelve
	// como "Apellidos, Nombres" con coma.
	const nombre = `${data.data.apellido_paterno} ${data.data.apellido_materno} ${data.data.nombres}`
		.replace(/\s+/g, ' ')
		.trim()
		.toUpperCase();

	return { numeroDoc: data.data.numero, nombre };
}
