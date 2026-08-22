#!/usr/bin/env node
// Genera un .sql con los productos del CSV que AÚN NO existen en producción
// (comparando contra /tmp/prod_productos.json, prod_marcas.json, prod_categorias.json
// ya exportados con `wrangler d1 execute ... --json`). Pensado para pegar en la
// consola D1 de Cloudflare, sin pasar por la API (cero lecturas extra de la app).

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

function sqlStr(v) {
	return v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
}

async function main() {
	const [prodProductos, prodMarcas, prodCategorias, prodCodigos] = await Promise.all([
		readFile('/tmp/prod_productos.json', 'utf-8').then(JSON.parse),
		readFile('/tmp/prod_marcas.json', 'utf-8').then(JSON.parse),
		readFile('/tmp/prod_categorias.json', 'utf-8').then(JSON.parse),
		readFile('/tmp/prod_codigos.json', 'utf-8').then(JSON.parse)
	]);
	const nombresExistentes = new Set(
		prodProductos[0].results.map((p) => p.nombre.trim().toLowerCase())
	);
	const marcasPorNombre = new Map(
		prodMarcas[0].results.map((m) => [m.nombre.trim().toLowerCase(), m.id])
	);
	const categoriasPorNombre = new Map(
		prodCategorias[0].results.map((c) => [c.nombre.trim().toLowerCase(), c.id])
	);

	const texto = await readFile('scripts/productos_importar.csv', 'utf-8');
	const filas = parseCsv(texto);
	const encabezado = filas.shift().map((h) => h.trim().toLowerCase());
	const idx = Object.fromEntries(
		[
			'producto',
			'marca',
			'categoria',
			'codigo_barras',
			'presentacion',
			'factor_unidades',
			'precio',
			'stock_inicial'
		].map((c) => [c, encabezado.indexOf(c)])
	);

	const productos = new Map();
	for (const fila of filas) {
		const nombre = fila[idx.producto]?.trim();
		if (!nombre) continue;
		if (!productos.has(nombre)) {
			productos.set(nombre, {
				nombre,
				marca: fila[idx.marca]?.trim() || null,
				categoria: fila[idx.categoria]?.trim(),
				codigoBarras: fila[idx.codigo_barras]?.trim() || null,
				presentaciones: []
			});
		}
		productos.get(nombre).presentaciones.push({
			nombre: fila[idx.presentacion]?.trim() || 'Unidad',
			factorUnidades: Number(fila[idx.factor_unidades]) || 1,
			precio: Number(fila[idx.precio]) || 0,
			cantidadInicial: Number(fila[idx.stock_inicial]) || 0
		});
	}

	const codigosExistentes = new Set(prodCodigos[0].results.map((r) => r.codigo_barras));
	const lineas = [];
	let creados = 0;
	let omitidos = 0;

	for (const p of productos.values()) {
		if (nombresExistentes.has(p.nombre.trim().toLowerCase())) {
			omitidos++;
			continue;
		}
		if (!p.presentaciones.some((pr) => pr.factorUnidades === 1) || !p.categoria) continue;
		if (p.codigoBarras) {
			if (codigosExistentes.has(p.codigoBarras)) {
				console.log(`– "${p.nombre}": código de barras duplicado (${p.codigoBarras}), se omite.`);
				omitidos++;
				continue;
			}
			codigosExistentes.add(p.codigoBarras);
		}

		let marcaId = null;
		if (p.marca) {
			const key = p.marca.toLowerCase();
			marcaId = marcasPorNombre.get(key) ?? null;
			if (!marcaId) {
				marcaId = crypto.randomUUID();
				marcasPorNombre.set(key, marcaId);
				lineas.push(
					`INSERT INTO marcas (id, nombre) VALUES (${sqlStr(marcaId)}, ${sqlStr(p.marca)});`
				);
			}
		}

		const catKey = p.categoria.toLowerCase();
		let categoriaId = categoriasPorNombre.get(catKey);
		if (!categoriaId) {
			categoriaId = crypto.randomUUID();
			categoriasPorNombre.set(catKey, categoriaId);
			lineas.push(
				`INSERT INTO categorias (id, nombre) VALUES (${sqlStr(categoriaId)}, ${sqlStr(p.categoria)});`
			);
		}

		const productoId = crypto.randomUUID();
		const cantidadTotal = p.presentaciones.reduce(
			(acc, pr) => acc + pr.cantidadInicial * pr.factorUnidades,
			0
		);
		lineas.push(
			`INSERT INTO productos (id, nombre, marca_id, categoria_id, cantidad, codigo_barras) VALUES (${sqlStr(productoId)}, ${sqlStr(p.nombre)}, ${sqlStr(marcaId)}, ${sqlStr(categoriaId)}, ${cantidadTotal}, ${sqlStr(p.codigoBarras)});`
		);
		p.presentaciones.forEach((pr, orden) => {
			lineas.push(
				`INSERT INTO producto_presentaciones (id, producto_id, nombre, factor_unidades, precio, cantidad, orden) VALUES (${sqlStr(crypto.randomUUID())}, ${sqlStr(productoId)}, ${sqlStr(pr.nombre)}, ${pr.factorUnidades}, ${pr.precio}, ${pr.cantidadInicial}, ${orden});`
			);
		});
		nombresExistentes.add(p.nombre.trim().toLowerCase());
		creados++;
	}

	await writeFile('scripts/faltantes.sql', lineas.join('\n') + '\n');
	console.log(
		`scripts/faltantes.sql generado: ${creados} producto(s) nuevos, ${omitidos} ya existían.`
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
