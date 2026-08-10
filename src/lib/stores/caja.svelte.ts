export type MetodoCaja = 'Efectivo' | 'Yape';
export type MetodoPago = MetodoCaja | 'Tarjeta';
export type TipoMovimiento = 'venta' | 'ingreso' | 'egreso';

export interface Movimiento {
	id: string;
	tipo: TipoMovimiento;
	metodo: MetodoPago;
	monto: number;
	descripcion: string;
	cliente?: string;
	hora: string;
}

function horaActual() {
	return new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function fechaActual() {
	const d = new Date();
	const dd = String(d.getDate()).padStart(2, '0');
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	return `${dd}/${mm}/${d.getFullYear()}`;
}

class CajaStore {
	abierta = $state(false);
	fechaApertura = $state('');
	montosIniciales = $state<Record<MetodoCaja, number>>({ Efectivo: 0, Yape: 0 });
	movimientos = $state<Movimiento[]>([]);

	abrir(efectivo: number, yape: number) {
		this.abierta = true;
		this.fechaApertura = fechaActual();
		this.montosIniciales = { Efectivo: efectivo, Yape: yape };
		this.movimientos = [];
	}

	cerrar() {
		this.abierta = false;
	}

	private registrar(
		tipo: TipoMovimiento,
		metodo: MetodoPago,
		monto: number,
		descripcion: string,
		cliente?: string
	) {
		this.movimientos = [
			{ id: crypto.randomUUID(), tipo, metodo, monto, descripcion, cliente, hora: horaActual() },
			...this.movimientos
		];
	}

	registrarVenta(metodo: MetodoPago, monto: number, descripcion: string, cliente?: string) {
		this.registrar('venta', metodo, monto, descripcion, cliente);
	}

	registrarIngreso(metodo: MetodoCaja, monto: number, descripcion: string) {
		this.registrar('ingreso', metodo, monto, descripcion);
	}

	registrarEgreso(metodo: MetodoCaja, monto: number, descripcion: string) {
		this.registrar('egreso', metodo, monto, descripcion);
	}

	/** Neto de movimientos (ventas + ingresos - egresos) para un método rastreado en caja física. */
	netoMovimiento(metodo: MetodoCaja) {
		return this.movimientos
			.filter((m) => m.metodo === metodo)
			.reduce((acc, m) => acc + (m.tipo === 'egreso' ? -m.monto : m.monto), 0);
	}

	montoEsperado(metodo: MetodoCaja) {
		return this.montosIniciales[metodo] + this.netoMovimiento(metodo);
	}

	get ventas() {
		return this.movimientos.filter((m) => m.tipo === 'venta');
	}

	get totalVentas() {
		return this.ventas.reduce((acc, m) => acc + m.monto, 0);
	}
}

export const caja = new CajaStore();
