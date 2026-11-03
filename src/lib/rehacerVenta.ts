import type { TipoVenta } from '$lib/server/ventas';

// "Rehacer venta": Ventas arma esto y navega a Nueva Venta, que lo toma al abrirse. Viaja por
// sessionStorage (de la pestaña, sin servidor ni query string) y se borra al leerlo: recargar
// Nueva Venta no vuelve a cargarlo y no queda nada viejo esperando.
const CLAVE = 'rehacerVenta';

export type ItemRehacer =
	| {
			tipo: 'producto';
			productoId: string;
			presentacionId: string;
			cantidad: number;
			precioUnitario: number;
			nombre: string;
	  }
	| { tipo: 'promo'; promoId: string; cantidad: number; precioUnitario: number; nombre: string };

export interface RehacerVenta {
	tipo: TipoVenta;
	items: ItemRehacer[];
	cliente: string | null;
	numeroDocumento: string | null;
	/** Solo si la venta original se pagó con un único método. */
	metodo: string | null;
}

/** false si el navegador no deja guardar (modo privado, almacenamiento bloqueado). */
export function guardarRehacerVenta(datos: RehacerVenta): boolean {
	try {
		sessionStorage.setItem(CLAVE, JSON.stringify(datos));
		return true;
	} catch {
		return false;
	}
}

/** Devuelve lo guardado y lo borra; null si no hay nada o no se puede leer. */
export function tomarRehacerVenta(): RehacerVenta | null {
	try {
		const crudo = sessionStorage.getItem(CLAVE);
		if (!crudo) return null;
		sessionStorage.removeItem(CLAVE);
		const datos = JSON.parse(crudo) as RehacerVenta;
		return Array.isArray(datos?.items) ? datos : null;
	} catch {
		return null;
	}
}
