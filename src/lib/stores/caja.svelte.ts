export type MetodoCaja = 'Efectivo' | 'Yape';
export type MetodoPago = MetodoCaja | 'Tarjeta';
export type TipoMovimiento = 'venta' | 'ingreso' | 'egreso';
export type TipoComprobante = 'Boleta' | 'Factura';

export interface ItemVenta {
	nombre: string;
	cantidad: number;
	precioUnitario: number;
}

export interface Movimiento {
	id: string;
	tipo: TipoMovimiento;
	metodo: MetodoPago;
	monto: number;
	descripcion: string;
	cliente?: string;
	comprobante?: TipoComprobante;
	numeroDocumento?: string;
	items?: ItemVenta[];
	hora: string;
	fecha: Date;
}

export interface SesionCaja {
	id: string;
	fechaApertura: string;
	horaApertura: string;
	horaCierre: string;
	montosIniciales: Record<MetodoCaja, number>;
	esperados: Record<MetodoCaja, number>;
	montosFinales: Record<MetodoCaja, number>;
	movimientos: Movimiento[];
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

const historialSeed: SesionCaja[] = [
	{
		id: 'sesion-09-08',
		fechaApertura: '09/08/2026',
		horaApertura: '08:00 a. m.',
		horaCierre: '09:15 p. m.',
		montosIniciales: { Efectivo: 100, Yape: 30 },
		esperados: { Efectivo: 380.5, Yape: 95 },
		montosFinales: { Efectivo: 375.5, Yape: 95 },
		movimientos: []
	},
	{
		id: 'sesion-08-08',
		fechaApertura: '08/08/2026',
		horaApertura: '08:05 a. m.',
		horaCierre: '08:50 p. m.',
		montosIniciales: { Efectivo: 150, Yape: 50 },
		esperados: { Efectivo: 290, Yape: 140 },
		montosFinales: { Efectivo: 295, Yape: 140 },
		movimientos: []
	}
];

class CajaStore {
	abierta = $state(false);
	fechaApertura = $state('');
	horaApertura = $state('');
	montosIniciales = $state<Record<MetodoCaja, number>>({ Efectivo: 0, Yape: 0 });
	movimientos = $state<Movimiento[]>([]);
	historial = $state<SesionCaja[]>(historialSeed);

	abrir(efectivo: number, yape: number) {
		this.abierta = true;
		this.fechaApertura = fechaActual();
		this.horaApertura = horaActual();
		this.montosIniciales = { Efectivo: efectivo, Yape: yape };
		this.movimientos = [];
	}

	/** Cierra la caja y archiva la sesión con lo contado (o lo esperado, si no se contó). */
	cerrar(montosContados?: Record<MetodoCaja, number>) {
		const esperados: Record<MetodoCaja, number> = {
			Efectivo: this.montoEsperado('Efectivo'),
			Yape: this.montoEsperado('Yape')
		};
		this.historial = [
			{
				id: crypto.randomUUID(),
				fechaApertura: this.fechaApertura,
				horaApertura: this.horaApertura,
				horaCierre: horaActual(),
				montosIniciales: { ...this.montosIniciales },
				esperados,
				montosFinales: montosContados ?? esperados,
				movimientos: this.movimientos
			},
			...this.historial
		];
		this.abierta = false;
	}

	private registrar(
		tipo: TipoMovimiento,
		datos: {
			metodo: MetodoPago;
			monto: number;
			descripcion: string;
			cliente?: string;
			comprobante?: TipoComprobante;
			numeroDocumento?: string;
			items?: ItemVenta[];
		}
	) {
		this.movimientos = [
			{
				id: crypto.randomUUID(),
				tipo,
				...datos,
				hora: horaActual(),
				fecha: new Date()
			},
			...this.movimientos
		];
	}

	registrarVenta(datos: {
		metodo: MetodoPago;
		monto: number;
		descripcion: string;
		cliente?: string;
		comprobante?: TipoComprobante;
		numeroDocumento?: string;
		items?: ItemVenta[];
	}) {
		this.registrar('venta', datos);
	}

	registrarIngreso(metodo: MetodoCaja, monto: number, descripcion: string) {
		this.registrar('ingreso', { metodo, monto, descripcion });
	}

	registrarEgreso(metodo: MetodoCaja, monto: number, descripcion: string) {
		this.registrar('egreso', { metodo, monto, descripcion });
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
