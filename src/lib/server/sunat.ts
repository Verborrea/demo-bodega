/**
 * Envío de Boletas y Facturas Electrónicas a SUNAT vía apisunat.pe (un OSE/PSE de
 * terceros — no es la integración directa XML/XAdES/SOAP con SUNAT). Token y URL base
 * en APISUNAT_TOKEN/APISUNAT_BASE_URL (secrets de Cloudflare / .dev.vars en local).
 *
 * Todo acá devuelve un ResultadoApisunat en vez de tirar excepción: quien llama
 * (guardarVenta/anularVenta en ventas.ts) ya guardó la venta en la base antes de
 * intentar esto, así que un error de red/timeout/formato nunca puede volverse un 500
 * que haga que la cajera vuelva a cobrar la misma venta.
 */
import { NEGOCIO } from '$lib/config/negocio';
import { fechaHoraLima } from './fecha';
import { rucValido } from '$lib/utils';

const TIMEOUT_MS = 8000;
const DECIMALES_VALOR_UNITARIO = 6; // ajustar si apisunat rechaza por precisión

export type TipoComprobante = 'boleta' | 'factura';

// Boleta: documentado por apisunat.pe (resumen diario, 5 días). Factura: SUNAT
// (comunicación de baja, 7 días calendario desde el día siguiente a la CDR;
// se aproxima desde venta.fecha, conservador).
export const PLAZO_BAJA_DIAS: Record<TipoComprobante, number> = { boleta: 5, factura: 7 };

export const MOTIVO_BAJA_FACTURA = 'ANULACIÓN DE OPERACIÓN';

const ENTORNOS = {
	'https://sandbox.apisunat.pe': 'sandbox',
	'https://app.apisunat.pe': 'produccion'
} as const;

export interface ConfigApisunat {
	baseUrl: string;
	token: string;
	entorno: 'sandbox' | 'produccion';
}

/** null si no hay token/URL configurados o la URL no es una de las dos conocidas —
 * nunca lanza, así que el llamador siempre puede tratar "no configurado" como un
 * caso más, no como una excepción a atrapar. */
export function configApisunat(env: {
	APISUNAT_BASE_URL?: string;
	APISUNAT_TOKEN?: string;
}): ConfigApisunat | null {
	const entorno = env.APISUNAT_BASE_URL
		? ENTORNOS[env.APISUNAT_BASE_URL as keyof typeof ENTORNOS]
		: undefined;
	if (!entorno || !env.APISUNAT_TOKEN) return null;
	return { baseUrl: env.APISUNAT_BASE_URL!, token: env.APISUNAT_TOKEN, entorno };
}

export type EstadoApisunat = 'ACEPTADO' | 'PENDIENTE' | 'RECHAZADO';

export interface ComprobanteApisunat {
	estado: EstadoApisunat;
	hash: string | null;
	xmlUrl: string | null;
	cdrUrl: string | null;
	pdfTicketUrl: string | null;
	pdfA4Url: string | null;
	mensaje: string | null;
}

export type FalloApisunat =
	| 'no_configurado'
	| 'timeout'
	| 'red'
	| 'http'
	| 'rechazo_api'
	| 'respuesta_invalida'
	| 'no_encontrado'
	| 'datos_invalidos';

export type ResultadoApisunat =
	| { ok: true; comprobante: ComprobanteApisunat }
	| { ok: false; fallo: FalloApisunat; mensaje: string };

export interface LineaComprobante {
	descripcion: string;
	cantidad: number;
	precioUnitario: number; // CON IGV, como se guarda en venta_items
}

export interface ComprobanteParaEmitir {
	tipo: TipoComprobante;
	serie: string;
	correlativo: number;
	/** ventas.fecha (ISO UTC) — la fecha ORIGINAL de la venta, no "ahora": un reintento
	 * días después debe seguir declarando la fecha real de emisión. */
	fechaIso: string;
	numeroDocumento: string | null;
	cliente: string | null;
	total: number;
	lineas: LineaComprobante[];
}

type DocumentoCliente = { tipo: '1' | '6'; numero: string; denominacion: string; direccion: '-' };

/** Boleta: 8 dígitos → DNI, 11 → RUC, cualquier otra cosa (vacío, corto, largo) → el
 * "cliente varios" que usa la propia convención de apisunat para boletas sin documento
 * válido. Factura: SOLO devuelve algo si hay un RUC con dígito verificador válido y un
 * cliente no vacío — una factura sin esos datos reales nunca debe intentar mandarse. */
export function documentoCliente(
	tipo: TipoComprobante,
	numeroDocumento: string | null,
	cliente: string | null
): DocumentoCliente | null {
	if (tipo === 'factura') {
		const ruc = (numeroDocumento ?? '').replace(/\D/g, '');
		if (!rucValido(ruc) || !cliente?.trim()) return null;
		return { tipo: '6', numero: ruc, denominacion: cliente.trim().slice(0, 100), direccion: '-' };
	}
	const soloDigitos = (numeroDocumento ?? '').replace(/\D/g, '');
	if (soloDigitos.length === 8 || soloDigitos.length === 11) {
		return {
			tipo: soloDigitos.length === 8 ? '1' : '6',
			numero: soloDigitos,
			denominacion: (cliente?.trim() || 'CLIENTE VARIOS').slice(0, 100),
			direccion: '-'
		};
	}
	return { tipo: '1', numero: '99999999', denominacion: 'CLIENTE VARIOS', direccion: '-' };
}

export function valorUnitarioSinIgv(precioConIgv: number): string {
	return (precioConIgv / (1 + NEGOCIO.igvPorcentaje / 100)).toFixed(DECIMALES_VALOR_UNITARIO);
}

function construirPayloadComprobante(c: ComprobanteParaEmitir) {
	const doc = documentoCliente(c.tipo, c.numeroDocumento, c.cliente);
	if (!doc) return null;
	const { fecha, hora } = fechaHoraLima(c.fechaIso);
	return {
		documento: c.tipo,
		serie: c.serie,
		numero: c.correlativo,
		fecha_de_emision: fecha,
		hora_de_emision: hora,
		moneda: 'PEN',
		tipo_operacion: '0101',
		cliente_tipo_de_documento: doc.tipo,
		cliente_numero_de_documento: doc.numero,
		cliente_denominacion: doc.denominacion,
		cliente_direccion: doc.direccion,
		items: c.lineas.map((l) => ({
			// Simplificación v1: el catálogo no tiene unidad de medida SUNAT ni código de
			// afectación por producto — todo se manda como unidad gravada estándar.
			unidad_de_medida: 'NIU',
			descripcion: l.descripcion.slice(0, 250),
			cantidad: String(l.cantidad),
			valor_unitario: valorUnitarioSinIgv(l.precioUnitario),
			porcentaje_igv: String(NEGOCIO.igvPorcentaje),
			codigo_tipo_afectacion_igv: '10',
			nombre_tributo: 'IGV'
		})),
		total: (Math.round(c.total * 100) / 100).toFixed(2)
	};
}

interface RespuestaApisunat {
	success?: boolean;
	message?: string;
	payload?: {
		estado?: EstadoApisunat;
		hash?: string;
		xml?: string;
		cdr?: string;
		pdf?: { ticket?: string; a4?: string };
	};
	// Confirmado contra sandbox: /voided a veces envuelve la respuesta real en
	// { status_code, body: {...} } en vez de devolver success/message/payload al
	// nivel raíz (otros endpoints como /documents sí van al nivel raíz). Se
	// normaliza abajo probando primero body y cayendo al nivel raíz si no existe.
	body?: { success?: boolean; message?: string; payload?: RespuestaApisunat['payload'] };
}

/** POST genérico a apisunat.pe. Nunca tira: cualquier problema de red, timeout o
 * formato de respuesta se devuelve como { ok: false }, no como excepción. */
async function llamar(
	cfg: ConfigApisunat,
	ruta: string,
	body: unknown
): Promise<ResultadoApisunat> {
	let res: Response;
	try {
		res = await fetch(`${cfg.baseUrl}${ruta}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (err) {
		const fallo = err instanceof Error && err.name === 'TimeoutError' ? 'timeout' : 'red';
		return { ok: false, fallo, mensaje: `apisunat.pe (${cfg.entorno}) no respondió: ${fallo}` };
	}

	let json: RespuestaApisunat;
	try {
		json = await res.json();
	} catch {
		return { ok: false, fallo: 'respuesta_invalida', mensaje: `Respuesta no-JSON, HTTP ${res.status}` };
	}
	const cuerpo = json.body ?? json;

	const estado = cuerpo.payload?.estado;
	if (estado === 'ACEPTADO' || estado === 'PENDIENTE' || estado === 'RECHAZADO') {
		const payload = cuerpo.payload!;
		return {
			ok: true,
			comprobante: {
				estado,
				hash: payload.hash ?? null,
				xmlUrl: payload.xml ?? null,
				cdrUrl: payload.cdr ?? null,
				pdfTicketUrl: payload.pdf?.ticket ?? null,
				pdfA4Url: payload.pdf?.a4 ?? null,
				mensaje: cuerpo.message ?? null
			}
		};
	}

	// Confirmado contra sandbox: un documento inexistente da HTTP 400 + success:false
	// + mensaje "...no existe en nuestros registros" (no 404) — se detecta por texto.
	if (res.status === 404 || /no (se )?encontr|no existe/i.test(cuerpo.message ?? '')) {
		return { ok: false, fallo: 'no_encontrado', mensaje: cuerpo.message ?? 'Documento no encontrado' };
	}
	if (!res.ok) {
		return { ok: false, fallo: 'http', mensaje: `HTTP ${res.status}: ${cuerpo.message ?? ''}`.slice(0, 500) };
	}
	return { ok: false, fallo: 'rechazo_api', mensaje: (cuerpo.message ?? 'Rechazado por apisunat').slice(0, 500) };
}

export async function emitirComprobante(
	cfg: ConfigApisunat,
	c: ComprobanteParaEmitir
): Promise<ResultadoApisunat> {
	const payload = construirPayloadComprobante(c);
	if (!payload) {
		return {
			ok: false,
			fallo: 'datos_invalidos',
			mensaje: 'Factura sin RUC/razón social válidos del cliente'
		};
	}
	return llamar(cfg, '/api/v3/documents', payload);
}

export async function consultarEstadoComprobante(
	cfg: ConfigApisunat,
	tipo: TipoComprobante,
	serie: string,
	numero: number
) {
	return llamar(cfg, '/api/v3/status', { documento: tipo, serie, numero });
}

export async function anularComprobanteSunat(
	cfg: ConfigApisunat,
	tipo: TipoComprobante,
	serie: string,
	numero: number
) {
	if (tipo === 'factura') {
		return llamar(cfg, '/api/v3/voided', {
			documento: 'comunicacion_baja',
			motivo: MOTIVO_BAJA_FACTURA,
			documento_afectado: { documento: 'factura', serie, numero: String(numero) }
		});
	}
	return llamar(cfg, '/api/v3/daily-summary', {
		documento: 'resumen_diario',
		documentos_afectados: [
			{ accion_resumen: 'anular', documento: 'boleta', serie, numero: String(numero) }
		]
	});
}
