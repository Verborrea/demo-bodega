<script lang="ts">
	import { tick } from 'svelte';
	import { goto, invalidate } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import {
		Plus,
		Search,
		X,
		Receipt,
		Printer,
		RotateCcw,
		FunnelX,
		CircleCheck,
		CircleX,
		CircleMinus,
		CircleAlert,
		Pencil,
		Trash2,
		Package,
		Clock,
		CreditCard,
		RefreshCw,
		FileText,
		TriangleAlert
	} from '@lucide/svelte';
	import { getLocalTimeZone, type DateValue } from '@internationalized/date';
	import {
		Breadcrumbs,
		Input,
		DateRangePicker,
		Dialog,
		Checkbox,
		MultiSelect,
		Select,
		MoneyInput,
		DataTable,
		MenuReporte,
		type ColumnaTabla
	} from '$lib/components/ui';
	import type { EstadoVenta, OrdenVenta, TipoVenta } from '$lib/server/ventas';
	import {
		currency,
		formatFecha,
		formatFechaHora,
		formatHora,
		esperarImagenesListas,
		formatPagos,
		redondear2
	} from '$lib/utils';
	import { exportarPDF, exportarExcel } from '$lib/export';
	import Button from '$lib/components/ui/Button.svelte';
	import TicketImpresion from '$lib/components/TicketImpresion.svelte';
	import type { PageData } from './$types';
	import type { VentaDTO } from '$lib/server/ventas';
	import type { MetodoCaja } from '$lib/server/caja';
	import { guardarRehacerVenta, type ItemRehacer } from '$lib/rehacerVenta';
	import { MENSAJE_RANGO_MAXIMO, rangoExcedeMaximo } from '$lib/rangoReporte';

	const METODOS_PAGO: MetodoCaja[] = ['Efectivo', 'Yape', 'Tarjeta'];
	// Las ventas sin cliente (anteriores al cliente por defecto de Nueva Venta) se muestran con el mismo nombre.
	const CLIENTES_VARIOS = 'CLIENTES VARIOS';

	function colorPago(metodo: string) {
		return metodo === 'Efectivo'
			? 'bg-badge-green-bg text-badge-green-fg'
			: metodo === 'Tarjeta'
				? 'bg-sky-100 text-sky-700'
				: 'bg-violet-100 text-violet-700';
	}

	let { data }: { data: PageData } = $props();

	type RangoFecha = { start: DateValue | undefined; end: DateValue | undefined };

	const TIPO_LABEL: Record<TipoVenta, string> = {
		boleta: 'Boleta de Venta',
		nota_pedido: 'Nota de Pedido'
	};

	const TIPO_BADGE: Record<TipoVenta, string> = {
		boleta: 'bg-yellow-100 text-yellow-800',
		nota_pedido: 'bg-stone-100 text-stone-600'
	};

	const TIPO_OPCIONES = [
		{ value: 'nota_pedido', label: TIPO_LABEL.nota_pedido },
		{ value: 'boleta', label: TIPO_LABEL.boleta }
	] satisfies { value: TipoVenta; label: string }[];
	const PAGO_OPCIONES = METODOS_PAGO.map((metodo) => ({ value: metodo, label: metodo }));
	const ESTADO_OPCIONES = [
		{ value: 'activa', label: 'Activa' },
		{ value: 'anulada', label: 'Anulada' }
	] satisfies { value: EstadoVenta; label: string }[];

	/** Texto plano "(Anulada)" para los reportes exportados; en pantalla el tipo y el estado
	 * son badges (ver badgesTipo). La columna SUNAT (para boleta) no repite esto: solo muestra
	 * el resultado de avisarle a SUNAT (aceptado/en proceso/falló), que es un dato distinto
	 * ("se canceló" vs "qué pasó con SUNAT al cancelarla"). */
	function etiquetaComprobante(tipoLabel: string, estado: string): string {
		return estado === 'anulada' ? `${tipoLabel} (Anulada)` : tipoLabel;
	}

	const pageSize = data.pageSize;
	let ventasRaw = $state<VentaDTO[]>(data.ventas);
	let total = $state(data.total);
	let sumaTotal = $state(data.sumaTotal);
	let pagina = $state(1);
	let cargando = $state(false);

	const totalPaginas = $derived(Math.max(1, Math.ceil(total / pageSize)));

	const ventas = $derived(
		ventasRaw.map((v) => {
			const totalItems = v.items.reduce((acc, i) => acc + i.cantidad, 0);
			return {
				id: v.id,
				hora: formatHora(v.fecha),
				fecha: new Date(v.fecha),
				cliente: v.cliente ?? undefined,
				cajero: v.cajeroNombre,
				descripcion: `${totalItems} producto${totalItems === 1 ? '' : 's'}`,
				pago: v.metodo,
				pagos: v.pagos,
				total: v.total,
				estado: v.estado,
				anuladaEn: v.anuladaEn,
				tipo: TIPO_LABEL[v.tipo] ?? v.tipo,
				tipoRaw: v.tipo,
				esComprobante: v.tipo === 'boleta',
				numeroComprobante: v.serie && v.correlativo ? `${v.serie}-${v.correlativo}` : null,
				sunatEstado: v.sunatEstado,
				sunatError: v.sunatError,
				sunatXmlUrl: v.sunatXmlUrl,
				sunatCdrUrl: v.sunatCdrUrl,
				sunatPdfTicketUrl: v.sunatPdfTicketUrl,
				sunatPdfA4Url: v.sunatPdfA4Url,
				sunatBajaEstado: v.sunatBajaEstado,
				sunatBajaError: v.sunatBajaError,
				notaCredito: v.notaCredito,
				numeroDocumento: v.numeroDocumento,
				items: v.items
			};
		})
	);

	const SUNAT_BADGE: Record<string, { label: string; clase: string }> = {
		pendiente: { label: 'Pendiente de envío', clase: 'bg-amber-100 text-amber-700' },
		aceptado: { label: 'Aceptada por SUNAT', clase: 'bg-badge-green-bg text-badge-green-fg' },
		rechazado: { label: 'Rechazada por SUNAT', clase: 'bg-red-100 text-red-700' },
		// No aplica a boleta (siempre se manda a SUNAT) — queda para nota_pedido, que nunca
		// tiene comprobante fiscal.
		no_aplica: { label: 'No se envía a SUNAT', clase: 'bg-stone-100 text-stone-500' }
	};
	const BAJA_LABEL: Record<string, string> = {
		aceptada: 'Anulada en SUNAT',
		en_proceso: 'Anulación en SUNAT en proceso',
		fallida: 'No se pudo anular en SUNAT',
		sin_confirmar: 'No se pudo confirmar el estado en SUNAT',
		fuera_de_plazo: 'Fuera de plazo: requiere nota de crédito manual',
		no_requerida: 'No llegó a SUNAT; nada que anular'
	};
	const BAJA_REINTENTABLE = ['en_proceso', 'fallida', 'sin_confirmar'];

	// Versión corta de SUNAT_BADGE/BAJA_LABEL, solo para la columna SUNAT de la tabla y los
	// reportes exportados: ahí el espacio es angosto y una palabra sola se ve mejor que la
	// frase completa. El detalle de venta sigue usando las frases largas de arriba, donde sí
	// hay espacio para el contexto completo.
	const SUNAT_ESTADO_CORTO: Record<string, string> = {
		pendiente: 'Pendiente',
		aceptado: 'Aceptado',
		rechazado: 'Rechazado',
		no_aplica: 'No aplica'
	};
	const BAJA_LABEL_CORTO: Record<string, string> = {
		aceptada: 'Anulado',
		en_proceso: 'Anulando',
		fallida: 'Falló',
		sin_confirmar: 'Sin confirmar',
		fuera_de_plazo: 'Fuera de plazo',
		no_requerida: 'No aplica'
	};

	// En la tabla el estado de SUNAT se muestra solo como ícono (ocupa menos que una palabra); el
	// significado completo va en el title. La tarjeta móvil, que sí tiene espacio, usa el texto.
	const ICONO_SUNAT: Record<string, typeof CircleCheck> = {
		pendiente: Clock,
		aceptado: CircleCheck,
		rechazado: CircleX
	};
	const ICONO_BAJA: Record<string, typeof CircleCheck> = {
		aceptada: CircleCheck,
		en_proceso: Clock,
		fallida: CircleX,
		sin_confirmar: CircleAlert,
		fuera_de_plazo: TriangleAlert,
		no_requerida: CircleMinus
	};

	/** Estado a mostrar en la columna SUNAT: null cuando no hay nada que reportar de SUNAT
	 * (se deja la celda vacía) — nota de pedido, o una anulada que nunca llegó a intentar
	 * la baja. El "¿está cancelada?" ya lo dice, igual para boleta o nota de pedido, la
	 * columna Tipo (badge "Anulada") — acá solo va lo específico de SUNAT (qué pasó al
	 * avisarle de la anulación), que es información aparte, no la repite. `titulo` es la
	 * frase completa (con el motivo si algo falló) para el tooltip del ícono. */
	function estadoSunatColumna(v: (typeof ventas)[number]): {
		label: string;
		clase: string;
		icono: typeof CircleCheck;
		titulo: string;
	} | null {
		if (!v.esComprobante) return null;
		if (v.estado === 'anulada') {
			const baja = v.sunatBajaEstado;
			if (baja === null) return null;
			const resuelto = baja === 'aceptada' || baja === 'no_requerida';
			const detalle = !resuelto && v.sunatBajaError ? ` — ${v.sunatBajaError}` : '';
			const nota = v.notaCredito
				? ` · Nota de crédito ${v.notaCredito.serie}-${v.notaCredito.correlativo}`
				: '';
			return {
				label: BAJA_LABEL_CORTO[baja] ?? baja,
				clase: resuelto
					? 'bg-stone-100 text-stone-500'
					: baja === 'en_proceso'
						? 'bg-amber-100 text-amber-700'
						: 'bg-red-100 text-red-700',
				icono: ICONO_BAJA[baja] ?? CircleAlert,
				titulo: `${BAJA_LABEL[baja] ?? baja}${nota}${detalle}`
			};
		}
		if (v.sunatEstado === 'no_aplica') return null;
		const badge = SUNAT_BADGE[v.sunatEstado] ?? SUNAT_BADGE.pendiente;
		const detalle = v.sunatEstado !== 'aceptado' && v.sunatError ? ` — ${v.sunatError}` : '';
		return {
			label: SUNAT_ESTADO_CORTO[v.sunatEstado] ?? 'Pendiente',
			clase: badge.clase,
			icono: ICONO_SUNAT[v.sunatEstado] ?? Clock,
			titulo: `${badge.label}${detalle}`
		};
	}

	function puedeReintentarSunat(v: (typeof ventas)[number]) {
		if (!v.esComprobante || !v.numeroComprobante) return false;
		return v.estado === 'activa'
			? v.sunatEstado === 'pendiente'
			: BAJA_REINTENTABLE.includes(v.sunatBajaEstado ?? '');
	}

	let reintentandoSunat = $state(false);
	async function reintentarSunat() {
		if (!ventaSeleccionada || reintentandoSunat) return;
		reintentandoSunat = true;
		try {
			const res = await fetch(`/api/ventas/${ventaSeleccionada.id}/sunat`, { method: 'POST' });
			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo sincronizar con SUNAT');
				return;
			}
			toast.success('Estado de SUNAT actualizado');
			await cargarVentas();
			const actualizada = ventas.find((v) => v.id === ventaSeleccionada!.id);
			if (actualizada) ventaSeleccionada = actualizada;
		} finally {
			reintentandoSunat = false;
		}
	}

	let busqueda = $state('');
	let rango = $state<RangoFecha>({ start: undefined, end: undefined });
	let tiposSel = $state<TipoVenta[]>([]);
	let metodosSel = $state<MetodoCaja[]>([]);
	let estadosSel = $state<EstadoVenta[]>([]);
	const hayFiltros = $derived(
		busqueda.trim() !== '' ||
			(rango.start !== undefined && rango.end !== undefined) ||
			tiposSel.length > 0 ||
			metodosSel.length > 0 ||
			estadosSel.length > 0
	);

	let ordenPor = $state<OrdenVenta | null>('fecha');
	let ordenDireccion = $state<'asc' | 'desc'>('desc');
	// Tres estados por columna: asc → desc → sin orden (vuelve al orden por defecto del servidor).
	function onOrdenar(columnaId: string) {
		if (ordenPor === columnaId) {
			if (ordenDireccion === 'asc') {
				ordenDireccion = 'desc';
			} else {
				ordenPor = null;
			}
		} else {
			ordenPor = columnaId as OrdenVenta;
			ordenDireccion = 'asc';
		}
		pagina = 1;
		cargarVentas({ conResumen: false });
	}

	/** Filtros activos como querystring: los mismos para la tabla y para exportar. */
	function paramsFiltros(): URLSearchParams {
		const params = new URLSearchParams();
		if (busqueda.trim()) params.set('search', busqueda.trim());
		for (const tipo of tiposSel) params.append('tipo', tipo);
		for (const metodo of metodosSel) params.append('metodo', metodo);
		for (const estado of estadosSel) params.append('estado', estado);
		if (rango.start)
			params.set('fechaInicio', rango.start.toDate(getLocalTimeZone()).toISOString());
		if (rango.end) params.set('fechaFin', rango.end.toDate(getLocalTimeZone()).toISOString());
		return params;
	}

	// Evita que una respuesta vieja (filtro/página ya reemplazados) llegue después de una
	// más nueva y pise el resultado correcto en pantalla.
	let cargaId = 0;
	/** `conResumen: false` cuando solo cambia la página o el orden (mismos filtros): el total y la
	 * suma que ya se muestran siguen valiendo, y recalcularlos recorre todas las ventas. */
	async function cargarVentas({
		conResumen = true,
		reintento = false
	}: { conResumen?: boolean; reintento?: boolean } = {}) {
		const miCarga = ++cargaId;
		cargando = true;
		try {
			const params = paramsFiltros();
			params.set('page', String(pagina));
			params.set('pageSize', String(pageSize));
			params.set('orderBy', ordenPor ?? 'fecha');
			params.set('orderDir', ordenPor ? ordenDireccion : 'desc');
			if (!conResumen) params.set('resumen', '0');
			const res = await fetch(`/api/ventas?${params}`);
			if (!res.ok) throw new Error('request failed');
			const resultado = (await res.json()) as {
				ventas: VentaDTO[];
				total?: number;
				sumaTotal?: number;
			};
			if (miCarga !== cargaId) return;
			ventasRaw = resultado.ventas;
			if (resultado.total !== undefined) total = resultado.total;
			if (resultado.sumaTotal !== undefined) sumaTotal = resultado.sumaTotal;
			// La página pedida ya no existe (p. ej. se anuló la última venta de la última página con el
			// filtro "Activa"): se vuelve a la última que sí tenga ventas, recontando si el total podía
			// estar viejo, en vez de dejar "No se encontraron ventas" con ventas en otras páginas.
			if (resultado.ventas.length === 0 && pagina > 1 && !reintento) {
				pagina = resultado.total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : 1;
				await cargarVentas({ conResumen: resultado.total === undefined, reintento: true });
			}
		} catch {
			if (miCarga === cargaId) toast.error('No se pudo cargar las ventas');
		} finally {
			if (miCarga === cargaId) cargando = false;
		}
	}

	// Trae TODAS las ventas que calzan con los filtros activos (no solo la página visible).
	// /api/ventas recorta pageSize a un máximo de 100 aunque se pida más — pedir un solo
	// bloque de "total" registros se recortaba en silencio a los primeros 100 (los más
	// recientes, por el orden por defecto "fecha desc"), así que el PDF/Excel terminaba
	// mostrando solo los últimos 1-2 días de ventas en vez de la lista completa. Acá se
	// pagina en bloques de 100 hasta juntarlas todas.
	const TAMANO_PAGINA_EXPORT = 100;

	async function obtenerVentasParaExportar(): Promise<VentaDTO[]> {
		const base = paramsFiltros();
		base.set('pageSize', String(TAMANO_PAGINA_EXPORT));
		base.set('orderBy', ordenPor ?? 'fecha');
		base.set('orderDir', ordenPor ? ordenDireccion : 'desc');
		// El total ya está en pantalla: no hace falta recalcularlo en cada bloque de 100.
		base.set('resumen', '0');

		const todas: VentaDTO[] = [];
		let paginaExport = 1;
		for (;;) {
			const params = new URLSearchParams(base);
			params.set('page', String(paginaExport));
			const res = await fetch(`/api/ventas?${params}`);
			if (!res.ok) throw new Error('request failed');
			const resultado = (await res.json()) as { ventas: VentaDTO[] };
			todas.push(...resultado.ventas);
			if (resultado.ventas.length < TAMANO_PAGINA_EXPORT) break;
			paginaExport++;
		}
		return todas;
	}

	/** Misma lógica que estadoSunatColumna(), pero en texto plano (sin color) para los
	 * reportes exportados — v acá es el VentaDTO crudo de la API, no la fila ya mapeada. */
	function estadoSunatTexto(v: VentaDTO): string {
		if (v.tipo !== 'boleta') return '';
		if (v.estado === 'anulada') {
			const baja = v.sunatBajaEstado;
			return baja === null ? '' : (BAJA_LABEL_CORTO[baja] ?? baja);
		}
		if (v.sunatEstado === 'no_aplica') return '';
		return SUNAT_ESTADO_CORTO[v.sunatEstado] ?? 'Pendiente';
	}

	function filasExport(lista: VentaDTO[]) {
		return lista.map((v) => {
			const totalItems = v.items.reduce((acc, i) => acc + i.cantidad, 0);
			return {
				fecha: formatFecha(v.fecha),
				hora: formatHora(v.fecha),
				comprobante: etiquetaComprobante(TIPO_LABEL[v.tipo] ?? v.tipo, v.estado),
				numeroDocumento: v.serie && v.correlativo ? `${v.serie}-${v.correlativo}` : '',
				cliente: v.cliente ?? CLIENTES_VARIOS,
				cajero: v.cajeroNombre,
				productos: `${totalItems} producto${totalItems === 1 ? '' : 's'}`,
				pago: formatPagos(v.pagos),
				sunat: estadoSunatTexto(v),
				total: v.total
			};
		});
	}

	let exportando = $state(false);

	/** Exportar recorre todas las ventas que calzan con los filtros, así que se exige un rango de
	 * fechas y que no pase de 3 meses (ver rangoReporte.ts). La tabla sí se puede mirar sin rango. */
	function textoRangoExportado(): string {
		const dia = (d: DateValue | undefined) => formatFecha(d!.toDate(getLocalTimeZone()));
		return `Del ${dia(rango.start)} al ${dia(rango.end)}`;
	}

	function puedeExportar(): boolean {
		if (!rango.start || !rango.end) {
			toast.error(`Elige un rango de fechas para exportar. ${MENSAJE_RANGO_MAXIMO}`);
			return false;
		}
		if (rangoExcedeMaximo(rango.start.toString(), rango.end.toString())) {
			toast.error(MENSAJE_RANGO_MAXIMO);
			return false;
		}
		return true;
	}

	async function onExportarPDF() {
		if (!total || exportando || !puedeExportar()) return;
		// Antes del await: mientras se arma el reporte el usuario puede tocar el rango.
		const subtitulo = textoRangoExportado();
		exportando = true;
		try {
			const filas = filasExport(await obtenerVentasParaExportar());
			await exportarPDF({
				titulo: 'Reporte de Ventas',
				subtitulo,
				resumen: [
					{ label: 'Ventas', value: String(filas.length) },
					{ label: 'Total', value: currency(sumaTotal) }
				],
				columnas: [
					'Fecha',
					'Hora',
					'Comprobante',
					'N° Documento',
					'Cliente',
					'Cajero',
					'Productos',
					'Pago',
					'SUNAT',
					'Total'
				],
				alineaciones: [
					'left',
					'left',
					'left',
					'left',
					'left',
					'left',
					'left',
					'left',
					'left',
					'right'
				],
				filas: filas.map((f) => [
					f.fecha,
					f.hora,
					f.comprobante,
					f.numeroDocumento,
					f.cliente,
					f.cajero,
					f.productos,
					f.pago,
					f.sunat,
					currency(f.total)
				])
			});
		} catch {
			toast.error('No se pudo generar el PDF');
		} finally {
			exportando = false;
		}
	}

	async function onExportarExcel() {
		if (!total || exportando || !puedeExportar()) return;
		exportando = true;
		try {
			const filas = filasExport(await obtenerVentasParaExportar());
			await exportarExcel({
				nombreArchivo: 'reporte-ventas',
				hojaNombre: 'Ventas',
				titulo: 'Reporte de Ventas',
				filas: filas.map((f) => ({
					Fecha: f.fecha,
					Hora: f.hora,
					Comprobante: f.comprobante,
					'N° Documento': f.numeroDocumento,
					Cliente: f.cliente,
					Cajero: f.cajero,
					Productos: f.productos,
					Pago: f.pago,
					SUNAT: f.sunat,
					Total: f.total
				}))
			});
		} catch {
			toast.error('No se pudo generar el Excel');
		} finally {
			exportando = false;
		}
	}

	// Cualquier cambio de filtro recarga desde la página 1; la espera junta varios cambios seguidos
	// (teclear, tildar varias opciones) en una sola consulta.
	const filtrosKey = $derived(
		JSON.stringify([
			busqueda.trim(),
			tiposSel,
			metodosSel,
			estadosSel,
			rango.start?.toString(),
			rango.end?.toString()
		])
	);
	let montado = false;
	$effect(() => {
		void filtrosKey;
		if (!montado) {
			montado = true;
			return;
		}
		pagina = 1;
		const espera = setTimeout(() => cargarVentas(), 300);
		return () => clearTimeout(espera);
	});

	function limpiarFiltros() {
		busqueda = '';
		tiposSel = [];
		metodosSel = [];
		estadosSel = [];
		rango = { start: undefined, end: undefined };
	}

	function irAPagina(n: number) {
		if (n < 1 || n > totalPaginas || n === pagina) return;
		pagina = n;
		cargarVentas({ conResumen: false });
	}

	/** Fecha del ticket impreso: dd/mm/aaaa a propósito, formato de recibo, no la fecha humana de la UI. */
	function formatearFechaTicket(fecha: Date) {
		const dd = String(fecha.getDate()).padStart(2, '0');
		const mm = String(fecha.getMonth() + 1).padStart(2, '0');
		return `${dd}/${mm}/${fecha.getFullYear()}`;
	}

	let detalleOpen = $state(false);
	let ventaSeleccionada = $state<(typeof ventas)[number] | null>(null);

	function verDetalle(venta: (typeof ventas)[number]) {
		ventaSeleccionada = venta;
		editandoPago = false;
		detalleOpen = true;
	}

	// --- Corregir método(s) de pago de una venta ya registrada (p.ej. la cajera se
	// equivocó de método). A diferencia de "Anular" (solo de interfaz), esto sí persiste. ---
	let editandoPago = $state(false);
	let pagosEdicion = $state<{ metodo: MetodoCaja; monto: string }[]>([]);
	let guardandoPago = $state(false);

	const sumaPagosEdicion = $derived(
		pagosEdicion.reduce((acc, p) => acc + (Number(p.monto) || 0), 0)
	);
	const restantePagoEdicion = $derived(
		ventaSeleccionada ? Math.round((ventaSeleccionada.total - sumaPagosEdicion) * 100) / 100 : 0
	);

	function iniciarEdicionPago() {
		if (!ventaSeleccionada) return;
		pagosEdicion =
			ventaSeleccionada.pagos.length > 0
				? ventaSeleccionada.pagos.map((p) => ({ metodo: p.metodo, monto: String(p.monto) }))
				: [{ metodo: 'Efectivo', monto: String(ventaSeleccionada.total) }];
		editandoPago = true;
	}

	function agregarPagoEdicion() {
		const usados = new Set(pagosEdicion.map((p) => p.metodo));
		const disponible = METODOS_PAGO.find((m) => !usados.has(m)) ?? 'Efectivo';
		pagosEdicion = [...pagosEdicion, { metodo: disponible, monto: '' }];
	}

	function quitarPagoEdicion(index: number) {
		if (pagosEdicion.length <= 1) return;
		pagosEdicion = pagosEdicion.filter((_, i) => i !== index);
	}

	async function guardarPagoEdicion() {
		if (!ventaSeleccionada) return;
		if (Math.abs(restantePagoEdicion) > 0.01) {
			toast.error('Los montos no cuadran con el total de la venta');
			return;
		}
		guardandoPago = true;
		try {
			const res = await fetch(`/api/ventas/${ventaSeleccionada.id}/pago`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pagos: pagosEdicion.map((p) => ({ metodo: p.metodo, monto: Number(p.monto) || 0 }))
				})
			});
			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo actualizar el pago');
				return;
			}
			toast.success('Pago corregido');
			editandoPago = false;
			await cargarVentas();
			const actualizada = ventas.find((v) => v.id === ventaSeleccionada!.id);
			if (actualizada) ventaSeleccionada = actualizada;
		} finally {
			guardandoPago = false;
		}
	}

	// Plazo en que SUNAT acepta dar de baja una boleta con resumen diario (ver PLAZO_BAJA_DIAS en
	// sunat.ts); pasado eso solo se puede anular con nota de crédito.
	const PLAZO_BAJA_DIAS = 5;

	/** Días de calendario (hora Lima) desde la emisión — el servidor hace la misma cuenta. */
	function diasDesdeEmision(fecha: Date): number {
		const aLima = (d: Date) =>
			new Date(d.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
		return Math.round(
			(new Date(aLima(new Date())).getTime() - new Date(aLima(fecha)).getTime()) / 86_400_000
		);
	}

	let confirmAnularOpen = $state(false);
	let ventaAAnular = $state<(typeof ventas)[number] | null>(null);
	let anulando = $state(false);
	let devolverStock = $state(true);
	let usarNotaCredito = $state(false);

	// Solo una boleta que no fue rechazada tiene algo que anular en SUNAT.
	const anulacionTocaSunat = $derived(
		!!ventaAAnular && ventaAAnular.esComprobante && ventaAAnular.sunatEstado !== 'rechazado'
	);
	const bajaFueraDePlazo = $derived(
		!!ventaAAnular && anulacionTocaSunat && diasDesdeEmision(ventaAAnular.fecha) > PLAZO_BAJA_DIAS
	);

	function pedirAnular(venta: (typeof ventas)[number]) {
		ventaAAnular = venta;
		devolverStock = true;
		usarNotaCredito =
			venta.esComprobante &&
			venta.sunatEstado !== 'rechazado' &&
			diasDesdeEmision(venta.fecha) > PLAZO_BAJA_DIAS;
		confirmAnularOpen = true;
	}

	async function confirmarAnular() {
		if (!ventaAAnular) return;
		const conNota = anulacionTocaSunat && usarNotaCredito;
		anulando = true;
		try {
			const res = await fetch(`/api/ventas/${ventaAAnular.id}/anular`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ devolverStock, notaCredito: conNota })
			});
			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo anular la venta');
				return;
			}
			const cuerpo = (await res.json()) as { sunat: string; mensaje: string | null };
			if (cuerpo.sunat === 'no_aplica' || cuerpo.sunat === 'no_requerida') {
				toast.success('Venta anulada');
			} else if (cuerpo.sunat === 'aceptada') {
				toast.success(
					conNota ? 'Venta anulada — nota de crédito aceptada por SUNAT' : 'Venta anulada'
				);
			} else if (cuerpo.sunat === 'en_proceso') {
				toast.success(
					conNota
						? 'Venta anulada — nota de crédito en proceso en SUNAT'
						: 'Venta anulada — anulación en SUNAT en proceso'
				);
			} else {
				toast.error(
					`Venta anulada — no se pudo anular en SUNAT: ${cuerpo.mensaje ?? cuerpo.sunat}`,
					{ duration: 6000 }
				);
			}
			confirmAnularOpen = false;
			await Promise.all([cargarVentas(), invalidate('caja:sesion')]);
		} finally {
			anulando = false;
		}
	}

	// Boleta ya anulada en el sistema cuyo aviso a SUNAT no se resolvió (fuera de plazo, falló,
	// quedó sin confirmar): se puede anular con nota de crédito desde el detalle.
	function puedeGenerarNota(v: (typeof ventas)[number]) {
		return (
			v.estado === 'anulada' &&
			v.esComprobante &&
			v.sunatEstado === 'aceptado' &&
			!v.notaCredito &&
			v.sunatBajaEstado !== 'aceptada' &&
			v.sunatBajaEstado !== 'en_proceso'
		);
	}

	let generandoNota = $state(false);
	async function generarNotaCredito() {
		if (!ventaSeleccionada || generandoNota) return;
		generandoNota = true;
		try {
			const res = await fetch(`/api/ventas/${ventaSeleccionada.id}/nota-credito`, {
				method: 'POST'
			});
			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo generar la nota de crédito');
				return;
			}
			const cuerpo = (await res.json()) as { sunat: string; mensaje: string | null };
			if (cuerpo.sunat === 'aceptada') {
				toast.success('Nota de crédito aceptada por SUNAT');
			} else if (cuerpo.sunat === 'en_proceso') {
				toast('Nota de crédito enviada — SUNAT aún no confirma', { icon: '⏳' });
			} else {
				toast.error(`No se pudo generar la nota de crédito: ${cuerpo.mensaje ?? cuerpo.sunat}`, {
					duration: 6000
				});
			}
			await cargarVentas();
			const actualizada = ventas.find((v) => v.id === ventaSeleccionada!.id);
			if (actualizada) ventaSeleccionada = actualizada;
		} finally {
			generandoNota = false;
		}
	}

	// --- Rehacer: lleva los productos de una venta a Nueva Venta como nota de pedido o boleta ---
	let rehacerOpen = $state(false);
	let ventaARehacer = $state<(typeof ventas)[number] | null>(null);

	// Una línea cuyo producto ya no existe en el catálogo (producto_id nulo) no se puede volver a
	// cargar: se avisa en el modal en vez de dejarla caer en silencio.
	const itemsRehacer = $derived.by<ItemRehacer[]>(() => {
		if (!ventaARehacer) return [];
		const items: ItemRehacer[] = [];
		for (const item of ventaARehacer.items) {
			const base = {
				cantidad: item.cantidad,
				precioUnitario: item.precioUnitario,
				nombre: item.nombreProducto
			};
			if (item.promoId) {
				items.push({ tipo: 'promo', promoId: item.promoId, ...base });
			} else if (item.productoId && item.presentacionId) {
				items.push({
					tipo: 'producto',
					productoId: item.productoId,
					presentacionId: item.presentacionId,
					...base
				});
			}
		}
		return items;
	});
	const omitidosRehacer = $derived(
		ventaARehacer ? ventaARehacer.items.length - itemsRehacer.length : 0
	);

	function pedirRehacer(venta: (typeof ventas)[number]) {
		ventaARehacer = venta;
		rehacerOpen = true;
	}

	function confirmarRehacer() {
		const venta = ventaARehacer;
		if (!venta || itemsRehacer.length === 0) return;
		// `pago` es el texto guardado en la venta: un método solo ("Yape") o varios ("Efectivo + Yape").
		const guardado = guardarRehacerVenta({
			tipo: venta.tipoRaw,
			items: itemsRehacer,
			cliente: venta.cliente ?? null,
			numeroDocumento: venta.numeroDocumento,
			metodo: METODOS_PAGO.includes(venta.pago as MetodoCaja) ? venta.pago : null
		});
		if (!guardado) {
			toast.error('No se pudo preparar la venta: el navegador bloquea el almacenamiento');
			return;
		}
		rehacerOpen = false;
		goto('/dashboard/venta');
	}

	// Ticket de impresión: usa la API de impresión del navegador (window.print), así que
	// funciona con cualquier impresora instalada en el sistema, incluida una ticketera térmica.
	let ventaParaImprimir = $state<(typeof ventas)[number] | null>(null);
	let ticketImpresionRef: ReturnType<typeof TicketImpresion> | undefined;
	const ticketParaImprimir = $derived(
		ventaParaImprimir
			? {
					tipo: ventaParaImprimir.tipoRaw,
					numeroComprobante: ventaParaImprimir.numeroComprobante,
					sunatEstado: ventaParaImprimir.sunatEstado,
					numeroDocumento: ventaParaImprimir.numeroDocumento,
					cliente: ventaParaImprimir.cliente,
					fechaLabel: formatearFechaTicket(ventaParaImprimir.fecha),
					horaLabel: ventaParaImprimir.hora,
					pago: formatPagos(ventaParaImprimir.pagos),
					items: ventaParaImprimir.items,
					total: ventaParaImprimir.total
				}
			: null
	);

	async function imprimirTicket(venta: (typeof ventas)[number]) {
		ventaParaImprimir = venta;
		await tick();
		await ticketImpresionRef?.esperarQrListo();
		await esperarImagenesListas('#ticket-imprimir');
		window.print();
	}
</script>

<svelte:head>
	<title>Ventas · La Central</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Ventas' }]} />

	<header
		class="flex flex-col gap-4 @min-[768px]:flex-row @min-[768px]:items-center @min-[768px]:justify-between"
	>
		<div class="flex grow flex-col gap-1">
			<h1 class="title">Ventas</h1>
			<p class="text-sm text-stone-400">Historial completo de todas las ventas realizadas.</p>
		</div>

		<div
			class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 @min-[768px]:justify-end"
		>
			<div class="shrink-0" title="No incluye las ventas anuladas">
				<p class="text-xs leading-3.75 font-bold text-stone-400 uppercase">
					Total {hayFiltros ? 'filtrado' : 'registrado'}
				</p>
				<p class="text-2xl font-extrabold text-stone-800">{currency(sumaTotal)}</p>
			</div>
			<div class="flex items-center gap-3">
				<MenuReporte
					onExcel={onExportarExcel}
					onPDF={onExportarPDF}
					disabled={!total || exportando}
				/>
				<a href="/dashboard/venta" class="button primary w-auto shrink-0 px-6">
					<Plus size={16} strokeWidth={3} />
					Nueva Venta
				</a>
			</div>
		</div>
	</header>

	<div class="flex flex-wrap items-center gap-3">
		<div class="w-full @min-[640px]:w-80">
			<Input
				bind:value={busqueda}
				placeholder="Cliente, DNI, N° de comprobante o producto…"
				type="text"
			>
				{#snippet icon()}
					<Search size={16} />
				{/snippet}
				{#snippet trailing()}
					{#if busqueda}
						<button
							type="button"
							onclick={() => (busqueda = '')}
							class="cursor-pointer text-stone-400 transition-colors hover:text-stone-600"
							aria-label="Limpiar búsqueda"
							title="Limpiar búsqueda"
						>
							<X size={16} />
						</button>
					{/if}
				{/snippet}
			</Input>
		</div>
		<MultiSelect etiqueta="Tipo" opciones={TIPO_OPCIONES} bind:value={tiposSel} />
		<MultiSelect etiqueta="Pago" opciones={PAGO_OPCIONES} bind:value={metodosSel} />
		<MultiSelect etiqueta="Estado" opciones={ESTADO_OPCIONES} bind:value={estadosSel} />
		<DateRangePicker bind:value={rango} class="w-auto" />
		{#if hayFiltros}
			<button
				type="button"
				onclick={limpiarFiltros}
				class="flex h-12 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-stone-500 transition-colors hover:text-stone-800"
				title="Quitar todos los filtros"
			>
				<FunnelX size={16} />
				Limpiar
			</button>
		{/if}
	</div>

	{#snippet badgesTipo(venta: (typeof ventas)[number])}
		<span class="inline-flex flex-wrap items-center gap-1">
			<span
				class="rounded-full px-2.5 py-0.5 text-xs leading-3.75 font-bold whitespace-nowrap {TIPO_BADGE[
					venta.tipoRaw
				]}"
			>
				{venta.tipo}
			</span>
			{#if venta.estado === 'anulada'}
				<span
					class="rounded-full bg-red-100 px-2.5 py-0.5 text-xs leading-3.75 font-bold whitespace-nowrap text-red-700"
				>
					Anulada
				</span>
			{/if}
		</span>
	{/snippet}

	{#snippet celdaPago(venta: (typeof ventas)[number])}
		<div class="flex flex-wrap items-center gap-1">
			{#each venta.pagos as pago (pago.metodo)}
				<span
					class="rounded-full px-2.5 py-0.5 text-xs leading-3.75 font-bold whitespace-nowrap {colorPago(
						pago.metodo
					)}"
				>
					{pago.metodo}{#if venta.pagos.length > 1}
						· {currency(pago.monto)}{/if}
				</span>
			{:else}
				<span
					class="rounded-full px-2.5 py-0.5 text-xs leading-3.75 font-bold whitespace-nowrap {colorPago(
						venta.pago
					)}"
				>
					{venta.pago}
				</span>
			{/each}
		</div>
	{/snippet}

	{#snippet celdaSunat(venta: (typeof ventas)[number])}
		{@const badge = estadoSunatColumna(venta)}
		{#if badge}
			<span
				class="rounded-full px-2.5 py-0.5 text-xs leading-3.75 font-bold whitespace-nowrap {badge.clase}"
			>
				{badge.label}
			</span>
		{/if}
	{/snippet}

	{#snippet celdaSunatIcono(venta: (typeof ventas)[number])}
		{@const estado = estadoSunatColumna(venta)}
		{#if estado}
			{@const Icono = estado.icono}
			<span class="flex justify-center">
				<span
					role="img"
					aria-label={estado.titulo}
					title={estado.titulo}
					class="inline-flex size-7 items-center justify-center rounded-full {estado.clase}"
				>
					<Icono size={15} strokeWidth={2.5} />
				</span>
			</span>
		{/if}
	{/snippet}

	{#snippet celdaAcciones(venta: (typeof ventas)[number])}
		{@const anulada = venta.estado === 'anulada'}
		<div class="flex items-center justify-end gap-1">
			<button
				type="button"
				onclick={() => verDetalle(venta)}
				class="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
				aria-label="Ver detalle de la venta"
				title="Ver detalle"
			>
				<Receipt size={16} />
			</button>
			<button
				type="button"
				onclick={() => imprimirTicket(venta)}
				class="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
				aria-label="Imprimir ticket"
				title="Imprimir ticket"
			>
				<Printer size={16} />
			</button>
			<button
				type="button"
				onclick={() => pedirRehacer(venta)}
				class="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
				aria-label="Rehacer venta"
				title="Rehacer venta"
			>
				<RotateCcw size={16} />
			</button>
			<button
				type="button"
				onclick={() => pedirAnular(venta)}
				disabled={anulada}
				class="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-red-50 hover:text-error disabled:cursor-not-allowed disabled:opacity-30"
				aria-label="Anular venta"
				title={anulada ? 'Esta venta ya está anulada' : 'Anular venta'}
			>
				<Trash2 size={16} />
			</button>
		</div>
	{/snippet}

	{#snippet tarjetaVenta(venta: (typeof ventas)[number])}
		{@const anulada = venta.estado === 'anulada'}
		<div
			class="flex flex-col gap-3 rounded-2xl border-2 border-stone-200 bg-white p-4 {anulada
				? 'opacity-60'
				: ''}"
		>
			<div class="flex items-start justify-between gap-2">
				<div class="min-w-0">
					<p class="truncate font-extrabold text-stone-800">{venta.cliente ?? CLIENTES_VARIOS}</p>
				</div>
				<p class="shrink-0 text-lg font-extrabold text-stone-800">{currency(venta.total)}</p>
			</div>
			<div class="flex flex-col gap-1.5 text-sm text-stone-500">
				<span class="flex items-center gap-2">
					<Package size={14} class="text-stone-400" />
					{venta.descripcion}
				</span>
				<span class="flex items-center gap-2">
					<Clock size={14} class="text-stone-400" />
					{formatFecha(venta.fecha)} · {venta.hora}
				</span>
				<span class="flex flex-wrap items-center gap-1.5">
					<Receipt size={14} class="text-stone-400" />
					{@render badgesTipo(venta)}
					{#if venta.numeroComprobante}
						<span class="font-medium text-stone-700">{venta.numeroComprobante}</span>
					{/if}
				</span>
				<span class="flex flex-wrap items-center gap-1.5">
					<CreditCard size={14} class="text-stone-400" />
					{@render celdaPago(venta)}
				</span>
				{#if estadoSunatColumna(venta)}
					<span class="flex flex-wrap items-center gap-1.5">
						<FileText size={14} class="text-stone-400" />
						{@render celdaSunat(venta)}
					</span>
				{/if}
			</div>
			<div class="flex items-center gap-2 border-t border-stone-100 pt-3">
				<button
					type="button"
					onclick={() => verDetalle(venta)}
					class="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-stone-100 text-sm font-bold text-stone-700"
					title="Ver detalle"
				>
					<Receipt size={16} />
					Ver
				</button>
				<button
					type="button"
					onclick={() => imprimirTicket(venta)}
					class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-stone-100 text-stone-500"
					aria-label="Imprimir ticket"
					title="Imprimir ticket"
				>
					<Printer size={16} />
				</button>
				<button
					type="button"
					onclick={() => pedirRehacer(venta)}
					class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-stone-100 text-stone-500"
					aria-label="Rehacer venta"
					title="Rehacer venta"
				>
					<RotateCcw size={16} />
				</button>
				<button
					type="button"
					onclick={() => pedirAnular(venta)}
					disabled={anulada}
					class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-stone-100 text-error disabled:opacity-30"
					aria-label="Anular venta"
					title={anulada ? 'Esta venta ya está anulada' : 'Anular venta'}
				>
					<Trash2 size={16} />
				</button>
			</div>
		</div>
	{/snippet}

	{#snippet celdaFecha(venta: (typeof ventas)[number])}
		<span class="font-medium whitespace-nowrap text-stone-800">{formatFecha(venta.fecha)}</span>
	{/snippet}
	{#snippet celdaHora(venta: (typeof ventas)[number])}
		<span class="whitespace-nowrap text-stone-500">{venta.hora}</span>
	{/snippet}
	{#snippet celdaComprobante(venta: (typeof ventas)[number])}
		{@render badgesTipo(venta)}
	{/snippet}
	{#snippet celdaCliente(venta: (typeof ventas)[number])}
		<span class="font-medium text-stone-800">{venta.cliente ?? CLIENTES_VARIOS}</span>
	{/snippet}
	{#snippet celdaProductos(venta: (typeof ventas)[number])}
		<span class="block text-center font-medium whitespace-nowrap text-stone-800"
			>{venta.items.reduce((acc, i) => acc + i.cantidad, 0)}</span
		>
	{/snippet}
	{#snippet celdaTotal(venta: (typeof ventas)[number])}
		<span class="font-bold text-stone-800">{currency(venta.total)}</span>
	{/snippet}

	<DataTable
		columnas={[
			{ id: 'fecha', etiqueta: 'Fecha', ordenable: true, celda: celdaFecha },
			{ id: 'hora', etiqueta: 'Hora', celda: celdaHora },
			{ id: 'comprobante', etiqueta: 'Tipo', celda: celdaComprobante },
			{ id: 'cliente', etiqueta: 'Cliente', ordenable: true, celda: celdaCliente },
			{
				id: 'productos',
				etiqueta: 'Cant.',
				claseTh: 'text-center',
				celda: celdaProductos
			},
			{ id: 'pago', etiqueta: 'Pago', celda: celdaPago },
			{ id: 'sunat', etiqueta: 'SUNAT', claseTh: 'text-center', celda: celdaSunatIcono },
			{ id: 'total', etiqueta: 'Total', ordenable: true, alinear: 'derecha', celda: celdaTotal },
			{ id: 'acciones', etiqueta: '', celda: celdaAcciones }
		] as ColumnaTabla<(typeof ventas)[number]>[]}
		filas={ventas}
		claveFila={(v) => v.id}
		{cargando}
		mensajeVacio="No se encontraron ventas"
		{ordenPor}
		{ordenDireccion}
		{onOrdenar}
		tarjetaMovil={tarjetaVenta}
		{pagina}
		{totalPaginas}
		{total}
		{pageSize}
		onCambiarPagina={irAPagina}
	/>
</main>

<Dialog bind:open={detalleOpen} title="Detalle de venta">
	{#if ventaSeleccionada}
		<div class="flex flex-col gap-4">
			<div class="grid grid-cols-2 gap-3 text-sm">
				<div class="col-span-2">
					<p class="text-xs leading-3.75 font-bold text-stone-400 uppercase">Fecha</p>
					<p class="font-bold text-stone-800">
						{formatFecha(ventaSeleccionada.fecha)} · {ventaSeleccionada.hora}
					</p>
				</div>
				<div>
					<p class="text-xs leading-3.75 font-bold text-stone-400 uppercase">Cliente</p>
					<p class="font-bold text-stone-800">{ventaSeleccionada.cliente ?? CLIENTES_VARIOS}</p>
				</div>
				<div>
					<p class="text-xs leading-3.75 font-bold text-stone-400 uppercase">Cajero</p>
					<p class="font-bold text-stone-800">{ventaSeleccionada.cajero}</p>
				</div>
				{#if ventaSeleccionada.estado === 'anulada'}
					<div class="col-span-2">
						<p class="text-xs leading-3.75 font-bold text-stone-400 uppercase">Anulada</p>
						<p class="font-bold text-error">
							{ventaSeleccionada.anuladaEn
								? formatFechaHora(ventaSeleccionada.anuladaEn)
								: 'Fecha no registrada'}
						</p>
					</div>
				{/if}
				<div class="col-span-2">
					<p class="text-xs leading-3.75 font-bold text-stone-400 uppercase">Tipo</p>
					<p class="font-bold text-stone-800">
						{ventaSeleccionada.tipo}
						{#if ventaSeleccionada.numeroDocumento}
							· {ventaSeleccionada.numeroDocumento}
						{/if}
					</p>
				</div>
				{#if ventaSeleccionada.esComprobante}
					{@const badge = SUNAT_BADGE[ventaSeleccionada.sunatEstado] ?? SUNAT_BADGE.pendiente}
					<div class="col-span-2">
						<div class="flex items-center justify-between">
							<p class="text-xs leading-3.75 font-bold text-stone-400 uppercase">SUNAT</p>
							{#if puedeReintentarSunat(ventaSeleccionada)}
								<button
									type="button"
									onclick={reintentarSunat}
									disabled={reintentandoSunat}
									class="flex cursor-pointer items-center gap-1 text-xs leading-3.75 font-bold text-stone-400 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<RefreshCw
										size={12}
										strokeWidth={2.5}
										class={reintentandoSunat ? 'animate-spin' : ''}
									/>
									{reintentandoSunat
										? 'Consultando…'
										: ventaSeleccionada.estado === 'activa'
											? 'Reintentar envío'
											: 'Reintentar anulación'}
								</button>
							{/if}
						</div>
						<div class="mt-1 flex flex-wrap items-center gap-1.5">
							{#if ventaSeleccionada.numeroComprobante}
								<span class="font-bold text-stone-800">{ventaSeleccionada.numeroComprobante}</span>
							{/if}
							<span class="rounded-full px-2.5 py-0.5 text-xs leading-3.75 font-bold {badge.clase}">
								{badge.label}
							</span>
						</div>
						{#if ventaSeleccionada.sunatError && ventaSeleccionada.sunatEstado !== 'aceptado'}
							<p class="mt-1 text-xs text-error">{ventaSeleccionada.sunatError}</p>
						{/if}
						{#if ventaSeleccionada.estado === 'anulada' && ventaSeleccionada.sunatBajaEstado}
							<p
								class="mt-1 text-xs font-bold {ventaSeleccionada.sunatBajaEstado === 'aceptada' ||
								ventaSeleccionada.sunatBajaEstado === 'no_requerida'
									? 'text-stone-500'
									: 'text-error'}"
							>
								{BAJA_LABEL[ventaSeleccionada.sunatBajaEstado] ?? ventaSeleccionada.sunatBajaEstado}
							</p>
							{#if ventaSeleccionada.sunatBajaError}
								<p class="text-xs text-stone-500">{ventaSeleccionada.sunatBajaError}</p>
							{/if}
						{/if}
						{#if ventaSeleccionada.sunatPdfTicketUrl || ventaSeleccionada.sunatPdfA4Url || ventaSeleccionada.sunatXmlUrl || ventaSeleccionada.sunatCdrUrl}
							<div class="mt-2 flex flex-wrap gap-3">
								{#each [['PDF ticket', ventaSeleccionada.sunatPdfTicketUrl], ['PDF A4', ventaSeleccionada.sunatPdfA4Url], ['XML', ventaSeleccionada.sunatXmlUrl], ['CDR', ventaSeleccionada.sunatCdrUrl]] as [etiqueta, url] (etiqueta)}
									{#if url}
										<a href={url} target="_blank" rel="noopener noreferrer" class="link text-xs">
											<FileText size={12} />
											{etiqueta}
										</a>
									{/if}
								{/each}
							</div>
						{/if}
						{#if ventaSeleccionada.notaCredito}
							{@const nc = ventaSeleccionada.notaCredito}
							{@const badgeNc = SUNAT_BADGE[nc.estado] ?? SUNAT_BADGE.pendiente}
							<div class="mt-3 border-t border-stone-200 pt-3">
								<p class="text-xs leading-3.75 font-bold text-stone-400 uppercase">
									Nota de crédito
								</p>
								<div class="mt-1 flex flex-wrap items-center gap-1.5">
									<span class="font-bold text-stone-800">{nc.serie}-{nc.correlativo}</span>
									<span
										class="rounded-full px-2.5 py-0.5 text-xs leading-3.75 font-bold {badgeNc.clase}"
									>
										{badgeNc.label}
									</span>
								</div>
								{#if nc.error && nc.estado !== 'aceptado'}
									<p class="mt-1 text-xs text-error">{nc.error}</p>
								{/if}
								<div class="mt-2 flex flex-wrap gap-3">
									{#each [['PDF ticket', nc.pdfTicketUrl], ['PDF A4', nc.pdfA4Url], ['XML', nc.xmlUrl], ['CDR', nc.cdrUrl]] as [etiqueta, url] (etiqueta)}
										{#if url}
											<a href={url} target="_blank" rel="noopener noreferrer" class="link text-xs">
												<FileText size={12} />
												{etiqueta}
											</a>
										{/if}
									{/each}
								</div>
							</div>
						{/if}
						{#if puedeGenerarNota(ventaSeleccionada)}
							<button
								type="button"
								onclick={generarNotaCredito}
								disabled={generandoNota}
								class="link mt-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
							>
								<FileText size={12} />
								{generandoNota ? 'Generando…' : 'Generar nota de crédito'}
							</button>
						{/if}
					</div>
				{/if}
				<div class="col-span-2">
					<div class="flex items-center justify-between">
						<p class="text-xs leading-3.75 font-bold text-stone-400 uppercase">Pago</p>
						{#if !editandoPago}
							<button
								type="button"
								onclick={iniciarEdicionPago}
								class="flex cursor-pointer items-center gap-1 text-xs leading-3.75 font-bold text-stone-400 hover:text-stone-700"
							>
								<Pencil size={12} strokeWidth={2.5} />
								Corregir
							</button>
						{/if}
					</div>
					{#if editandoPago}
						<div class="mt-1 flex flex-col gap-2">
							{#each pagosEdicion as pago, index (index)}
								<div class="flex items-center gap-2">
									<Select bind:value={pago.metodo} class="flex-1">
										{#each METODOS_PAGO as metodo (metodo)}
											<option value={metodo}>{metodo}</option>
										{/each}
									</Select>
									<MoneyInput bind:value={pago.monto} class="w-28 shrink-0" />
									<button
										type="button"
										onclick={() => quitarPagoEdicion(index)}
										disabled={pagosEdicion.length <= 1}
										class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-red-50 hover:text-error disabled:cursor-not-allowed disabled:opacity-30"
										aria-label="Quitar método de pago"
									>
										<Trash2 size={16} />
									</button>
								</div>
							{/each}
							<div class="flex items-center justify-between">
								<button
									type="button"
									onclick={agregarPagoEdicion}
									disabled={pagosEdicion.length >= METODOS_PAGO.length}
									class="link text-xs"
								>
									<Plus size={12} strokeWidth={3} />
									Agregar método
								</button>
								<p
									class="text-xs leading-3.75 font-bold {Math.abs(restantePagoEdicion) < 0.01
										? 'text-success-dark'
										: 'text-error'}"
								>
									{Math.abs(restantePagoEdicion) < 0.01
										? 'Cuadra ✓'
										: restantePagoEdicion > 0
											? `Falta ${currency(restantePagoEdicion)}`
											: `Sobra ${currency(-restantePagoEdicion)}`}
								</p>
							</div>
							<div class="grid grid-cols-2 gap-2">
								<Button type="button" variant="danger" onclick={() => (editandoPago = false)}>
									Cancelar
								</Button>
								<Button
									type="button"
									variant="success"
									disabled={guardandoPago}
									onclick={guardarPagoEdicion}
								>
									{guardandoPago ? 'Guardando…' : 'Guardar'}
								</Button>
							</div>
						</div>
					{:else}
						<div class="mt-1 flex flex-wrap items-center gap-1">
							{#each ventaSeleccionada.pagos as pago (pago.metodo)}
								<span
									class="inline-block rounded-full px-2.5 py-0.5 text-xs leading-3.75 font-bold {colorPago(
										pago.metodo
									)}"
								>
									{pago.metodo}{#if ventaSeleccionada.pagos.length > 1}
										· {currency(pago.monto)}{/if}
								</span>
							{:else}
								<span
									class="inline-block rounded-full px-2.5 py-0.5 text-xs leading-3.75 font-bold {colorPago(
										ventaSeleccionada.pago
									)}"
								>
									{ventaSeleccionada.pago}
								</span>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<div class="flex flex-col gap-2 rounded-xl bg-stone-50 py-3">
				{#if ventaSeleccionada.items && ventaSeleccionada.items.length > 0}
					{#each ventaSeleccionada.items as item (item.id)}
						<div class="flex items-center justify-between text-sm">
							<span class="text-stone-700">{item.cantidad} × {item.nombreProducto}</span>
							<span class="font-bold text-stone-800"
								>{currency(item.cantidad * item.precioUnitario)}</span
							>
						</div>
					{/each}
				{:else}
					<p class="text-sm text-stone-400">{ventaSeleccionada.descripcion}</p>
				{/if}
			</div>

			<div
				class="flex items-center justify-between border-t border-stone-100 pt-3 text-lg font-extrabold"
			>
				<span>Total</span>
				<span>{currency(ventaSeleccionada.total)}</span>
			</div>
		</div>
	{/if}
</Dialog>

<TicketImpresion venta={ticketParaImprimir} bind:this={ticketImpresionRef} />

<Dialog bind:open={rehacerOpen} title="Rehacer venta">
	{#if ventaARehacer}
		<p class="-mt-2 text-sm text-stone-500">
			Se cargarán estos productos en una nueva venta para que la revises antes de cobrar.
		</p>

		<div class="flex max-h-60 flex-col gap-2 overflow-auto rounded-xl bg-stone-100 p-4">
			{#each itemsRehacer as item, i (i)}
				<div class="flex items-start justify-between gap-3 text-sm">
					<span class="text-stone-700">{item.cantidad} × {item.nombre}</span>
					<span class="shrink-0 font-bold text-stone-800">
						{currency(redondear2(item.cantidad * item.precioUnitario))}
					</span>
				</div>
			{:else}
				<p class="text-sm text-stone-400">
					Ningún producto de esta venta se puede volver a cargar.
				</p>
			{/each}
		</div>
		<div class="flex items-center justify-between text-lg font-extrabold">
			<span>Total</span>
			<span>
				{currency(
					redondear2(itemsRehacer.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0))
				)}
			</span>
		</div>
		{#if omitidosRehacer > 0}
			<p class="text-xs text-error">
				{omitidosRehacer === 1
					? '1 producto ya no existe en el catálogo y no se cargará.'
					: `${omitidosRehacer} productos ya no existen en el catálogo y no se cargarán.`}
			</p>
		{/if}

		{#if ventaARehacer.estado === 'activa'}
			<p class="text-xs text-stone-400">
				La venta original sigue activa: si estás corrigiéndola, anúlala aparte.
			</p>
		{/if}

		<div class="grid grid-cols-2 gap-3">
			<Button type="button" variant="secondary" onclick={() => (rehacerOpen = false)}>
				Cancelar
			</Button>
			<Button
				type="button"
				variant="primary"
				onclick={confirmarRehacer}
				disabled={itemsRehacer.length === 0}
			>
				<RotateCcw size={16} />
				Rehacer
			</Button>
		</div>
	{/if}
</Dialog>

<Dialog bind:open={confirmAnularOpen} title="Anular venta" class="max-w-md">
	{#if ventaAAnular}
		<div class="-mt-2 flex items-start gap-3">
			<span
				class="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-error"
			>
				<TriangleAlert size={18} strokeWidth={2.5} />
			</span>
			<p class="mt-1.5 text-sm text-stone-500">
				¿Anular la venta de {currency(ventaAAnular.total)}{ventaAAnular.cliente
					? ` a ${ventaAAnular.cliente}`
					: ''}?
			</p>
		</div>

		<div class="flex flex-col gap-4 rounded-xl bg-stone-100 p-4">
			<div class="flex flex-col gap-1">
				<Checkbox bind:checked={devolverStock}>
					El cliente devolvió los productos (volver al stock)
				</Checkbox>
				<p class="pl-7.5 text-xs text-stone-500">
					Desmárcalo si ya no se pueden vender (se consumieron, se malograron…): el inventario queda
					como está.
				</p>
			</div>

			{#if anulacionTocaSunat}
				<div class="flex flex-col gap-1">
					<Checkbox bind:checked={usarNotaCredito} disabled={bajaFueraDePlazo}>
						Generar nota de crédito
					</Checkbox>
					<p class="pl-7.5 text-xs text-stone-500">
						{#if bajaFueraDePlazo}
							Pasaron más de {PLAZO_BAJA_DIAS} días desde la emisión: esta boleta solo se puede anular
							con nota de crédito.
						{:else}
							Úsala si la boleta ya se le entregó al cliente. Sin marcar, se envía una baja a SUNAT
							(resumen diario), válida hasta {PLAZO_BAJA_DIAS} días desde la emisión.
						{/if}
					</p>
				</div>
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-3">
			<Button type="button" variant="secondary" onclick={() => (confirmAnularOpen = false)}>
				Cancelar
			</Button>
			<Button type="button" variant="danger" onclick={confirmarAnular} disabled={anulando}>
				{anulando ? 'Procesando…' : 'Anular'}
			</Button>
		</div>
	{/if}
</Dialog>
