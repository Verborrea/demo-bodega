<script lang="ts">
	import toast from 'svelte-french-toast';
	import { Plus, Trash2, Barcode } from '@lucide/svelte';
	import { Button, Input, Combobox, MoneyInput, Checkbox } from '$lib/components/ui';
	import { currency, calcularGanancia } from '$lib/utils';
	import type { ProductoDTO, OpcionSimple } from '$lib/server/productos';

	interface PresentacionForm {
		id?: string;
		nombre: string;
		factorUnidades: string;
		precio: string;
		cantidad: string;
	}

	interface Props {
		producto?: ProductoDTO | null;
		marcasList: OpcionSimple[];
		categoriasList: OpcionSimple[];
		codigoBarrasInicial?: string;
		permitirSeguirAgregando?: boolean;
		onMarcaCreada?: (marca: OpcionSimple) => void;
		onCategoriaCreada?: (categoria: OpcionSimple) => void;
		onGuardado: (producto: ProductoDTO, opts: { seguirAgregando: boolean }) => void;
		onCancelar: () => void;
	}

	let {
		producto = null,
		marcasList,
		categoriasList,
		codigoBarrasInicial = '',
		permitirSeguirAgregando = true,
		onMarcaCreada,
		onCategoriaCreada,
		onGuardado,
		onCancelar
	}: Props = $props();

	const editandoId = producto?.id ?? null;

	const marcaNombres = $derived(marcasList.map((m) => m.nombre));
	const categoriaNombres = $derived(categoriasList.map((c) => c.nombre));

	let nombre = $state(producto?.nombre ?? '');
	let marca = $state(producto?.marca ?? '');
	let categoria = $state(producto?.categoria ?? categoriaNombres[0] ?? '');
	let codigoBarras = $state(producto?.codigoBarras ?? codigoBarrasInicial);
	let presentaciones = $state<PresentacionForm[]>(
		producto && producto.presentaciones.length > 0
			? producto.presentaciones.map((p) => ({
					id: p.id,
					nombre: p.nombre,
					factorUnidades: String(p.factorUnidades),
					precio: String(p.precio),
					cantidad: String(p.cantidad)
				}))
			: [{ nombre: 'Unidad', factorUnidades: '1', precio: '', cantidad: '' }]
	);
	let costoUltimo = $state(producto?.costoUltimo != null ? String(producto.costoUltimo) : '');
	let seguirAgregando = $state(false);
	let guardando = $state(false);
	let nombreInputEl: HTMLInputElement | undefined = $state();

	// El input numérico de MoneyInput hace que Svelte entregue `costoUltimo` como number en
	// vez de string apenas se escribe algo (aunque el tipo diga string) — de ahí que .trim()
	// directo sobre costoUltimo reventaba. String(...) lo normaliza sea cual sea el tipo real.
	function parsearCosto(valor: string | number): number | null {
		const texto = String(valor ?? '').trim();
		if (!texto) return null;
		const num = Number(texto);
		return Number.isFinite(num) ? num : null;
	}

	const ganancia = $derived(
		calcularGanancia(parsearCosto(costoUltimo), Number(presentaciones[0]?.precio) || 0)
	);

	function agregarPresentacion() {
		presentaciones = [
			...presentaciones,
			{ nombre: '', factorUnidades: '', precio: '', cantidad: '' }
		];
	}

	function quitarPresentacion(index: number) {
		if (index === 0 || presentaciones.length <= 1) return;
		presentaciones = presentaciones.filter((_, i) => i !== index);
	}

	function evitarEnvioPorEnter(event: KeyboardEvent) {
		if (event.key === 'Enter') event.preventDefault();
	}

	async function crearOpcion(tipo: 'marca' | 'categoria', valor: string) {
		try {
			const res = await fetch(`/api/${tipo === 'marca' ? 'marcas' : 'categorias'}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nombre: valor })
			});
			if (!res.ok) return;
			const creado = (await res.json()) as OpcionSimple;
			if (tipo === 'marca') onMarcaCreada?.(creado);
			else onCategoriaCreada?.(creado);
		} catch {
			// El producto igual podrá crearse: el servidor resuelve o crea la marca/categoría por nombre.
		}
	}

	async function handleGuardar(event: SubmitEvent) {
		event.preventDefault();

		const payloadPresentaciones = presentaciones
			.map((p, index) => ({
				id: p.id,
				nombre: index === 0 ? 'Unidad' : p.nombre.trim(),
				factorUnidades: index === 0 ? 1 : Number(p.factorUnidades),
				precio: Number(p.precio),
				cantidadInicial: editandoId ? undefined : Math.max(0, Number(p.cantidad) || 0),
				cantidad: editandoId ? Math.max(0, Math.floor(Number(p.cantidad)) || 0) : undefined
			}))
			.filter((p) => p.nombre && p.factorUnidades >= 1 && p.precio >= 0);

		if (!nombre.trim() || !categoria.trim() || payloadPresentaciones.length === 0) {
			toast.error('Completa el nombre, categoría y al menos una presentación válida');
			return;
		}

		guardando = true;
		try {
			const payload = {
				nombre: nombre.trim(),
				marca: marca.trim() || undefined,
				categoria: categoria.trim(),
				codigoBarras: codigoBarras.trim() || null,
				costoUltimo: parsearCosto(costoUltimo),
				presentaciones: payloadPresentaciones
			};

			const res = editandoId
				? await fetch(`/api/productos/${editandoId}`, {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					})
				: await fetch('/api/productos', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					});

			if (!res.ok) {
				const cuerpo = (await res.json().catch(() => null)) as { message?: string } | null;
				toast.error(
					cuerpo?.message ??
						(editandoId ? 'No se pudo actualizar el producto' : 'No se pudo crear el producto')
				);
				return;
			}

			const productoGuardado = (await res.json()) as ProductoDTO;
			toast.success(editandoId ? 'Producto actualizado' : 'Producto agregado');
			onGuardado(productoGuardado, { seguirAgregando: !editandoId && seguirAgregando });

			if (!editandoId && seguirAgregando) {
				nombre = '';
				codigoBarras = '';
				costoUltimo = '';
				presentaciones = [{ nombre: 'Unidad', factorUnidades: '1', precio: '', cantidad: '' }];
				nombreInputEl?.focus();
			}
		} finally {
			guardando = false;
		}
	}
</script>

<form onsubmit={handleGuardar} class="flex flex-col gap-4">
	<div class="flex flex-col gap-1.5">
		<label for="pf-nombre" class="text-sm font-bold text-stone-800">Nombre del producto</label>
		<input
			id="pf-nombre"
			type="text"
			placeholder="Colocar nombre del producto"
			bind:value={nombre}
			bind:this={nombreInputEl}
			class="input"
		/>
	</div>

	<div class="grid grid-cols-2 gap-3">
		<div class="flex flex-col gap-1.5">
			<label for="pf-marca" class="text-sm font-bold text-stone-800">Marca (opcional)</label>
			<Combobox
				id="pf-marca"
				bind:value={marca}
				items={marcaNombres}
				placeholder="Buscar o crear marca…"
				oncreate={(valor) => crearOpcion('marca', valor)}
			/>
		</div>
		<div class="flex flex-col gap-1.5">
			<label for="pf-categoria" class="text-sm font-bold text-stone-800">Categoría</label>
			<Combobox
				id="pf-categoria"
				bind:value={categoria}
				items={categoriaNombres}
				placeholder="Buscar o crear categoría…"
				oncreate={(valor) => crearOpcion('categoria', valor)}
			/>
		</div>
	</div>

	<div class="flex flex-col gap-2">
		<div class="flex items-center justify-between">
			<span class="text-sm font-bold text-stone-800">Presentaciones</span>
			<button type="button" onclick={agregarPresentacion} class="link text-xs">
				<Plus size={12} strokeWidth={3} />
				Agregar presentación
			</button>
		</div>
		<p class="text-xs leading-3.75 text-stone-400">
			La primera es la presentación base (1 unidad). Una "Caja" con factor 6 equivale a 6 unidades.
		</p>
		{#each presentaciones as presentacion, index (index)}
			<div class="flex items-center gap-2">
				{#if index === 0}
					<input type="text" value="Unidad" disabled class="input min-w-0 flex-1 opacity-60" />
					<input type="text" value="1 unidad" disabled class="input w-24 shrink-0 opacity-60" />
				{:else}
					<input
						type="text"
						placeholder="Nombre (ej. Caja, Sixpack)"
						bind:value={presentacion.nombre}
						class="input min-w-0 flex-1"
					/>
					<input
						type="number"
						min="1"
						step="any"
						inputmode="numeric"
						placeholder="Factor"
						bind:value={presentacion.factorUnidades}
						class="input w-24 shrink-0"
					/>
				{/if}
				<MoneyInput bind:value={presentacion.precio} class="w-28 shrink-0" />
				<input
					type="number"
					min="0"
					step="any"
					inputmode="numeric"
					placeholder="Stock"
					bind:value={presentacion.cantidad}
					class="input w-20 shrink-0"
					aria-label="Stock de {presentacion.nombre || 'esta presentación'}"
				/>
				<button
					type="button"
					onclick={() => quitarPresentacion(index)}
					disabled={index === 0 || presentaciones.length <= 1}
					class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-red-50 hover:text-error disabled:cursor-not-allowed disabled:opacity-30"
					aria-label="Quitar presentación"
				>
					<Trash2 size={16} />
				</button>
			</div>
		{/each}
	</div>

	<div class="grid grid-cols-2 gap-3">
		<div class="flex flex-col gap-1.5">
			<label for="pf-costo" class="text-sm font-bold text-stone-800">Costo (último)</label>
			<MoneyInput id="pf-costo" bind:value={costoUltimo} />
		</div>
		<div class="flex flex-col gap-1.5">
			<span class="text-sm font-bold text-stone-800">Ganancia</span>
			<div class="input flex items-center justify-between opacity-80">
				{#if ganancia}
					<span class="font-bold {ganancia.monto >= 0 ? 'text-success-dark' : 'text-error'}">
						{currency(ganancia.monto)}
					</span>
					<span class="font-bold {ganancia.monto >= 0 ? 'text-success-dark' : 'text-error'}"
						>{ganancia.porcentaje.toFixed(1)}%</span
					>
				{:else}
					<span class="text-stone-400">Sin costo registrado</span>
				{/if}
			</div>
		</div>
	</div>

	<div class="flex flex-col gap-1.5">
		<label for="pf-codigo-barras" class="text-sm font-bold text-stone-800">
			Código de barras (opcional)
		</label>
		<Input
			id="pf-codigo-barras"
			bind:value={codigoBarras}
			placeholder="Escanea o escribe el código"
			onkeydown={evitarEnvioPorEnter}
		>
			{#snippet icon()}
				<Barcode size={18} />
			{/snippet}
		</Input>
	</div>

	{#if !editandoId && permitirSeguirAgregando}
		<Checkbox bind:checked={seguirAgregando}>Seguir añadiendo</Checkbox>
	{/if}

	<div class="grid grid-cols-2 gap-3">
		<Button type="button" variant="danger" onclick={onCancelar}>Cancelar</Button>
		<Button type="submit" variant="success" disabled={guardando}>
			{guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Agregar'}
		</Button>
	</div>
</form>
