/// <reference types="../worker-configuration.d.ts" />
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: import('$lib/server/auth').Usuario | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: Env;
			cf: CfProperties;
			ctx: ExecutionContext;
			// Cache API de Cloudflare (`caches.default`). Sin tipo explícito acá: el Request/
			// Response de Workers choca de forma estructural con los de DOM (usados por el
			// resto de la app vía "lib": ["DOM"]) apenas se referencian juntos en un .d.ts
			// ambiental. Se tipa puntualmente en $lib/server/cache.ts, un módulo normal donde
			// esa colisión no ocurre.
			caches: unknown;
		}
	}
}

export {};
