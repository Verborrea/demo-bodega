#!/usr/bin/env node
// Importa productos (con sus presentaciones) desde un CSV, usando la propia API
// de La Central — así se reutiliza toda su validación (presentación base,
// find-or-create de marca/categoría, etc.) en vez de tocar la BD directamente.
//
// Uso:
//   node scripts/importar-productos.mjs --file scripts/productos-ejemplo.csv \
//     --usuario admin --password "LaTiendita2026!" [--url http://localhost:5173]
//
// Formato del CSV: una fila por presentación. Varias filas con el mismo
// "producto" se agrupan en un solo producto con varias presentaciones.
// Cada grupo debe tener exactamente una fila con factor_unidades=1 (la base).
//
//   producto,marca,categoria,codigo_barras,presentacion,factor_unidades,precio,stock_inicial

import { readFile } from 'node:fs/promises';

const COLUMNAS = [
	'producto',
	'marca',
	'categoria',
	'codigo_barras',
	'presentacion',
	'factor_unidades',
	'precio',
	'stock_inicial'
];

function parseArgs(argv) {
	const args = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg.startsWith('--')) {
			const key = arg.slice(2);
			const siguiente = argv[i + 1];
			args[key] = siguiente && !siguiente.startsWith('--') ? argv[++i] : true;
		}
	}
	return args;
}

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
				} else {
					enComillas = false;
				}
			} else {
				campo += c;
			}
		} else if (c === '"') {
			enComillas = true;
		} else if (c === ',') {
			fila.push(campo);
			campo = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && texto[i + 1] === '\n') i++;
			fila.push(campo);
			filas.push(fila);
			fila = [];
			campo = '';
		} else {
			campo += c;
		}
	}
	if (campo.length > 0 || fila.length > 0) {
		fila.push(campo);
		filas.push(fila);
	}
	return filas.filter((f) => f.some((c) => c.trim() !== ''));
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const archivo = args.file;
	const usuario = args.usuario;
	const password = args.password;
	const baseUrl = String(args.url || 'http://localhost:5173').replace(/\/$/, '');

	if (!archivo || !usuario || !password) {
		console.error(
			'Uso: node scripts/importar-productos.mjs --file <ruta.csv> --usuario <usuario> --password <password> [--url http://localhost:5173]'
		);
		process.exit(1);
	}

	const texto = await readFile(archivo, 'utf-8');
	const filas = parseCsv(texto);
	if (filas.length === 0) {
		console.error('El CSV está vacío.');
		process.exit(1);
	}
	const encabezado = filas.shift().map((h) => h.trim().toLowerCase());

	for (const col of COLUMNAS) {
		if (!encabezado.includes(col)) {
			console.error(`Falta la columna "${col}". Encabezado esperado: ${COLUMNAS.join(',')}`);
			process.exit(1);
		}
	}
	const idx = Object.fromEntries(COLUMNAS.map((c) => [c, encabezado.indexOf(c)]));

	const productosPorNombre = new Map();
	for (const fila of filas) {
		const nombre = fila[idx.producto]?.trim();
		if (!nombre) continue;
		if (!productosPorNombre.has(nombre)) {
			productosPorNombre.set(nombre, {
				nombre,
				marca: fila[idx.marca]?.trim() || undefined,
				categoria: fila[idx.categoria]?.trim(),
				codigoBarras: fila[idx.codigo_barras]?.trim() || null,
				presentaciones: []
			});
		}
		productosPorNombre.get(nombre).presentaciones.push({
			nombre: fila[idx.presentacion]?.trim() || 'Unidad',
			factorUnidades: Number(fila[idx.factor_unidades]) || 1,
			precio: Number(fila[idx.precio]) || 0,
			cantidadInicial: Number(fila[idx.stock_inicial]) || 0
		});
	}

	console.log(`Se leyeron ${productosPorNombre.size} producto(s) del CSV.`);

	const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ usuario, password })
	});
	if (!loginRes.ok) {
		console.error(`No se pudo iniciar sesión (${loginRes.status}). Revisa usuario/contraseña.`);
		process.exit(1);
	}
	const setCookie = loginRes.headers.get('set-cookie');
	const cookie = setCookie ? setCookie.split(';')[0] : '';
	if (!cookie) {
		console.error('No se recibió cookie de sesión al iniciar sesión.');
		process.exit(1);
	}

	let creados = 0;
	let omitidos = 0;
	let fallidos = 0;

	for (const producto of productosPorNombre.values()) {
		if (!producto.presentaciones.some((p) => p.factorUnidades === 1)) {
			console.error(
				`✗ "${producto.nombre}": falta una presentación base (factor_unidades=1), se omite.`
			);
			fallidos++;
			continue;
		}
		if (!producto.categoria) {
			console.error(`✗ "${producto.nombre}": falta la categoría, se omite.`);
			fallidos++;
			continue;
		}

		// Evita duplicados: si ya existe un producto con el mismo nombre, lo omite.
		const buscarRes = await fetch(
			`${baseUrl}/api/productos?search=${encodeURIComponent(producto.nombre)}&pageSize=25`,
			{ headers: { Cookie: cookie } }
		);
		if (buscarRes.ok) {
			const { productos: existentes } = await buscarRes.json();
			const yaExiste = existentes.some(
				(p) => p.nombre.trim().toLowerCase() === producto.nombre.toLowerCase()
			);
			if (yaExiste) {
				console.log(`– "${producto.nombre}" ya existe, se omite.`);
				omitidos++;
				continue;
			}
		}

		const crearRes = await fetch(`${baseUrl}/api/productos`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({
				nombre: producto.nombre,
				marca: producto.marca,
				categoria: producto.categoria,
				codigoBarras: producto.codigoBarras,
				presentaciones: producto.presentaciones
			})
		});

		if (!crearRes.ok) {
			const cuerpo = await crearRes.json().catch(() => null);
			console.error(`✗ "${producto.nombre}": ${cuerpo?.message ?? crearRes.status}`);
			fallidos++;
			continue;
		}

		console.log(
			`✓ "${producto.nombre}" creado con ${producto.presentaciones.length} presentación(es).`
		);
		creados++;
	}

	console.log(`\nListo: ${creados} creado(s), ${omitidos} omitido(s), ${fallidos} fallido(s).`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
