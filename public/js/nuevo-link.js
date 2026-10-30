(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    $('formLink').addEventListener('submit', async (e) => {
        e.preventDefault();
        Panel.ocultar($('mensaje'));
        $('resultado').classList.add('oculto');
        $('btnGenerar').disabled = true;

        try {
            // Sin API key: la autorización es la sesión del usuario.
            const datos = await Panel.api('/api/payment/crear-link', {
                method: 'POST',
                body: { monto: $('monto').value, descripcion: $('descripcion').value },
            });

            $('textoExpira').textContent = 'Link generado. Expira: ' + new Date(datos.expiraEn).toLocaleString('es-EC');
            $('linkGenerado').value = datos.link;
            $('btnAbrir').href = datos.link;
            $('resultado').classList.remove('oculto');
            $('linkGenerado').select();
        } catch (err) {
            if (err.estado !== 401) Panel.mostrar($('mensaje'), 'error', err.mensaje);
        } finally {
            $('btnGenerar').disabled = false;
        }
    });

    $('btnCopiar').addEventListener('click', (e) => Panel.copiar($('linkGenerado').value, e.currentTarget));

    Panel.iniciar({ permiso: 'link:crear' }).catch(() => {});
})();