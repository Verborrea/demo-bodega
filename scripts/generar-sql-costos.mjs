#!/usr/bin/env node
// Genera un .sql con UPDATE productos SET costo_ultimo = ... para cada producto que ya
// existe en producción, a partir de un CSV con columna "costo" (mismo formato que el CSV
// de importación original + una columna costo). Pensado para pegar en la consola D1 de
// Cloudflare, sin pasar por la API (cero lecturas extra de la app).
//
// Uso: node scripts/generar-sql-costos.mjs <ruta-al-csv>
// Requiere /tmp/prod_productos_costo.json (export previo con:
//   wrangler d1 execute DB --remote --command "SELECT id, nombre FROM productos" --json > /tmp/prod_productos_costo.json)

import { readFile, writeFile } from 'node:fs/promises';

function parseCsv(texto) {
	const filas = [];
	let fila = [];
	let campo = '';
	let enComillas = false;
	for (let i = 0; i < texto.length; i++) {
		const c = texto[i];
		if (enComillas) {
			if (c === '"') {
				if (texto[i + 1] === '"') {
					campo += '"';
					i++;
				} else enComillas = false;
			} else campo += c;
		} else if (c === '"') enComillas = true;
		else if (c === ',') {
			fila.push(campo);
			campo = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && texto[i + 1] === '\n') i++;
			fila.push(campo);
			filas.push(fila);
			fila = [];
			campo = '';
		} else campo += c;
	}
	if (campo.length > 0 || fila.length > 0) {
		fila.push(campo);
		filas.push(fila);
	}
	return filas.filter((f) => f.some((c) => c.trim() !== ''));
}

async function main() {
	const csvPath = process.argv[2];
	if (!csvPath) {
		console.error('Uso: node scripts/generar-sql-costos.mjs <ruta-al-csv>');
		process.exit(1);
	}

	const prodProductos = JSON.parse(await readFile('/tmp/prod_productos_costo.json', 'utf-8'));
	const idPorNombre = new Map(
		prodProductos[0].results.map((p) => [p.nombre.trim().toLowerCase(), p.id])
	);

	const texto = await readFile(csvPath, 'utf-8');
	const filas = parseCsv(texto);
	const encabezado = filas.shift().map((h) => h.trim().toLowerCase());
	const idx = Object.fromEntries(
		['producto', 'factor_unidades', 'costo'].map((c) => [c, encabezado.indexOf(c)])
	);

	// Agrupa por producto (algunas filas repiten el mismo producto para otras presentaciones);
	// se usa la fila con factor_unidades=1 (costo ya es "por unidad base"), o si no existe,
	// se normaliza costo/factor de la primera fila disponible — mismo criterio que crearPedido().
	const porProducto = new Map();
	for (const fila of filas) {
		const nombre = fila[idx.producto]?.trim();
		if (!nombre) continue;
		const factor = Number(fila[idx.factor_unidades]) || 1;
		const costo = Number(fila[idx.costo]);
		if (!Number.isFinite(costo) || costo < 0) continue;
		const actual = porProducto.get(nombre);
		if (!actual || factor === 1) {
			porProducto.set(nombre, { costo, factor });
		}
	}

	const lineas = [];
	let actualizados = 0;
	let sinCoincidencia = 0;

	for (const [nombre, { costo, factor }] of porProducto) {
		const id = idPorNombre.get(nombre.toLowerCase());
		if (!id) {
			console.log(`– "${nombre}": no existe en producción, se omite.`);
			sinCoincidencia++;
			continue;
		}
		const costoBase = factor === 1 ? costo : costo / factor;
		lineas.push(
			`UPDATE productos SET costo_ultimo = ${costoBase} WHERE id = '${id}';`
		);
		actualizados++;
	}

	await writeFile('scripts/costos.sql', lineas.join('\n') + '\n');
	console.log(
		`\nscripts/costos.sql generado: ${actualizados} producto(s) a actualizar, ${sinCoincidencia} sin coincidencia.`
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
