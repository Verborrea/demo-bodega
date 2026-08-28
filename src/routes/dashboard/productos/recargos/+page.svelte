<script lang="ts">
	import { invalidate } from '$app/navigation';
	import toast from 'svelte-french-toast';
	import { Trash2, Percent, X } from '@lucide/svelte';
	import {
		Button,
		Dialog,
		Input,
		Checkbox,
		Select,
		MoneyInput,
		Breadcrumbs,
		ConfirmDialog
	} from '$lib/components/ui';
	import { currency } from '$lib/utils';
	import type { PageData } from './$types';
	import type { ReglaRecargoDTO } from '$lib/server/recargos';

	let { data }: { data: PageData } = $props();

	let reglas = $state<ReglaRecargoDTO[]>(data.reglas);

	function categoriasLabel(regla: ReglaRecargoDTO): string {
		return regla.categoriaNombres.length > 0
			? regla.categoriaNombres.join(', ')
			: 'Todas las categorías';
	}

	async function cargarReglas() {
		const res = await fetch('/api/recargo-precio');
		if (res.ok) reglas = (await res.json()) as ReglaRecargoDTO[];
	}

	// Cada regla se prende/apaga por su cuenta (ej. "nocturno" y "feriado" son ocasiones
	// independientes) — no hay un interruptor único que las controle a todas juntas.
	let cambiandoId = $state<string | null>(null);

	async function alternar(regla: ReglaRecargoDTO) {
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
			await Promise.all([cargarReglas(), invalidate('recargo:precio')]);
			toast.success(activando ? 'Modo activado' : 'Modo desactivado');
		} finally {
			cambiandoId = null;
		}
	}

	let dialogOpen = $state(false);
	let nombre = $state('');
	let todasCategorias = $state(true);
	// Orden de selección (no un Record por id): el desplegable va agregando de a una, y el
	// orden en que se agregaron es justo el orden en que tiene sentido mostrarlas.
	let categoriaIdsSeleccionadas = $state<string[]>([]);
	let categoriaParaAgregar = $state('');
	let modo: 'soles' | 'porcentaje' = $state('soles');
	let monto = $state('');
	let guardando = $state(false);

	const categoriasDisponibles = $derived(
		data.categorias.filter((c) => !categoriaIdsSeleccionadas.includes(c.id))
	);

	function agregarCategoria() {
		if (!categoriaParaAgregar) return;
		categoriaIdsSeleccionadas = [...categoriaIdsSeleccionadas, categoriaParaAgregar];
		categoriaParaAgregar = '';
	}

	function quitarCategoria(id: string) {
		categoriaIdsSeleccionadas = categoriaIdsSeleccionadas.filter((catId) => catId !== id);
	}

	function abrirDialog() {
		nombre = '';
		todasCategorias = true;
		categoriaIdsSeleccionadas = [];
		categoriaParaAgregar = '';
		modo = 'soles';
		monto = '';
		dialogOpen = true;
	}

	async function handleGuardar(event: SubmitEvent) {
		event.preventDefault();
		const montoNum = Number(monto);
		if (!nombre.trim()) {
			toast.error('Ponle un nombre al modo');
			return;
		}
		if (!montoNum) {
			toast.error('Ingresa un monto distinto de cero');
			return;
		}
		const categoriaIds = todasCategorias ? [] : categoriaIdsSeleccionadas;
		if (!todasCategorias && categoriaIds.length === 0) {
			toast.error('Selecciona al menos una categoría, o marca "todas las categorías"');
			return;
		}

		guardando = true;
		try {
			const res = await fetch('/api/recargo-precio', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nombre: nombre.trim(), categoriaIds, monto: montoNum, modo })
			});
			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(cuerpo?.message ?? 'No se pudo crear el modo');
				return;
			}
			toast.success('Modo creado');
			dialogOpen = false;
			await Promise.all([cargarReglas(), invalidate('recargo:precio')]);
		} finally {
			guardando = false;
		}
	}

	let confirmEliminarOpen = $state(false);
	let reglaAEliminar = $state<ReglaRecargoDTO | null>(null);
	let eliminando = $state(false);

	function pedirEliminar(regla: ReglaRecargoDTO) {
		reglaAEliminar = regla;
		confirmEliminarOpen = true;
	}

	async function confirmarEliminar() {
		if (!reglaAEliminar) return;
		eliminando = true;
		try {
			const res = await fetch(`/api/recargo-precio/${reglaAEliminar.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('request failed');
			toast.success('Modo eliminado');
			confirmEliminarOpen = false;
			await Promise.all([cargarReglas(), invalidate('recargo:precio')]);
		} catch {
			toast.error('No se pudo eliminar el modo');
		} finally {
			eliminando = false;
		}
	}
</script>

<svelte:head>
	<title>Modo de precio · La Central</title>
</svelte:head>

<main class="flex flex-1 flex-col gap-6 p-6">
	<Breadcrumbs
		items={[
			{ label: 'Dashboard', href: '/dashboard' },
			{ label: 'Inventario', href: '/dashboard/productos' },
			{ label: 'Modo de precio' }
		]}
	/>

	<header
		class="flex flex-col gap-4 @min-[768px]:flex-row @min-[768px]:items-start @min-[768px]:justify-between"
	>
		<div class="@min-[768px]:max-w-xl">
			<h1 class="title">Modo de precio</h1>
			<p class="mt-1 text-sm text-stone-400">
				Ej: "Modo nocturno" +S/2 en Bebidas. No cambia el precio guardado del producto — se aplica
				solo mientras está activo, y se apaga solo al cerrar caja.
			</p>
		</div>
		<button
			type="button"
			onclick={abrirDialog}
			class="h-12 cursor-pointer rounded-xl bg-success px-6 text-sm font-extrabold text-white transition-colors hover:bg-success-dark @min-[768px]:shrink-0"
		>
			Nuevo Modo
		</button>
	</header>

	{#if reglas.length === 0}
		<p class="rounded-2xl bg-white p-10 text-center text-sm text-stone-400">
			Todavía no hay modos. Crea el primero con el botón de arriba.
		</p>
	{:else}
		<div class="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-3">
			{#each reglas as regla (regla.id)}
				<div
					class="flex flex-col gap-4 rounded-2xl border-2 bg-white p-5 shadow-sm transition-colors {regla.activo
						? 'border-primary'
						: 'border-stone-100'}"
				>
					<div class="flex items-start justify-between gap-2">
						<div class="flex min-w-0 items-center gap-2">
							<span
								class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600"
							>
								<Percent size={16} strokeWidth={2.5} />
							</span>
							<div class="min-w-0">
								<p class="truncate font-extrabold text-stone-800">{regla.nombre}</p>
								<p class="truncate text-xs text-stone-400">{categoriasLabel(regla)}</p>
							</div>
						</div>
						<button
							type="button"
							onclick={() => pedirEliminar(regla)}
							class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-red-50 hover:text-error"
							aria-label="Eliminar {regla.nombre}"
						>
							<Trash2 size={16} />
						</button>
					</div>

					<div class="flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
						<div>
							<p class="text-2xl font-extrabold text-stone-800">
								+{regla.modo === 'soles' ? currency(regla.monto) : `${regla.monto}%`}
							</p>
							<p class="text-xs text-stone-400">
								{regla.activo
									? `Activo${regla.activadoPor ? ` · ${regla.activadoPor}` : ''}`
									: 'Inactivo'}
							</p>
						</div>
						<button
							type="button"
							role="switch"
							aria-checked={regla.activo}
							aria-label={regla.activo ? `Desactivar ${regla.nombre}` : `Activar ${regla.nombre}`}
							onclick={() => alternar(regla)}
							disabled={cambiandoId === regla.id}
							class="relative h-7 w-13 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 {regla.activo
								? 'bg-primary'
								: 'bg-stone-300'}"
						>
							<span
								class="absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform {regla.activo
									? 'translate-x-6'
									: ''}"
							></span>
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</main>

<Dialog bind:open={dialogOpen} title="Nuevo Modo" class="max-w-sm">
	<form onsubmit={handleGuardar} class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label for="recargo-nombre" class="text-sm font-bold text-stone-800">Nombre</label>
			<Input id="recargo-nombre" bind:value={nombre} placeholder="Ej. Modo feriados" />
		</div>

		<div class="flex flex-col gap-1.5">
			<span class="text-sm font-bold text-stone-800">Categorías</span>
			<label class="flex cursor-pointer items-center gap-2.5 rounded-xl bg-stone-100 px-3 py-2.5">
				<Checkbox bind:checked={todasCategorias} />
				<span class="text-sm font-medium text-stone-700">Todas las categorías</span>
			</label>
			{#if !todasCategorias}
				<Select
					bind:value={categoriaParaAgregar}
					onchange={agregarCategoria}
					disabled={categoriasDisponibles.length === 0}
				>
					<option value="" disabled selected>
						{categoriasDisponibles.length > 0 ? 'Agregar categoría…' : 'No quedan más categorías'}
					</option>
					{#each categoriasDisponibles as categoria (categoria.id)}
						<option value={categoria.id}>{categoria.nombre}</option>
					{/each}
				</Select>

				{#if categoriaIdsSeleccionadas.length > 0}
					<div class="flex flex-wrap gap-1.5">
						{#each categoriaIdsSeleccionadas as id (id)}
							{@const categoria = data.categorias.find((c) => c.id === id)}
							<span
								class="flex items-center gap-1 rounded-full bg-yellow-100 py-1 pr-1.5 pl-3 text-xs font-bold text-yellow-700"
							>
								{categoria?.nombre}
								<button
									type="button"
									onclick={() => quitarCategoria(id)}
									class="flex size-5 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-yellow-200"
									aria-label="Quitar {categoria?.nombre}"
								>
									<X size={12} strokeWidth={2.5} />
								</button>
							</span>
						{/each}
					</div>
				{:else}
					<p class="text-xs text-stone-400">Todavía no agregaste ninguna categoría.</p>
				{/if}
			{/if}
		</div>

		<div class="flex gap-3">
			<div class="flex flex-1 flex-col gap-1.5">
				<span class="text-sm font-bold text-stone-800">Tipo</span>
				<div class="grid grid-cols-2 gap-2">
					<button
						type="button"
						onclick={() => (modo = 'soles')}
						class="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-bold transition-colors {modo ===
						'soles'
							? 'bg-primary text-stone-900'
							: 'bg-stone-200 text-stone-500 hover:bg-stone-300'}"
					>
						Soles
					</button>
					<button
						type="button"
						onclick={() => (modo = 'porcentaje')}
						class="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-bold transition-colors {modo ===
						'porcentaje'
							? 'bg-primary text-stone-900'
							: 'bg-stone-200 text-stone-500 hover:bg-stone-300'}"
					>
						%
					</button>
				</div>
			</div>
			<div class="flex w-28 flex-col gap-1.5">
				<span class="text-sm font-bold text-stone-800">Monto</span>
				{#if modo === 'soles'}
					<MoneyInput bind:value={monto} />
				{:else}
					<input
						type="number"
						step="any"
						inputmode="decimal"
						placeholder="0"
						bind:value={monto}
						class="input"
					/>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<Button type="button" variant="danger" onclick={() => (dialogOpen = false)}>Cancelar</Button>
			<Button type="submit" variant="success" disabled={guardando}>
				{guardando ? 'Guardando…' : 'Crear'}
			</Button>
		</div>
	</form>
</Dialog>

<ConfirmDialog
	bind:open={confirmEliminarOpen}
	title="Eliminar modo"
	message={`¿Eliminar "${reglaAEliminar?.nombre ?? ''}"? Esta acción no se puede deshacer.`}
	confirmando={eliminando}
	onConfirm={confirmarEliminar}
/>
