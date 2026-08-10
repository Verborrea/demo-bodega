-- Migration number: 0002 	 2026-08-10T21:52:00.000Z

INSERT INTO proveedores (id, nombre) VALUES
	('prov-distribuidora-central', 'Distribuidora Central'),
	('prov-coca-cola-peru', 'Coca-Cola Perú'),
	('prov-panaderia-san-jorge', 'Panadería San Jorge'),
	('prov-gloria', 'Gloria'),
	('prov-alicorp', 'Alicorp'),
	('prov-backus', 'Backus');

INSERT INTO categorias (id, nombre) VALUES
	('cat-bebidas', 'Bebidas'),
	('cat-abarrotes', 'Abarrotes'),
	('cat-snacks', 'Snacks'),
	('cat-lacteos', 'Lácteos'),
	('cat-panaderia', 'Panadería');

INSERT INTO productos (id, nombre, proveedor_id, categoria_id, cantidad, codigo_barras) VALUES
	('agua', 'Agua 625ml', 'prov-distribuidora-central', 'cat-bebidas', 24, '7750243010001'),
	('gaseosa', 'Gaseosa 500ml', 'prov-coca-cola-peru', 'cat-bebidas', 18, '7750243011152'),
	('pan', 'Pan', 'prov-panaderia-san-jorge', 'cat-panaderia', 60, NULL),
	('leche', 'Leche 1L', 'prov-gloria', 'cat-lacteos', 15, '7750243013101'),
	('arroz', 'Arroz 1kg', 'prov-alicorp', 'cat-abarrotes', 30, '7750243014030'),
	('galletas', 'Galletas', 'prov-alicorp', 'cat-snacks', 22, NULL),
	('cerveza', 'Cerveza 620ml', 'prov-backus', 'cat-bebidas', 12, '7750243015012'),
	('chocolate', 'Chocolate', 'prov-alicorp', 'cat-snacks', 0, NULL);

INSERT INTO precios (id, producto_id, nombre, valor, orden) VALUES
	('precio-agua-unitario', 'agua', 'Unitario', 2.00, 0),
	('precio-agua-caja', 'agua', 'Caja x24', 40.00, 1),
	('precio-gaseosa-unitario', 'gaseosa', 'Unitario', 3.50, 0),
	('precio-gaseosa-mayor', 'gaseosa', 'Por mayor (x6)', 18.00, 1),
	('precio-pan-unitario', 'pan', 'Unitario', 0.50, 0),
	('precio-leche-unitario', 'leche', 'Unitario', 5.00, 0),
	('precio-arroz-unitario', 'arroz', 'Unitario', 4.20, 0),
	('precio-galletas-unitario', 'galletas', 'Unitario', 2.50, 0),
	('precio-cerveza-unitario', 'cerveza', 'Unitario', 7.00, 0),
	('precio-chocolate-unitario', 'chocolate', 'Unitario', 3.00, 0);
