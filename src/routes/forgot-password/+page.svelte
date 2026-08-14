<script lang="ts">
	import { Store, ArrowLeft, MailWarning } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Recuperar contraseña</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center gap-12 bg-stone-800 px-4 py-12">
	<div class="flex items-center gap-3">
		<div class="flex size-8 items-center justify-center rounded-[10px] bg-yellow-400">
			<Store size={18} class="text-stone-800" strokeWidth={2.5} />
		</div>
		<span class="text-xl font-extrabold tracking-tight text-stone-50">La tiendita</span>
	</div>

	<div class="flex w-full max-w-sm flex-col gap-6 rounded-3xl bg-stone-50 px-6 py-12 shadow-xl">
		<div class="flex flex-col items-center gap-3 text-center">
			<div class="flex size-12 items-center justify-center rounded-full bg-yellow-100">
				<MailWarning size={22} class="text-yellow-600" strokeWidth={2.5} />
			</div>
			<h1 class="title">No disponible por ahora</h1>
			<p class="text-sm text-stone-400">
				La recuperación de contraseña por correo todavía no está activa en esta tienda. Contacta a
				tu administrador para restablecerla.
			</p>
		</div>

		<div class="flex justify-center">
			<a href="/" class="link text-sm">
				<ArrowLeft size={14} strokeWidth={3} />
				Volver a iniciar sesión
			</a>
		</div>
	</div>

	<p class="text-sm text-stone-500">© 2026 Redstone Technologies</p>
</div>

<!--
	TODO: cuando haya un dominio verificado, conectar Resend aquí (o un plugin de
	better-auth) para enviar un correo con un enlace de restablecimiento firmado.
	Necesita: RESEND_API_KEY como secret y un dominio remitente verificado en Resend.
-->
