(function () {
    'use strict';

    const form = document.getElementById('formLogin');
    const boton = document.getElementById('btnLogin');
    const mensaje = document.getElementById('mensaje');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        Panel.ocultar(mensaje);
        boton.disabled = true;

        try {
            // Se usa fetch directo (no Panel.api) porque un 401 aquí significa
            // "credenciales incorrectas", no "sesión vencida".
            const respuesta = await fetch('/api/auth/login', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: document.getElementById('username').value.trim(),
                    password: document.getElementById('password').value,
                }),
            });
            const datos = await respuesta.json().catch(() => ({}));

            if (respuesta.ok && datos.ok) {
                window.location.href = datos.debeCambiarPassword ? '/cuenta/password' : '/panel';
                return;
            }
            Panel.mostrar(mensaje, 'error', datos.mensaje || 'No se pudo iniciar sesión');
        } catch (_) {
            Panel.mostrar(mensaje, 'error', 'Error de conexión');
        } finally {
            boton.disabled = false;
        }
    });
})();