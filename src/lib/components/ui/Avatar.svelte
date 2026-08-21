<script lang="ts">
	interface Props {
		nombre: string;
		seed?: string;
		class?: string;
	}

	let { nombre, seed, class: className = '' }: Props = $props();

	const AVATAR_COLORES = [
		'bg-yellow-400 text-stone-800',
		'bg-sky-400 text-white',
		'bg-pink-400 text-white',
		'bg-emerald-400 text-stone-800',
		'bg-violet-400 text-white',
		'bg-orange-400 text-stone-800'
	];

	function colorAvatar(valor: string) {
		let hash = 0;
		for (let i = 0; i < valor.length; i++)
			hash = (hash + valor.charCodeAt(i)) % AVATAR_COLORES.length;
		return AVATAR_COLORES[hash];
	}

	function iniciales(valor: string) {
		const letras = valor
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? '');
		return letras.join('') || '?';
	}
</script>

<div
	class="flex shrink-0 -rotate-3 items-center justify-center rounded-xl font-extrabold {colorAvatar(
		seed ?? nombre
	)} {className}"
>
	{iniciales(nombre)}
</div>
