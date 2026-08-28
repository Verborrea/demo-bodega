<script lang="ts">
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import { Moon } from '@lucide/svelte';
	import { currency } from '$lib/utils';
	import type { ReglaRecargoDTO } from '$lib/server/recargos';

	const reglas = $derived((page.data.reglasRecargo as ReglaRecargoDTO[] | undefined) ?? []);

	function categoriasLabel(regla: ReglaRecargoDTO): string {
		return regla.categoriaNombres.length > 0 ? regla.categoriaNombres.join(', ') : 'Todas';
	}

	let cambiandoId = $state<string | null>(null);

	async function alternar(regla: ReglaRecargoDTO) {
		// Se captura ANTES del fetch/invalidate: `reglas` es reactivo y ya refleja el nuevo
		// estado del servidor apenas resuelve el invalidate, así que leerlo después del
		// await para armar el toast mostraba el mensaje al revés de lo que acababa de pasar.
		const activando = !regla.activo;
		cambiandoId = regla.id;
		try {
			const res = await fetch(
				`/api/recargo-precio/${regla.id}/${activando ? 'activar' : 'desactivar'}`,
				{ method: 'POST' }
			);
			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo cambiar el modo');
				return;
			}
			await invalidate('recargo:precio');
			toast.success(activando ? `"${regla.nombre}" activado` : `"${regla.nombre}" desactivado`);
		} finally {
			cambiandoId = null;
		}
	}
</script>

<!-- Compacto a propósito: agregar/quitar reglas vive en Inventario → Modo (solo admin);
     acá solo el prender/apagar cada una (son independientes entre sí, ej. nocturno vs.
     feriado), para que la cajera lo use en su turno sin que ocupe espacio en el dashboard. -->
{#if reglas.length > 0}
	<div class="flex flex-col gap-2 rounded-2xl border-2 border-stone-200 bg-white p-3">
		{#each reglas as regla (regla.id)}
			<div class="flex items-center justify-between gap-3 px-1 py-0.5">
				<div class="flex min-w-0 items-center gap-2">
					<Moon
						size={14}
						strokeWidth={2.5}
						class="shrink-0 {regla.activo ? 'text-yellow-500' : 'text-stone-400'}"
					/>
					<p class="truncate text-sm font-bold text-stone-700">
						{regla.nombre}
						<span class="font-medium text-stone-400">
							· {categoriasLabel(regla)} +{regla.modo === 'soles'
								? currency(regla.monto)
								: `${regla.monto}%`}
						</span>
					</p>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={regla.activo}
					aria-label={regla.activo ? `Desactivar ${regla.nombre}` : `Activar ${regla.nombre}`}
					onclick={() => alternar(regla)}
					disabled={cambiandoId === regla.id}
					class="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 {regla.activo
						? 'bg-primary'
						: 'bg-stone-300'}"
				>
					<span
						class="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform {regla.activo
							? 'translate-x-5'
							: ''}"
					></span>
				</button>
			</div>
		{/each}
	</div>
{/if}
