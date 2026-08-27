// Export a PDF/Excel corre 100% en el navegador (import dinámico, mismo patrón que
// 'qrcode' en TicketImpresion.svelte) para no tocar el runtime de Cloudflare Workers ni
// cargar estas librerías en el bundle inicial de gente que nunca visita Reportes.
import { NEGOCIO } from '$lib/config/negocio';

// Paleta de marca (mismos tonos que la UI: yellow-400 / stone-800 / stone-400 / stone-50
// de Tailwind) para que el PDF se sienta parte de la app y no una tabla genérica.
const AMARILLO: [number, number, number] = [250, 204, 21];
const OSCURO: [number, number, number] = [41, 37, 36];
const GRIS: [number, number, number] = [120, 113, 108];
const GRIS_CLARO: [number, number, number] = [250, 250, 249];

function nombreArchivoSeguro(base: string): string {
	return base
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '') // marcas combinantes (acentos) que deja NFD
		.replace(/[^a-zA-Z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.toLowerCase();
}

export interface ExportarPDFOptions {
	/** Título del reporte, ej. "Productos más vendidos". También arma el nombre del archivo. */
	titulo: string;
	/** Ej. el rango de fechas filtrado: "1 ago 2026 – 27 ago 2026". */
	subtitulo?: string;
	/** Cifras clave arriba de la tabla, ej. [{label:'Total vendido', value:'S/ 152.00'}]. */
	resumen?: { label: string; value: string }[];
	columnas: string[];
	filas: (string | number)[][];
	/** Una entrada por columna; por defecto 'left'. Usar 'right' para columnas de montos. */
	alineaciones?: ('left' | 'right' | 'center')[];
}

export async function exportarPDF(opts: ExportarPDFOptions): Promise<void> {
	const [{ default: JsPDF }, { autoTable }] = await Promise.all([
		import('jspdf'),
		import('jspdf-autotable')
	]);
	const doc = new JsPDF();
	const anchoPagina = doc.internal.pageSize.getWidth();
	const altoPagina = doc.internal.pageSize.getHeight();
	const margenX = 14;

	// Barra de acento + encabezado con el negocio, igual que el ticket impreso.
	doc.setFillColor(...AMARILLO);
	doc.rect(0, 0, anchoPagina, 3, 'F');

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(15);
	doc.setTextColor(...OSCURO);
	doc.text(NEGOCIO.nombreComercial, margenX, 17);

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);
	doc.setTextColor(...GRIS);
	doc.text(`${NEGOCIO.razonSocial} · RUC ${NEGOCIO.ruc}`, margenX, 23);

	doc.setDrawColor(...GRIS_CLARO);
	doc.setLineWidth(0.5);
	doc.line(margenX, 29, anchoPagina - margenX, 29);

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(13);
	doc.setTextColor(...OSCURO);
	doc.text(opts.titulo, margenX, 39);

	let cursorY = 39;
	if (opts.subtitulo) {
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(9.5);
		doc.setTextColor(...GRIS);
		doc.text(opts.subtitulo, margenX, 45);
		cursorY = 45;
	}

	if (opts.resumen?.length) {
		cursorY += 10;
		const anchoTarjeta = (anchoPagina - margenX * 2) / opts.resumen.length;
		for (const [i, r] of opts.resumen.entries()) {
			const x = margenX + i * anchoTarjeta;
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(7.5);
			doc.setTextColor(...GRIS);
			doc.text(r.label.toUpperCase(), x, cursorY);
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(13);
			doc.setTextColor(...OSCURO);
			doc.text(r.value, x, cursorY + 7);
		}
		cursorY += 12;
	}

	autoTable(doc, {
		head: [opts.columnas],
		body: opts.filas,
		startY: cursorY + 4,
		margin: { left: margenX, right: margenX, bottom: 16 },
		theme: 'striped',
		styles: { font: 'helvetica', fontSize: 9, textColor: OSCURO, cellPadding: 3 },
		headStyles: { fillColor: OSCURO, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
		alternateRowStyles: { fillColor: GRIS_CLARO },
		columnStyles: Object.fromEntries(
			(opts.alineaciones ?? []).map((align, i) => [i, { halign: align }])
		),
		didDrawPage: ({ pageNumber }) => {
			const fecha = new Date().toLocaleDateString('es-PE', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric'
			});
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(7.5);
			doc.setTextColor(...GRIS);
			doc.text(`Generado el ${fecha} · ${NEGOCIO.nombreComercial}`, margenX, altoPagina - 8);
			doc.text(`Página ${pageNumber}`, anchoPagina - margenX, altoPagina - 8, { align: 'right' });
		}
	});

	doc.save(`${nombreArchivoSeguro(opts.titulo)}.pdf`);
}

function descargarBlob(blob: Blob, nombreArchivo: string): void {
	const url = URL.createObjectURL(blob);
	const enlace = document.createElement('a');
	enlace.href = url;
	enlace.download = nombreArchivo;
	enlace.click();
	URL.revokeObjectURL(url);
}

export interface ExportarExcelOptions {
	nombreArchivo: string;
	hojaNombre: string;
	filas: Record<string, unknown>[];
	/** Fila destacada arriba de la tabla, ej. el mismo título del PDF. */
	titulo?: string;
}

export async function exportarExcel(opts: ExportarExcelOptions): Promise<void> {
	const { Workbook } = await import('exceljs');
	const libro = new Workbook();
	const hoja = libro.addWorksheet(opts.hojaNombre.slice(0, 31));

	if (opts.titulo) {
		hoja.addRow([opts.titulo]).font = { bold: true, size: 14 };
		hoja.addRow([]);
	}

	if (opts.filas.length > 0) {
		const columnas = Object.keys(opts.filas[0]);
		const filaHeader = hoja.addRow(columnas);
		filaHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
		filaHeader.eachCell((celda) => {
			celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF292524' } };
		});
		for (const fila of opts.filas) {
			hoja.addRow(columnas.map((c) => fila[c] as string | number | null));
		}
		columnas.forEach((clave, i) => {
			const maxLen = Math.max(clave.length, ...opts.filas.map((f) => String(f[clave] ?? '').length));
			hoja.getColumn(i + 1).width = Math.min(40, maxLen + 3);
		});
	}

	const buffer = await libro.xlsx.writeBuffer();
	descargarBlob(
		new Blob([buffer], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		}),
		`${nombreArchivoSeguro(opts.nombreArchivo)}.xlsx`
	);
}
