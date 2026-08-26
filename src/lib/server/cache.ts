interface CacheDeBorde {
	match(request: Request): Promise<Response | undefined>;
	put(request: Request, response: Response): Promise<void>;
}

/**
 * Cache de borde (Cloudflare Cache API) para respuestas GET que se repiten muchísimo
 * (búsqueda de productos, escaneo de código de barras) pero cuyo origen (D1) cambia poco
 * — los productos se venden todo el día pero se ingresan/editan cada cierto tiempo.
 *
 * Solo cachea respuestas 200 (nunca un 404, para que un producto recién creado sea
 * buscable/escaneable de inmediato). No invalida al escribir: el TTL corto acota el
 * peor caso de "desactualizado" a unos segundos, lo cual es aceptable para una lista de
 * búsqueda — el precio/stock real de la venta lo valida el servidor al momento de cobrar,
 * no lo que se ve en esta lista.
 */
export async function conCacheDeBorde(
	request: Request,
	platform: App.Platform | undefined,
	ttlSegundos: number,
	generar: () => Promise<Response>
): Promise<Response> {
	const cache = (platform?.caches as { default?: CacheDeBorde } | undefined)?.default;
	if (!cache) return generar();

	const cacheKey = new Request(request.url, request);
	const enCache = await cache.match(cacheKey);
	if (enCache) return enCache;

	const respuesta = await generar();
	if (respuesta.ok) {
		const paraCache = respuesta.clone();
		paraCache.headers.set('Cache-Control', `public, max-age=${ttlSegundos}`);
		platform!.ctx.waitUntil(cache.put(cacheKey, paraCache));
	}
	return respuesta;
}
