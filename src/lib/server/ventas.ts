import { recalcularEsperadosSiCerrada, type MetodoCaja } from './caja';
import {
	movimientosDeVenta,
	sentenciasMovimientos,
	SIN_ACTOR,
	type ActorMovimiento,
	type MovimientoInput,
	type MovimientoVentaRow
} from './movimientos';
import { NEGOCIO } from '$lib/config/negocio';
import { redondear2 } from '$lib/utils';
import { OFFSET_LIMA, OFFSET_LIMA_INVERSO, diasCalendarioLimaDesde } from './fecha';
import {
	emitirComprobante,
	consultarEstadoComprobante,
	anularComprobanteSunat,
	PLAZO_BAJA_DIAS,
	type ConfigApisunat,
	type ResultadoApisunat,
	type LineaComprobante,
	type TipoComprobante
} from './sunat';

export type TipoVenta = TipoComprobante | 'nota_pedido';
/** Explícito a propósito: un futuro tipo de venta nuevo no debe caer en SUNAT por
 * defecto solo por no ser 'nota_pedido'. Esto dice "es un comprobante fiscal numerado"
 * (le toca serie/correlativo, desglosa IGV en el ticket, y SÍ se manda a SUNAT). */
export function esComprobanteElectronico(t: TipoVenta): t is TipoComprobante {
	return t === 'boleta';
}
const SERIE_POR_TIPO: Record<TipoComprobante, string> = {
	boleta: NEGOCIO.serieBoleta
};
export type EstadoVenta = 'activa' | 'anulada';
export type EstadoSunat = 'no_aplica' | 'pendiente' | 'aceptado' | 'rechazado';
/** Resultado de pedirle a apisunat.pe que anule (resumen diario) una boleta ya
 * aceptada. NULL en la base = no aplica / nunca se intentó. */
export type EstadoBajaSunat =
	'aceptada' | 'en_proceso' | 'fallida' | 'sin_confirmar' | 'fuera_de_plazo' | 'no_requerida';

export interface PagoVentaDTO {
	metodo: MetodoCaja;
	monto: number;
}

export interface ItemVentaDTO {
	id: string;
	productoId: string | null;
	nombreProducto: string;
	presentacionId: string | null;
	nombrePresentacion: string;
	promoId: string | null;
	cantidad: number;
	precioUnitario: number;
	subtotal: number;
}

export interface VentaDTO {
	id: string;
	fecha: string;
	tipo: TipoVenta;
	metodo: string;
	numeroDocumento: string | null;
	cliente: string | null;
	total: number;
	estado: EstadoVenta;
	/** Cuándo se anuló. NULL en las anuladas antes de la migración 0012: no se registraba. */
	anuladaEn: string | null;
	cajeroId: string | null;
	cajeroNombre: string;
	sesionCajaId: string | null;
	serie: string | null;
	correlativo: number | null;
	sunatEstado: EstadoSunat;
	sunatHash: string | null;
	sunatError: string | null;
	sunatXmlUrl: string | null;
	sunatCdrUrl: string | null;
	sunatPdfTicketUrl: string | null;
	sunatPdfA4Url: string | null;
	sunatActualizadoEn: string | null;
	sunatBajaEstado: EstadoBajaSunat | null;
	sunatBajaError: string | null;
	items: ItemVentaDTO[];
	pagos: PagoVentaDTO[];
}

interface RawVentaRow {
	id: string;
	fecha: string;
	tipo: TipoVenta;
	metodo: string;
	numero_documento: string | null;
	cliente: string | null;
	total: number;
	estado: EstadoVenta;
	anulada_en: string | null;
	cajero_id: string | null;
	cajero_nombre: string;
	sesion_caja_id: string | null;
	serie: string | null;
	correlativo: number | null;
	sunat_estado: EstadoSunat;
	sunat_hash: string | null;
	sunat_error: string | null;
	sunat_xml_url: string | null;
	sunat_cdr_url: string | null;
	sunat_pdf_ticket_url: string | null;
	sunat_pdf_a4_url: string | null;
	sunat_actualizado_en: string | null;
	sunat_baja_estado: EstadoBajaSunat | null;
	sunat_baja_error: string | null;
	itemsJson: string | null;
	pagosJson: string | null;
}

const VENTA_SELECT = `
	SELECT v.id, v.fecha, v.tipo, v.metodo, v.numero_documento, v.cliente, v.total, v.estado,
		v.anulada_en, v.cajero_id, v.cajero_nombre, v.sesion_caja_id,
		v.serie, v.correlativo, v.sunat_estado, v.sunat_hash, v.sunat_error,
		v.sunat_xml_url, v.sunat_cdr_url, v.sunat_pdf_ticket_url, v.sunat_pdf_a4_url,
		v.sunat_actualizado_en, v.sunat_baja_estado, v.sunat_baja_error,
		(SELECT json_group_array(json_object(
				'id', id, 'productoId', producto_id, 'nombreProducto', nombre_producto,
				'presentacionId', presentacion_id, 'nombrePresentacion', nombre_presentacion,
				'promoId', promo_id, 'cantidad', cantidad, 'precioUnitario', precio_unitario, 'subtotal', subtotal
			))
		 FROM (SELECT id, producto_id, nombre_producto, presentacion_id, nombre_presentacion,
		              promo_id, cantidad, precio_unitario, subtotal
		       FROM venta_items WHERE venta_id = v.id ORDER BY creado_en)) AS itemsJson,
		(SELECT json_group_array(json_object('metodo', metodo, 'monto', monto))
		 FROM (SELECT metodo, monto FROM caja_movimientos
		       WHERE venta_id = v.id AND tipo = 'venta' ORDER BY creado_en)) AS pagosJson
	FROM ventas v
`;

function mapRow(row: RawVentaRow): VentaDTO {
	return {
		id: row.id,
		fecha: row.fecha,
		tipo: row.tipo,
		metodo: row.metodo,
		numeroDocumento: row.numero_documento,
		cliente: row.cliente,
		total: row.total,
		estado: row.estado,
		anuladaEn: row.anulada_en,
		cajeroId: row.cajero_id,
		cajeroNombre: row.cajero_nombre,
		sesionCajaId: row.sesion_caja_id,
		serie: row.serie,
		correlativo: row.correlativo,
		sunatEstado: row.sunat_estado,
		sunatHash: row.sunat_hash,
		sunatError: row.sunat_error,
		sunatXmlUrl: row.sunat_xml_url,
		sunatCdrUrl: row.sunat_cdr_url,
		sunatPdfTicketUrl: row.sunat_pdf_ticket_url,
		sunatPdfA4Url: row.sunat_pdf_a4_url,
		sunatActualizadoEn: row.sunat_actualizado_en,
		sunatBajaEstado: row.sunat_baja_estado,
		sunatBajaError: row.sunat_baja_error,
		items: row.itemsJson ? JSON.parse(row.itemsJson) : [],
		pagos: row.pagosJson ? JSON.parse(row.pagosJson) : []
	};
}

export type OrdenVenta = 'fecha' | 'cliente' | 'cajero' | 'total';

// Whitelist de columna → SQL real: nunca se interpola orderBy directo en la query
// (vendría del querystring de la API), así se evita inyección por ese lado.
const ORDEN_VENTA_SQL: Record<OrdenVenta, string> = {
	fecha: 'v.fecha',
	cliente: 'v.cliente',
	cajero: 'v.cajero_nombre',
	total: 'v.total'
};

export interface ListarVentasParams {
	page: number;
	pageSize: number;
	search?: string;
	fechaInicio?: string;
	fechaFin?: string;
	orderBy?: OrdenVenta;
	orderDir?: 'asc' | 'desc';
}

export async function listVentas(db: D1Database, params: ListarVentasParams) {
	const { page, pageSize, search, fechaInicio, fechaFin, orderBy, orderDir } = params;
	const offset = (page - 1) * pageSize;
	const columnaOrden = ORDEN_VENTA_SQL[orderBy ?? 'fecha'];
	const direccionOrden = orderDir === 'asc' ? 'ASC' : 'DESC';

	const whereClauses: string[] = [];
	const whereValues: unknown[] = [];
	if (search) {
		whereClauses.push(
			`(v.cliente LIKE ? OR v.metodo LIKE ? OR v.cajero_nombre LIKE ? OR v.id IN (SELECT venta_id FROM venta_items WHERE nombre_producto LIKE ?))`
		);
		whereValues.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
	}
	if (fechaInicio) {
		whereClauses.push(`date(v.fecha, '${OFFSET_LIMA}') >= date(?)`);
		whereValues.push(fechaInicio);
	}
	if (fechaFin) {
		whereClauses.push(`date(v.fecha, '${OFFSET_LIMA}') <= date(?)`);
		whereValues.push(fechaFin);
	}
	const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

	const [listResult, resumenResult] = await Promise.all([
		db
			.prepare(
				`${VENTA_SELECT} ${where} ORDER BY ${columnaOrden} ${direccionOrden}, v.fecha DESC LIMIT ? OFFSET ?`
			)
			.bind(...whereValues, pageSize, offset)
			.all<RawVentaRow>(),
		db
			.prepare(`SELECT count(*) AS total, COALESCE(SUM(total), 0) AS suma FROM ventas v ${where}`)
			.bind(...whereValues)
			.first<{ total: number; suma: number }>()
	]);

	return {
		ventas: listResult.results.map(mapRow),
		total: resumenResult?.total ?? 0,
		sumaTotal: resumenResult?.suma ?? 0
	};
}

export class VentaInvalidaError extends Error {}

export type ItemVentaInput =
	| {
			tipo: 'producto';
			productoId: string;
			presentacionId: string;
			cantidad: number;
			precioUnitario: number;
	  }
	| {
			tipo: 'promo';
			promoId: string;
			cantidad: number;
			precioUnitario: number;
	  };

export interface GuardarVentaInput {
	tipo: TipoVenta;
	pagos: PagoVentaDTO[];
	numeroDocumento: string | null;
	cliente: string | null;
	total: number;
	items: ItemVentaInput[];
}

/** "Efectivo" si es un solo método, o "Efectivo + Yape" si el pago está fraccionado. */
function resumenMetodos(pagos: PagoVentaDTO[]): string {
	return [...new Set(pagos.map((p) => p.metodo))].join(' + ');
}

export interface CajeroInfo {
	id: string;
	nombre: string;
}

interface PresentacionInfo {
	id: string;
	nombre: string;
	factorUnidades: number;
	cantidad: number;
	productoId: string;
	productoNombre: string;
}

interface PromoItemInfo {
	promo_id: string;
	presentacion_id: string;
	cantidadPorPromo: number;
	factorUnidades: number;
	stockPresentacion: number;
	nombrePresentacion: string;
	productoId: string;
	productoNombre: string;
}

export interface VentaGuardadaInfo {
	id: string;
	serie: string | null;
	correlativo: number | null;
	sunatEstado: EstadoSunat;
	sunatError: string | null;
}

/** Traduce un ResultadoApisunat a EstadoSunat y lo persiste. El WHERE sunat_estado =
 * 'pendiente' evita que una respuesta tardía (p.ej. de un reintento manual que ya
 * corrió antes de que volviera esta llamada) pise un estado que ya quedó final. */
async function persistirResultadoSunat(
	db: D1Database,
	ventaId: string,
	r: ResultadoApisunat
): Promise<{ estado: EstadoSunat; error: string | null }> {
	const ahora = new Date().toISOString();
	if (r.ok) {
		const estado: EstadoSunat =
			r.comprobante.estado === 'ACEPTADO'
				? 'aceptado'
				: r.comprobante.estado === 'RECHAZADO'
					? 'rechazado'
					: 'pendiente';
		const error =
			estado === 'pendiente'
				? 'apisunat recibió el comprobante; SUNAT aún no confirma. Reintenta en unos minutos.'
				: r.comprobante.mensaje;
		await db
			.prepare(
				`UPDATE ventas SET sunat_estado = ?, sunat_hash = COALESCE(?, sunat_hash),
					sunat_xml_url = COALESCE(?, sunat_xml_url), sunat_cdr_url = COALESCE(?, sunat_cdr_url),
					sunat_pdf_ticket_url = COALESCE(?, sunat_pdf_ticket_url), sunat_pdf_a4_url = COALESCE(?, sunat_pdf_a4_url),
					sunat_error = ?, sunat_actualizado_en = ?
				 WHERE id = ? AND sunat_estado = 'pendiente'`
			)
			.bind(
				estado,
				r.comprobante.hash,
				r.comprobante.xmlUrl,
				r.comprobante.cdrUrl,
				r.comprobante.pdfTicketUrl,
				r.comprobante.pdfA4Url,
				error,
				ahora,
				ventaId
			)
			.run();
		return { estado, error };
	}
	await db
		.prepare(
			`UPDATE ventas SET sunat_error = ?, sunat_actualizado_en = ? WHERE id = ? AND sunat_estado = 'pendiente'`
		)
		.bind(r.mensaje, ahora, ventaId)
		.run();
	return { estado: 'pendiente', error: r.mensaje };
}

export async function guardarVenta(
	db: D1Database,
	data: GuardarVentaInput,
	sesionCajaId: string,
	cajero: CajeroInfo,
	apisunat: ConfigApisunat | null
): Promise<VentaGuardadaInfo> {
	const total = redondear2(data.total);
	const pagosVenta = data.pagos.map((p) => ({ ...p, monto: redondear2(p.monto) }));
	if (pagosVenta.length === 0) {
		throw new VentaInvalidaError('Debes indicar al menos un método de pago.');
	}
	const sumaPagos = pagosVenta.reduce((acc, p) => acc + p.monto, 0);
	if (Math.abs(sumaPagos - total) > 0.01) {
		throw new VentaInvalidaError('La suma de los pagos no coincide con el total de la venta.');
	}

	const itemsProducto = data.items.filter((i) => i.tipo === 'producto');
	const itemsPromo = data.items.filter((i) => i.tipo === 'promo');

	const presentacionIds = [...new Set(itemsProducto.map((i) => i.presentacionId))];
	const promoIds = [...new Set(itemsPromo.map((i) => i.promoId))];

	const presentacionInfoPorId = new Map<string, PresentacionInfo>();
	const promoNombrePorId = new Map<string, string>();

	if (presentacionIds.length > 0) {
		const placeholders = presentacionIds.map(() => '?').join(', ');
		const result = await db
			.prepare(
				`SELECT pp.id, pp.nombre, pp.factor_unidades AS factorUnidades, pp.cantidad,
					p.id AS productoId, p.nombre AS productoNombre
				 FROM producto_presentaciones pp
				 JOIN productos p ON p.id = pp.producto_id
				 WHERE pp.id IN (${placeholders})`
			)
			.bind(...presentacionIds)
			.all<PresentacionInfo>();
		for (const row of result.results) presentacionInfoPorId.set(row.id, row);
	}

	const promoItemsPorPromo = new Map<string, PromoItemInfo[]>();
	if (promoIds.length > 0) {
		const placeholders = promoIds.map(() => '?').join(', ');
		const [itemsResult, promosResult] = await Promise.all([
			db
				.prepare(
					`SELECT pi.promo_id, pi.presentacion_id, pi.cantidad AS cantidadPorPromo,
						pp.factor_unidades AS factorUnidades, pp.cantidad AS stockPresentacion, pp.nombre AS nombrePresentacion,
						p.id AS productoId, p.nombre AS productoNombre
					 FROM promo_items pi
					 JOIN producto_presentaciones pp ON pp.id = pi.presentacion_id
					 JOIN productos p ON p.id = pp.producto_id
					 WHERE pi.promo_id IN (${placeholders})`
				)
				.bind(...promoIds)
				.all<PromoItemInfo>(),
			db
				.prepare(`SELECT id, nombre FROM promos WHERE id IN (${placeholders})`)
				.bind(...promoIds)
				.all<{ id: string; nombre: string }>()
		]);
		for (const row of itemsResult.results) {
			const lista = promoItemsPorPromo.get(row.promo_id) ?? [];
			lista.push(row);
			promoItemsPorPromo.set(row.promo_id, lista);
		}
		for (const row of promosResult.results) promoNombrePorId.set(row.id, row.nombre);
	}

	// Consumo agregado por presentación (en unidades de esa presentación, no en unidades base),
	// combinando ventas directas de producto y las que vienen empaquetadas dentro de una promo.
	// No se bloquea la venta si el stock no alcanza: la tienda vende igual y el inventario
	// queda en 0/negativo para que se note el déficit en vez de rechazar el cobro.
	const consumoPorPresentacion = new Map<string, number>();
	for (const item of itemsProducto) {
		consumoPorPresentacion.set(
			item.presentacionId,
			(consumoPorPresentacion.get(item.presentacionId) ?? 0) + item.cantidad
		);
	}
	for (const item of itemsPromo) {
		const componentes = promoItemsPorPromo.get(item.promoId);
		if (!componentes) throw new VentaInvalidaError('Promo no encontrada.');
		for (const comp of componentes) {
			consumoPorPresentacion.set(
				comp.presentacion_id,
				(consumoPorPresentacion.get(comp.presentacion_id) ?? 0) +
					comp.cantidadPorPromo * item.cantidad
			);
		}
	}

	// Solo boleta es comprobante fiscal: le toca numeración serie-correlativo. El
	// incremento va en su propia sentencia con RETURNING (atómica, sin hueco entre leer y
	// escribir) para que dos ventas simultáneas nunca reciban el mismo correlativo — no se
	// puede meter dentro del db.batch de abajo porque batch no permite usar el resultado
	// de una sentencia como input de otra.
	let serie: string | null = null;
	let correlativo: number | null = null;
	let sunatEstado: EstadoSunat = 'no_aplica';
	if (esComprobanteElectronico(data.tipo)) {
		serie = SERIE_POR_TIPO[data.tipo];
		const contador = await db
			.prepare(
				`UPDATE contadores_documentos SET ultimo_correlativo = ultimo_correlativo + 1
				 WHERE serie = ? RETURNING ultimo_correlativo`
			)
			.bind(serie)
			.first<{ ultimo_correlativo: number }>();
		if (!contador) {
			throw new VentaInvalidaError(`No hay numeración configurada para la serie ${serie}.`);
		}
		correlativo = contador.ultimo_correlativo;
		// Queda 'pendiente' hasta el intento de envío real, después del db.batch de abajo
		// (ver el bloque de SUNAT al final de esta función).
		sunatEstado = 'pendiente';
	}

	const id = crypto.randomUUID();
	// Se captura una sola vez: además de guardarse en la venta, es la fecha que se le
	// declara a apisunat.pe más abajo (y la que usará un reintento posterior — nunca
	// "ahora", para no declarar una fecha de emisión distinta a la real).
	const fecha = new Date().toISOString();
	const statements = [
		db
			.prepare(
				`INSERT INTO ventas (id, fecha, tipo, metodo, numero_documento, cliente, total, estado, cajero_id, cajero_nombre, sesion_caja_id, serie, correlativo, sunat_estado)
				 VALUES (?, ?, ?, ?, ?, ?, ?, 'activa', ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				id,
				fecha,
				data.tipo,
				resumenMetodos(pagosVenta),
				data.numeroDocumento,
				data.cliente,
				total,
				cajero.id,
				cajero.nombre,
				sesionCajaId,
				serie,
				correlativo,
				sunatEstado
			)
	];

	for (const item of itemsProducto) {
		const presentacion = presentacionInfoPorId.get(item.presentacionId)!;
		const subtotal = redondear2(item.cantidad * item.precioUnitario);
		statements.push(
			db
				.prepare(
					`INSERT INTO venta_items
						(id, venta_id, producto_id, nombre_producto, presentacion_id, nombre_presentacion, factor_unidades, cantidad, precio_unitario, subtotal, promo_id)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
				)
				.bind(
					crypto.randomUUID(),
					id,
					presentacion.productoId,
					presentacion.productoNombre,
					presentacion.id,
					presentacion.nombre,
					presentacion.factorUnidades,
					item.cantidad,
					item.precioUnitario,
					subtotal
				)
		);
	}

	for (const item of itemsPromo) {
		const subtotal = redondear2(item.cantidad * item.precioUnitario);
		statements.push(
			db
				.prepare(
					`INSERT INTO venta_items
						(id, venta_id, producto_id, nombre_producto, presentacion_id, nombre_presentacion, factor_unidades, cantidad, precio_unitario, subtotal, promo_id)
					 VALUES (?, ?, NULL, ?, NULL, 'Promo', 1, ?, ?, ?, ?)`
				)
				.bind(
					crypto.randomUUID(),
					id,
					promoNombrePorId.get(item.promoId) ?? 'Promo',
					item.cantidad,
					item.precioUnitario,
					subtotal,
					item.promoId
				)
		);
	}

	// Líneas para declarar a SUNAT (solo si es boleta, ver el bloque al final de la
	// función) — mismo nombre/cantidad/precio que ya se guardó en venta_items arriba.
	const lineasSunat: LineaComprobante[] = [
		...itemsProducto.map((item) => {
			const presentacion = presentacionInfoPorId.get(item.presentacionId)!;
			return {
				descripcion: presentacion.productoNombre,
				cantidad: item.cantidad,
				precioUnitario: item.precioUnitario
			};
		}),
		...itemsPromo.map((item) => ({
			descripcion: promoNombrePorId.get(item.promoId) ?? 'Promo',
			cantidad: item.cantidad,
			precioUnitario: item.precioUnitario
		}))
	];

	// Se permite vender aunque no alcance el stock a propósito (la tienda lo pidió así):
	// el descuento no tiene guarda de "cantidad >= consumo" ni MAX(0, ...), así que el
	// inventario puede quedar en negativo para que se note el déficit en vez de bloquear el cobro.
	for (const [presentacionId, consumo] of consumoPorPresentacion) {
		const directa = presentacionInfoPorId.get(presentacionId);
		const factorUnidades =
			directa?.factorUnidades ??
			[...promoItemsPorPromo.values()].flat().find((c) => c.presentacion_id === presentacionId)
				?.factorUnidades ??
			1;
		const productoId =
			directa?.productoId ??
			[...promoItemsPorPromo.values()].flat().find((c) => c.presentacion_id === presentacionId)
				?.productoId;
		if (!productoId) continue;

		statements.push(
			db
				.prepare('UPDATE producto_presentaciones SET cantidad = cantidad - ? WHERE id = ?')
				.bind(consumo, presentacionId),
			db
				.prepare('UPDATE productos SET cantidad = cantidad - ? WHERE id = ?')
				.bind(consumo * factorUnidades, productoId)
		);
	}

	// Kardex: una fila por línea vendida, no por presentación. Las unidades que salen dentro
	// de una promo se anotan una por componente (con promoId y el nombre del combo), que es
	// lo que después deja anular la venta devolviendo exactamente lo que salió.
	const movimientos: MovimientoInput[] = [];
	for (const item of itemsProducto) {
		const presentacion = presentacionInfoPorId.get(item.presentacionId)!;
		movimientos.push({
			productoId: presentacion.productoId,
			nombreProducto: presentacion.productoNombre,
			presentacionId: presentacion.id,
			nombrePresentacion: presentacion.nombre,
			factorUnidades: presentacion.factorUnidades,
			cantidad: -item.cantidad,
			tipo: 'venta',
			ventaId: id
		});
	}
	for (const item of itemsPromo) {
		const nombrePromo = promoNombrePorId.get(item.promoId) ?? 'Promo';
		for (const comp of promoItemsPorPromo.get(item.promoId) ?? []) {
			movimientos.push({
				productoId: comp.productoId,
				nombreProducto: comp.productoNombre,
				presentacionId: comp.presentacion_id,
				nombrePresentacion: comp.nombrePresentacion,
				factorUnidades: comp.factorUnidades,
				cantidad: -(comp.cantidadPorPromo * item.cantidad),
				tipo: 'venta',
				ventaId: id,
				promoId: item.promoId,
				detalle: `Promo ${nombrePromo}`
			});
		}
	}
	statements.push(...sentenciasMovimientos(db, movimientos, cajero));

	const totalItems = data.items.reduce((acc, item) => acc + item.cantidad, 0);
	const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
	const descripcion = `${totalItems} producto${totalItems === 1 ? '' : 's'} · ${hora}`;
	for (const pago of pagosVenta) {
		statements.push(
			db
				.prepare(
					`INSERT INTO caja_movimientos (id, sesion_id, tipo, metodo, monto, descripcion, venta_id)
					 VALUES (?, ?, 'venta', ?, ?, ?, ?)`
				)
				.bind(crypto.randomUUID(), sesionCajaId, pago.metodo, pago.monto, descripcion, id)
		);
	}

	await db.batch(statements);

	// La venta YA quedó guardada. Nada de acá para abajo puede tirar — un 500 acá
	// haría que la cajera vuelva a cobrar la misma venta (duplicado + doble descuento
	// de stock). Cualquier problema con SUNAT deja la boleta 'pendiente' con el motivo
	// en sunat_error; se reintenta a mano desde Ventas (sincronizarSunatVenta).
	let sunatError: string | null = null;
	if (esComprobanteElectronico(data.tipo)) {
		try {
			const resultado: ResultadoApisunat =
				correlativo === null
					? {
							ok: false,
							fallo: 'respuesta_invalida',
							mensaje: 'Comprobante sin correlativo asignado'
						}
					: apisunat === null
						? {
								ok: false,
								fallo: 'no_configurado',
								mensaje: 'Facturación electrónica no configurada'
							}
						: await emitirComprobante(apisunat, {
								tipo: data.tipo,
								serie: serie!,
								correlativo,
								fechaIso: fecha,
								numeroDocumento: data.numeroDocumento,
								cliente: data.cliente,
								total,
								lineas: lineasSunat
							});
			const persistido = await persistirResultadoSunat(db, id, resultado);
			sunatEstado = persistido.estado;
			sunatError = persistido.error;
		} catch (err) {
			console.error('SUNAT: fallo inesperado tras guardar la venta', id, err);
			sunatError = 'Error interno al enviar a SUNAT';
		}
	}
	return { id, serie, correlativo, sunatEstado, sunatError };
}

/**
 * Corrige el/los método(s) de pago de una venta ya registrada (p.ej. la cajera marcó
 * Efectivo por error y en realidad fue Yape). Reemplaza sus caja_movimientos en vez de
 * editarlos en el sitio para no arrastrar valores viejos si cambia la cantidad de pagos.
 */
export async function corregirPagoVenta(
	db: D1Database,
	ventaId: string,
	nuevosPagos: PagoVentaDTO[]
): Promise<void> {
	if (nuevosPagos.length === 0) {
		throw new VentaInvalidaError('Debes indicar al menos un método de pago.');
	}

	const venta = await db
		.prepare('SELECT total, estado, sesion_caja_id FROM ventas WHERE id = ?')
		.bind(ventaId)
		.first<{ total: number; estado: EstadoVenta; sesion_caja_id: string | null }>();
	if (!venta) throw new VentaInvalidaError('Venta no encontrada.');
	if (venta.estado !== 'activa') {
		throw new VentaInvalidaError('No se puede editar el pago de una venta anulada.');
	}

	nuevosPagos = nuevosPagos.map((p) => ({ ...p, monto: redondear2(p.monto) }));
	const sumaPagos = nuevosPagos.reduce((acc, p) => acc + p.monto, 0);
	if (Math.abs(sumaPagos - venta.total) > 0.01) {
		throw new VentaInvalidaError('La suma de los pagos no coincide con el total de la venta.');
	}

	const movimientoPrevio = await db
		.prepare(
			`SELECT descripcion FROM caja_movimientos WHERE venta_id = ? AND tipo = 'venta' LIMIT 1`
		)
		.bind(ventaId)
		.first<{ descripcion: string }>();
	const descripcion = movimientoPrevio?.descripcion ?? '';

	const statements = [
		db.prepare(`DELETE FROM caja_movimientos WHERE venta_id = ? AND tipo = 'venta'`).bind(ventaId),
		...nuevosPagos.map((pago) =>
			db
				.prepare(
					`INSERT INTO caja_movimientos (id, sesion_id, tipo, metodo, monto, descripcion, venta_id)
					 VALUES (?, ?, 'venta', ?, ?, ?, ?)`
				)
				.bind(
					crypto.randomUUID(),
					venta.sesion_caja_id,
					pago.metodo,
					pago.monto,
					descripcion,
					ventaId
				)
		),
		db
			.prepare('UPDATE ventas SET metodo = ? WHERE id = ?')
			.bind(resumenMetodos(nuevosPagos), ventaId)
	];
	await db.batch(statements);

	if (venta.sesion_caja_id) {
		await recalcularEsperadosSiCerrada(db, venta.sesion_caja_id);
	}
}

interface VentaItemAnularRow {
	producto_id: string | null;
	presentacion_id: string | null;
	promo_id: string | null;
	cantidad: number;
	factor_unidades: number;
}

interface PromoComponenteRow {
	promo_id: string;
	presentacion_id: string;
	cantidad: number;
	factor_unidades: number;
	producto_id: string;
	nombre_producto: string;
	nombre_presentacion: string;
}

/** Lo que hay que devolverle al stock por una venta anulada, ya resuelto a presentaciones. */
interface DevolucionPresentacion {
	presentacionId: string;
	productoId: string;
	nombreProducto: string;
	nombrePresentacion: string;
	factorUnidades: number;
	cantidad: number;
	promoId: string | null;
	detalle: string | null;
}

/** Camino normal: el kardex ya dice, línea por línea, qué salió con esta venta. */
function devolucionesDesdeKardex(movimientos: MovimientoVentaRow[]): DevolucionPresentacion[] {
	return movimientos
		.filter((m) => m.presentacion_id !== null && m.producto_id !== null)
		.map((m) => ({
			presentacionId: m.presentacion_id!,
			productoId: m.producto_id!,
			nombreProducto: m.nombre_producto,
			nombrePresentacion: m.nombre_presentacion,
			factorUnidades: m.factor_unidades,
			// El movimiento de venta quedó en negativo; devolver es el mismo número al revés.
			cantidad: -m.cantidad,
			promoId: m.promo_id,
			detalle: m.detalle
		}));
}

/**
 * Camino de compatibilidad para las ventas anteriores a la migración 0011, que no tienen
 * movimientos: el desglose de cada promo se reconstruye contra promo_items. Ojo que eso
 * devuelve la composición ACTUAL del combo — si la promo se editó después de esa venta, no
 * es exactamente lo que salió, pero es todo lo que quedó registrado de aquella época.
 */
async function devolucionesReconstruidas(
	db: D1Database,
	ventaId: string
): Promise<DevolucionPresentacion[]> {
	const itemsResult = await db
		.prepare(
			`SELECT producto_id, presentacion_id, promo_id, cantidad, factor_unidades
			 FROM venta_items WHERE venta_id = ?`
		)
		.bind(ventaId)
		.all<VentaItemAnularRow>();

	const promoIds = [
		...new Set(itemsResult.results.filter((i) => i.promo_id).map((i) => i.promo_id!))
	];
	const componentesPorPromo = new Map<string, PromoComponenteRow[]>();
	if (promoIds.length > 0) {
		const placeholders = promoIds.map(() => '?').join(', ');
		const result = await db
			.prepare(
				`SELECT pi.promo_id, pi.presentacion_id, pi.cantidad, pp.factor_unidades,
					pp.producto_id, pp.nombre AS nombre_presentacion, p.nombre AS nombre_producto
				 FROM promo_items pi
				 JOIN producto_presentaciones pp ON pp.id = pi.presentacion_id
				 JOIN productos p ON p.id = pp.producto_id
				 WHERE pi.promo_id IN (${placeholders})`
			)
			.bind(...promoIds)
			.all<PromoComponenteRow>();
		for (const row of result.results) {
			const lista = componentesPorPromo.get(row.promo_id) ?? [];
			lista.push(row);
			componentesPorPromo.set(row.promo_id, lista);
		}
	}

	// Los ítems directos guardan el id de presentación pero no su nombre ni el del producto
	// (venta_items sí los copia, pero como nombre del ítem vendido); se leen del catálogo
	// para que la fila del kardex quede igual de completa que la de una venta nueva.
	const presentacionIdsDirectas = itemsResult.results
		.filter((i) => !i.promo_id && i.presentacion_id)
		.map((i) => i.presentacion_id!);
	const nombresPorPresentacion = new Map<string, { producto: string; presentacion: string }>();
	if (presentacionIdsDirectas.length > 0) {
		const placeholders = presentacionIdsDirectas.map(() => '?').join(', ');
		const result = await db
			.prepare(
				`SELECT pp.id, pp.nombre AS presentacion, p.nombre AS producto
				 FROM producto_presentaciones pp
				 JOIN productos p ON p.id = pp.producto_id
				 WHERE pp.id IN (${placeholders})`
			)
			.bind(...presentacionIdsDirectas)
			.all<{ id: string; presentacion: string; producto: string }>();
		for (const row of result.results) {
			nombresPorPresentacion.set(row.id, {
				producto: row.producto,
				presentacion: row.presentacion
			});
		}
	}

	const devoluciones: DevolucionPresentacion[] = [];
	for (const item of itemsResult.results) {
		if (item.promo_id) {
			for (const comp of componentesPorPromo.get(item.promo_id) ?? []) {
				devoluciones.push({
					presentacionId: comp.presentacion_id,
					productoId: comp.producto_id,
					nombreProducto: comp.nombre_producto,
					nombrePresentacion: comp.nombre_presentacion,
					factorUnidades: comp.factor_unidades,
					cantidad: comp.cantidad * item.cantidad,
					promoId: item.promo_id,
					detalle: 'Promo (composición reconstruida)'
				});
			}
		} else if (item.presentacion_id && item.producto_id) {
			const nombres = nombresPorPresentacion.get(item.presentacion_id);
			devoluciones.push({
				presentacionId: item.presentacion_id,
				productoId: item.producto_id,
				nombreProducto: nombres?.producto ?? 'Producto',
				nombrePresentacion: nombres?.presentacion ?? 'Unidad',
				factorUnidades: item.factor_unidades,
				cantidad: item.cantidad,
				promoId: null,
				detalle: null
			});
		}
	}
	return devoluciones;
}

/**
 * Anula una venta ya registrada: la marca 'anulada', borra sus caja_movimientos (mismo
 * patrón que corregirPagoVenta) y devuelve al stock lo que consumió, dejando la devolución
 * anotada en el kardex.
 *
 * La fuente de verdad son los movimientos_stock de la venta: ahí quedó, línea por línea, lo
 * que realmente salió, incluidos los componentes de cada promo tal como estaban al vender.
 * Reconstruirlo contra promo_items (lo que se hacía antes, y lo que sigue haciendo
 * devolucionesReconstruidas para las ventas viejas) devuelve la composición de HOY: desde
 * que las promos se pueden editar, eso significaba devolver stock de productos que nunca
 * salieron y no devolver el de los que sí.
 */
export interface ResultadoAnulacion {
	sunat: EstadoBajaSunat | 'no_aplica';
	mensaje: string | null;
}

interface VentaParaAnular {
	estado: EstadoVenta;
	sesion_caja_id: string | null;
	tipo: TipoVenta;
	serie: string | null;
	correlativo: number | null;
	fecha: string;
	sunat_estado: EstadoSunat;
}

export async function anularVenta(
	db: D1Database,
	ventaId: string,
	actor: ActorMovimiento = SIN_ACTOR,
	apisunat: ConfigApisunat | null = null
): Promise<ResultadoAnulacion> {
	const venta = await db
		.prepare(
			'SELECT estado, sesion_caja_id, tipo, serie, correlativo, fecha, sunat_estado FROM ventas WHERE id = ?'
		)
		.bind(ventaId)
		.first<VentaParaAnular>();
	if (!venta) throw new VentaInvalidaError('Venta no encontrada.');
	if (venta.estado === 'anulada') throw new VentaInvalidaError('Esta venta ya está anulada.');

	const registrados = await movimientosDeVenta(db, ventaId);
	const devoluciones =
		registrados.length > 0
			? devolucionesDesdeKardex(registrados)
			: await devolucionesReconstruidas(db, ventaId);

	const statements = [
		db
			.prepare(`UPDATE ventas SET estado = 'anulada', anulada_en = ? WHERE id = ?`)
			.bind(new Date().toISOString(), ventaId),
		db.prepare(`DELETE FROM caja_movimientos WHERE venta_id = ? AND tipo = 'venta'`).bind(ventaId)
	];
	for (const devolucion of devoluciones) {
		statements.push(
			db
				.prepare('UPDATE producto_presentaciones SET cantidad = cantidad + ? WHERE id = ?')
				.bind(devolucion.cantidad, devolucion.presentacionId),
			db
				.prepare('UPDATE productos SET cantidad = cantidad + ? WHERE id = ?')
				.bind(devolucion.cantidad * devolucion.factorUnidades, devolucion.productoId)
		);
	}
	statements.push(
		...sentenciasMovimientos(
			db,
			devoluciones.map((devolucion) => ({
				productoId: devolucion.productoId,
				nombreProducto: devolucion.nombreProducto,
				presentacionId: devolucion.presentacionId,
				nombrePresentacion: devolucion.nombrePresentacion,
				factorUnidades: devolucion.factorUnidades,
				cantidad: devolucion.cantidad,
				tipo: 'anulacion' as const,
				ventaId,
				promoId: devolucion.promoId,
				detalle: devolucion.detalle
			})),
			actor
		)
	);
	await db.batch(statements);

	if (venta.sesion_caja_id) {
		await recalcularEsperadosSiCerrada(db, venta.sesion_caja_id);
	}

	// La venta YA quedó anulada localmente sin importar lo que pase acá abajo — avisarle
	// a SUNAT es best-effort. Si esto tira, se informa como 'fallida' en vez de romper
	// la anulación que el cajero ya pidió y que ya se ejecutó.
	if (!esComprobanteElectronico(venta.tipo)) return { sunat: 'no_aplica', mensaje: null };
	try {
		return await bajaSunat(db, ventaId, venta.tipo, venta, apisunat);
	} catch (err) {
		console.error('SUNAT: fallo inesperado al anular en SUNAT', ventaId, err);
		const mensaje = 'Error interno al anular en SUNAT';
		await db
			.prepare(
				`UPDATE ventas SET sunat_baja_estado = 'fallida', sunat_baja_error = ?, sunat_actualizado_en = ? WHERE id = ?`
			)
			.bind(mensaje, new Date().toISOString(), ventaId)
			.run();
		return { sunat: 'fallida', mensaje };
	}
}

/** Compartido por anularVenta y el reintento manual (sincronizarSunatVenta). Persiste
 * sunat_baja_estado/sunat_baja_error en cada rama y nunca tira. */
async function bajaSunat(
	db: D1Database,
	ventaId: string,
	tipo: TipoComprobante,
	venta: Pick<VentaParaAnular, 'serie' | 'correlativo' | 'fecha' | 'sunat_estado'>,
	cfg: ConfigApisunat | null
): Promise<ResultadoAnulacion> {
	const persistirBaja = async (sunat: EstadoBajaSunat | 'no_aplica', mensaje: string | null) => {
		await db
			.prepare(
				`UPDATE ventas SET sunat_baja_estado = ?, sunat_baja_error = ?, sunat_actualizado_en = ? WHERE id = ?`
			)
			.bind(sunat === 'no_aplica' ? null : sunat, mensaje, new Date().toISOString(), ventaId)
			.run();
		return { sunat, mensaje };
	};

	if (venta.sunat_estado === 'rechazado') {
		// Nunca fue una boleta válida — no hay nada que anular en SUNAT.
		return persistirBaja('no_aplica', null);
	}
	if (!cfg) {
		return persistirBaja('fallida', 'Facturación electrónica no configurada');
	}
	if (venta.serie === null || venta.correlativo === null) {
		return persistirBaja('no_requerida', null);
	}

	let sunatEstadoActual: EstadoSunat = venta.sunat_estado;
	if (sunatEstadoActual === 'pendiente') {
		// Puede que sí haya llegado a SUNAT pese a que el envío original falló/tardó.
		const consulta = await consultarEstadoComprobante(cfg, tipo, venta.serie, venta.correlativo);
		if (consulta.ok) {
			const persistido = await persistirResultadoSunat(db, ventaId, consulta);
			sunatEstadoActual = persistido.estado;
			if (sunatEstadoActual === 'rechazado') return persistirBaja('no_aplica', null);
			if (sunatEstadoActual !== 'aceptado') return persistirBaja('sin_confirmar', persistido.error);
		} else if (consulta.fallo === 'no_encontrado') {
			// Nunca llegó a SUNAT; al estar la venta ya anulada, tampoco se va a reintentar el envío.
			return persistirBaja('no_requerida', null);
		} else {
			return persistirBaja('sin_confirmar', consulta.mensaje);
		}
	}

	// Acá sunatEstadoActual === 'aceptado': el comprobante es válido en SUNAT y hay que
	// avisarle que se anuló.
	const plazo = PLAZO_BAJA_DIAS[tipo];
	if (diasCalendarioLimaDesde(venta.fecha) > plazo) {
		return persistirBaja(
			'fuera_de_plazo',
			`Pasaron más de ${plazo} días desde la emisión: se necesita una nota de crédito (no soportada todavía) — gestionarla manualmente en apisunat.pe.`
		);
	}
	const resultado = await anularComprobanteSunat(cfg, venta.serie, venta.correlativo);
	if (!resultado.ok) return persistirBaja('fallida', resultado.mensaje);
	if (resultado.comprobante.estado === 'ACEPTADO')
		return persistirBaja('aceptada', resultado.comprobante.mensaje);
	if (resultado.comprobante.estado === 'PENDIENTE')
		return persistirBaja('en_proceso', resultado.comprobante.mensaje);
	return persistirBaja('fallida', resultado.comprobante.mensaje);
}

/**
 * Reintento manual desde la pantalla de Ventas: para una venta activa con boleta
 * 'pendiente', primero consulta si ya llegó a SUNAT antes de reemitir (nunca reemite
 * una que ya tiene un estado final, ni una venta anulada). Para una venta anulada,
 * reintenta la baja en SUNAT si quedó sin confirmar/fallida.
 */
export async function sincronizarSunatVenta(
	db: D1Database,
	ventaId: string,
	cfg: ConfigApisunat
): Promise<{
	sunatEstado: EstadoSunat;
	sunatError: string | null;
	sunatBajaEstado: EstadoBajaSunat | null;
	sunatBajaError: string | null;
}> {
	const venta = await db
		.prepare(
			`SELECT estado, tipo, serie, correlativo, fecha, sunat_estado, sunat_baja_estado,
				numero_documento, cliente, total
			 FROM ventas WHERE id = ?`
		)
		.bind(ventaId)
		.first<
			VentaParaAnular & {
				sunat_baja_estado: EstadoBajaSunat | null;
				numero_documento: string | null;
				cliente: string | null;
				total: number;
			}
		>();
	if (!venta) throw new VentaInvalidaError('Venta no encontrada.');
	if (!esComprobanteElectronico(venta.tipo)) {
		throw new VentaInvalidaError('Esta venta no requiere envío a SUNAT.');
	}
	if (venta.serie === null || venta.correlativo === null) {
		throw new VentaInvalidaError('Este comprobante no tiene número asignado.');
	}

	if (venta.estado === 'anulada') {
		const reintentable =
			venta.sunat_baja_estado === null
				? venta.sunat_estado === 'aceptado' || venta.sunat_estado === 'pendiente'
				: ['en_proceso', 'fallida', 'sin_confirmar'].includes(venta.sunat_baja_estado);
		if (reintentable) await bajaSunat(db, ventaId, venta.tipo, venta, cfg);
	} else if (venta.sunat_estado === 'pendiente') {
		const consulta = await consultarEstadoComprobante(
			cfg,
			venta.tipo,
			venta.serie,
			venta.correlativo
		);
		if (consulta.ok) {
			await persistirResultadoSunat(db, ventaId, consulta);
		} else if (consulta.fallo === 'no_encontrado') {
			const items = await db
				.prepare(
					`SELECT nombre_producto, promo_id, cantidad, precio_unitario FROM venta_items WHERE venta_id = ?`
				)
				.bind(ventaId)
				.all<{
					nombre_producto: string;
					promo_id: string | null;
					cantidad: number;
					precio_unitario: number;
				}>();
			const lineas: LineaComprobante[] = items.results.map((it) => ({
				descripcion: it.nombre_producto,
				cantidad: it.cantidad,
				precioUnitario: it.precio_unitario
			}));
			const emitido = await emitirComprobante(cfg, {
				tipo: venta.tipo,
				serie: venta.serie,
				correlativo: venta.correlativo,
				fechaIso: venta.fecha,
				numeroDocumento: venta.numero_documento,
				cliente: venta.cliente,
				total: venta.total,
				lineas
			});
			await persistirResultadoSunat(db, ventaId, emitido);
		} else {
			await persistirResultadoSunat(db, ventaId, consulta);
		}
	}

	const actualizada = await db
		.prepare(
			`SELECT sunat_estado, sunat_error, sunat_baja_estado, sunat_baja_error FROM ventas WHERE id = ?`
		)
		.bind(ventaId)
		.first<{
			sunat_estado: EstadoSunat;
			sunat_error: string | null;
			sunat_baja_estado: EstadoBajaSunat | null;
			sunat_baja_error: string | null;
		}>();
	return {
		sunatEstado: actualizada!.sunat_estado,
		sunatError: actualizada!.sunat_error,
		sunatBajaEstado: actualizada!.sunat_baja_estado,
		sunatBajaError: actualizada!.sunat_baja_error
	};
}

export interface ResumenVentas {
	dia: number;
	semana: number;
	mes: number;
	anio: number;
}

export async function resumenVentas(db: D1Database): Promise<ResumenVentas> {
	// Los 4 buckets (día/semana/mes/año) están siempre dentro del año calendario actual
	// en hora Lima, así que acotar por "fecha >= inicio del año" (comparación directa
	// sobre la columna, no envuelta en función) deja que idx_ventas_estado_fecha descarte
	// de entrada los años anteriores; sin este límite la consulta escaneaba TODA la
	// historia de ventas activas en cada carga del dashboard, cada vez más lento a medida
	// que crece la tabla. Los CASE de abajo sí envuelven fecha en date()/strftime() con el
	// offset de Lima (necesario para el corte de día/semana/mes/año correcto), pero ya
	// operan solo sobre el subconjunto del año actual gracias al WHERE.
	const row = await db
		.prepare(
			`SELECT
				COALESCE(SUM(CASE WHEN date(fecha, ?) = date('now', ?) THEN total ELSE 0 END), 0) AS dia,
				COALESCE(SUM(CASE WHEN strftime('%Y-%W', fecha, ?) = strftime('%Y-%W', 'now', ?) THEN total ELSE 0 END), 0) AS semana,
				COALESCE(SUM(CASE WHEN strftime('%Y-%m', fecha, ?) = strftime('%Y-%m', 'now', ?) THEN total ELSE 0 END), 0) AS mes,
				COALESCE(SUM(CASE WHEN strftime('%Y', fecha, ?) = strftime('%Y', 'now', ?) THEN total ELSE 0 END), 0) AS anio
			 FROM ventas WHERE estado = 'activa' AND fecha >= date('now', ?, 'start of year', ?)`
		)
		.bind(
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA,
			OFFSET_LIMA_INVERSO
		)
		.first<ResumenVentas>();
	return row ?? { dia: 0, semana: 0, mes: 0, anio: 0 };
}
