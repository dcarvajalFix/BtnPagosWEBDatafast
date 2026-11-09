(function () {
    'use strict';

    const { el, api, formatearFecha } = Panel;
    const $ = (id) => document.getElementById(id);

    async function cerrar(sesion) {
        Panel.ocultar($('mensaje'));
        try {
            await api('/api/auth/sesiones/' + sesion.id, { method: 'DELETE' });
            Panel.mostrar($('mensaje'), 'ok', 'Sesión cerrada.');
            await cargar();
        } catch (err) {
            if (err.estado !== 401) Panel.mostrar($('mensaje'), 'error', err.mensaje);
        }
    }

    async function cargar() {
        try {
            const datos = await api('/api/auth/sesiones');
            const filas = datos.sesiones.map((s) => el('tr', null,
                el('td', null,
                    s.navegador,
                    s.actual ? [' ', el('span', { class: 'badge badge-activo', text: 'Esta sesión' })] : null
                ),
                el('td', null, el('code', { text: s.ip })),
                el('td', { text: formatearFecha(s.creadoEn) }),
                el('td', { text: formatearFecha(s.ultimoUso) }),
                s.actual
                    ? el('td', { text: '-' })
                    : el('td', { class: 'tabla-acciones' }, el('button', { type: 'button', class: 'peligro', text: 'Cerrar', onclick: () => cerrar(s) }))
            ));
            $('cuerpoTabla').replaceChildren(...filas);
            $('btnCerrarOtras').disabled = datos.sesiones.filter((s) => !s.actual).length === 0;
            $('cargando').classList.add('oculto');
            $('tabla').classList.remove('oculto');
        } catch (err) {
            $('cargando').textContent = err.mensaje || 'Error al cargar las sesiones.';
        }
    }

    $('btnCerrarOtras').addEventListener('click', async () => {
        Panel.ocultar($('mensaje'));
        $('btnCerrarOtras').disabled = true;
        try {
            const r = await api('/api/auth/sesiones/cerrar-otras', { method: 'POST', body: {} });
            Panel.mostrar($('mensaje'), 'ok', r.cantidad === 1 ? 'Se cerró 1 sesión.' : 'Se cerraron ' + r.cantidad + ' sesiones.');
            await cargar();
        } catch (err) {
            if (err.estado !== 401) Panel.mostrar($('mensaje'), 'error', err.mensaje);
            $('btnCerrarOtras').disabled = false;
        }
    });

    Panel.iniciar({ permiso: 'cuenta:sesiones' }).then(cargar).catch(() => {});
})();