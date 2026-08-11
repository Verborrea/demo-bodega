-- Migration number: 0004 	 2026-08-11T00:00:01.000Z

INSERT INTO ventas (id, fecha, hora, metodo, comprobante, numero_documento, cliente, total, items, estado) VALUES
	(
		'venta-seed-1',
		'2026-08-08T12:52:00',
		'12:52 p. m.',
		'Yape',
		'Factura',
		'F001-00000001',
		NULL,
		56.30,
		'[{"nombre":"Cerveza 620ml","cantidad":3,"precioUnitario":15.00},{"nombre":"Cigarros","cantidad":1,"precioUnitario":11.30}]',
		'activa'
	),
	(
		'venta-seed-2',
		'2026-08-08T18:52:00',
		'06:52 p. m.',
		'Yape',
		'Factura',
		'F001-00000002',
		NULL,
		56.30,
		'[{"nombre":"Cerveza 620ml","cantidad":3,"precioUnitario":15.00},{"nombre":"Cigarros","cantidad":1,"precioUnitario":11.30}]',
		'activa'
	),
	(
		'venta-seed-3',
		'2026-08-09T19:15:00',
		'07:15 p. m.',
		'Efectivo',
		'Boleta',
		'B001-00000001',
		NULL,
		28.00,
		'[{"nombre":"Detergente","cantidad":2,"precioUnitario":14.00}]',
		'activa'
	),
	(
		'venta-seed-4',
		'2026-08-09T19:16:00',
		'07:16 p. m.',
		'Efectivo',
		'Boleta',
		'B001-00000002',
		NULL,
		28.00,
		'[{"nombre":"Detergente","cantidad":2,"precioUnitario":14.00}]',
		'activa'
	),
	(
		'venta-seed-5',
		'2026-08-09T19:40:00',
		'07:40 p. m.',
		'Tarjeta',
		'Factura',
		'F001-00000003',
		NULL,
		96.30,
		'[{"nombre":"Arroz 1kg","cantidad":4,"precioUnitario":20.00},{"nombre":"Aceite 1L","cantidad":1,"precioUnitario":16.30}]',
		'activa'
	),
	(
		'venta-seed-6',
		'2026-08-10T19:58:00',
		'07:58 p. m.',
		'Yape',
		'Boleta',
		'B001-00000003',
		NULL,
		12.50,
		'[{"nombre":"Combo desayuno","cantidad":1,"precioUnitario":12.50}]',
		'activa'
	),
	(
		'venta-seed-7',
		'2026-08-10T20:12:00',
		'08:12 p. m.',
		'Efectivo',
		'Boleta',
		'B001-00000004',
		NULL,
		45.00,
		'[{"nombre":"Menú del día","cantidad":3,"precioUnitario":15.00}]',
		'activa'
	);
