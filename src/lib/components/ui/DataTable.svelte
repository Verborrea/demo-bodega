<script lang="ts" generics="T">
	import {
		ChevronLeft,
		ChevronRight,
		ChevronUp,
		ChevronDown,
		ChevronsUpDown
	} from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	export interface ColumnaTabla<T> {
		id: string;
		etiqueta: string;
		ordenable?: boolean;
		alinear?: 'derecha';
		claseTh?: string;
		celda: Snippet<[T]>;
	}

	interface Props<T> {
		columnas: ColumnaTabla<T>[];
		filas: T[];
		claveFila: (fila: T) => string;
		cargando?: boolean;
		mensajeVacio?: string;
		ordenPor?: string | null;
		ordenDireccion?: 'asc' | 'desc';
		onOrdenar?: (columnaId: string) => void;
		tarjetaMovil: Snippet<[T]>;
		pagina: number;
		totalPaginas: number;
		total: number;
		pageSize: number;
		onCambiarPagina: (n: number) => void;
	}

	let {
		columnas,
		filas,
		claveFila,
		cargando = false,
		mensajeVacio = 'No se encontraron resultados',
		ordenPor = null,
		ordenDireccion = 'asc',
		onOrdenar,
		tarjetaMovil,
		pagina,
		totalPaginas,
		total,
		pageSize,
		onCambiarPagina
	}: Props<T> = $props();
</script>

<div class="flex flex-col gap-4">
	<div class="hidden overflow-x-auto rounded-2xl border-2 border-stone-200 bg-white lg:block">
		<table class="w-full text-sm">
			<thead>
				<tr
					class="border-b border-stone-100 text-left text-xs leading-3.75 text-stone-400 uppercase"
				>
					{#each columnas as col (col.id)}
						<th
							class="p-3 font-bold {col.alinear === 'derecha' ? 'text-right' : ''} {col.claseTh ??
								''}"
						>
							{#if col.ordenable && onOrdenar}
								<button
									type="button"
									onclick={() => onOrdenar(col.id)}
									class="inline-flex cursor-pointer items-center gap-1 uppercase hover:text-stone-700 {col.alinear ===
									'derecha'
										? 'flex-row-reverse'
										: ''}"
								>
									{col.etiqueta}
									{#if ordenPor === col.id}
										{#if ordenDireccion === 'asc'}
											<ChevronUp size={12} strokeWidth={3} class="text-stone-700" />
										{:else}
											<ChevronDown size={12} strokeWidth={3} class="text-stone-700" />
										{/if}
									{:else}
										<ChevronsUpDown size={12} class="text-stone-400" />
									{/if}
								</button>
							{:else}
								{col.etiqueta}
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody class="divide-y divide-stone-100">
				{#if filas.length === 0}
					<tr>
						<td colspan={columnas.length} class="py-8 text-center text-sm text-stone-400">
							{cargando ? 'Cargando…' : mensajeVacio}
						</td>
					</tr>
				{/if}
				{#each filas as fila (claveFila(fila))}
					<tr>
						{#each columnas as col (col.id)}
							<td class="p-3 {col.alinear === 'derecha' ? 'text-right' : ''}">
								{@render col.celda(fila)}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="flex flex-col gap-3 lg:hidden">
		{#if filas.length === 0}
			<p
				class="rounded-2xl border-2 border-stone-200 bg-white p-8 text-center text-sm text-stone-400"
			>
				{cargando ? 'Cargando…' : mensajeVacio}
			</p>
		{/if}
		{#each filas as fila (claveFila(fila))}
			{@render tarjetaMovil(fila)}
		{/each}
	</div>

	{#if total > 0}
		<div
			class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-stone-200 bg-white p-4"
		>
			<p class="text-sm text-stone-400">
				Mostrando {(pagina - 1) * pageSize + 1}–{Math.min(pagina * pageSize, total)} de {total}
			</p>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => onCambiarPagina(pagina - 1)}
					disabled={pagina <= 1}
					class="flex size-11 cursor-pointer items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40"
					aria-label="Página anterior"
				>
					<ChevronLeft size={16} />
				</button>
				<span class="px-2 text-sm font-bold text-stone-700">Página {pagina} de {totalPaginas}</span>
				<button
					type="button"
					onclick={() => onCambiarPagina(pagina + 1)}
					disabled={pagina >= totalPaginas}
					class="flex size-11 cursor-pointer items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40"
					aria-label="Página siguiente"
				>
					<ChevronRight size={16} />
				</button>
			</div>
		</div>
	{/if}
</div>
