import type { DniResultado } from '$lib/server/dni';

export type ConsultaDni =
	| { estado: 'encontrado'; resultado: DniResultado }
	| { estado: 'no_encontrado' }
	| { estado: 'error' };

// Solo se cachean los encontrados: un "no encontrado" o un error de red pueden resolverse
// reintentando, y cada consulta a Factiliza tiene costo.
const cache = new Map<string, DniResultado>();

/** Consulta RENIEC por DNI (8 dígitos exactos). Distingue "no existe" de "no se pudo consultar". */
export async function consultarDni(dni: string): Promise<ConsultaDni> {
	if (!/^\d{8}$/.test(dni)) return { estado: 'no_encontrado' };
	const guardado = cache.get(dni);
	if (guardado) return { estado: 'encontrado', resultado: guardado };
	try {
		const res = await fetch(`/api/dni/${dni}`);
		if (res.status === 404) return { estado: 'no_encontrado' };
		if (!res.ok) return { estado: 'error' };
		const resultado = (await res.json()) as DniResultado;
		cache.set(dni, resultado);
		return { estado: 'encontrado', resultado };
	} catch {
		return { estado: 'error' };
	}
}
