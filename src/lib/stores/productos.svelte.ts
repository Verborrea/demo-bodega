export interface Producto {
	id: string;
	nombre: string;
	proveedor: string;
	categoria: string;
	precio: number;
	cantidad: number;
}

export const proveedores = [
	'Distribuidora Central',
	'Coca-Cola Perú',
	'Panadería San Jorge',
	'Gloria',
	'Alicorp',
	'Backus'
];

export const categorias = ['Bebidas', 'Abarrotes', 'Snacks', 'Lácteos', 'Panadería'];

const seed: Producto[] = [
	{
		id: 'agua',
		nombre: 'Agua 625ml',
		proveedor: 'Distribuidora Central',
		categoria: 'Bebidas',
		precio: 2.0,
		cantidad: 24
	},
	{
		id: 'gaseosa',
		nombre: 'Gaseosa 500ml',
		proveedor: 'Coca-Cola Perú',
		categoria: 'Bebidas',
		precio: 3.5,
		cantidad: 18
	},
	{
		id: 'pan',
		nombre: 'Pan',
		proveedor: 'Panadería San Jorge',
		categoria: 'Panadería',
		precio: 0.5,
		cantidad: 60
	},
	{
		id: 'leche',
		nombre: 'Leche 1L',
		proveedor: 'Gloria',
		categoria: 'Lácteos',
		precio: 5.0,
		cantidad: 15
	},
	{
		id: 'arroz',
		nombre: 'Arroz 1kg',
		proveedor: 'Alicorp',
		categoria: 'Abarrotes',
		precio: 4.2,
		cantidad: 30
	},
	{
		id: 'galletas',
		nombre: 'Galletas',
		proveedor: 'Alicorp',
		categoria: 'Snacks',
		precio: 2.5,
		cantidad: 22
	},
	{
		id: 'cerveza',
		nombre: 'Cerveza 620ml',
		proveedor: 'Backus',
		categoria: 'Bebidas',
		precio: 7.0,
		cantidad: 12
	},
	{
		id: 'chocolate',
		nombre: 'Chocolate',
		proveedor: 'Alicorp',
		categoria: 'Snacks',
		precio: 3.0,
		cantidad: 0
	}
];

class ProductosStore {
	lista = $state<Producto[]>(seed);

	agregar(data: Omit<Producto, 'id'>) {
		this.lista = [{ id: crypto.randomUUID(), ...data }, ...this.lista];
	}

	ajustarStock(id: string, delta: number) {
		const producto = this.lista.find((p) => p.id === id);
		if (!producto) return;
		producto.cantidad = Math.max(0, producto.cantidad + delta);
	}

	descontar(id: string, cantidad: number) {
		this.ajustarStock(id, -cantidad);
	}
}

export const productos = new ProductosStore();
