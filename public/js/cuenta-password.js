(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    $('formPassword').addEventListener('submit', async (e) => {
        e.preventDefault();
        Panel.ocultar($('mensaje'));

        if ($('passwordNueva').value !== $('passwordRepetir').value) {
            Panel.mostrar($('mensaje'), 'error', 'Las contraseñas nuevas no coinciden');
            return;
        }

        $('btnGuardar').disabled = true;
        try {
            await Panel.api('/api/auth/password', {
                method: 'POST',
                body: {
                    passwordActual: $('passwordActual').value,
                    passwordNueva: $('passwordNueva').value,
                },
            });
            Panel.mostrar($('mensaje'), 'ok', 'Contraseña actualizada. Redirigiendo...');
            setTimeout(() => { window.location.href = '/panel'; }, 1200);
        } catch (err) {
            if (err.estado !== 401) Panel.mostrar($('mensaje'), 'error', err.mensaje);
            $('btnGuardar').disabled = false;
        }
    });

    Panel.iniciar({ permitirCambioPendiente: true })
        .then((sesion) => {
            if (sesion.debeCambiarPassword) $('avisoObligatorio').classList.remove('oculto');
        })
        .catch(() => {});
})();