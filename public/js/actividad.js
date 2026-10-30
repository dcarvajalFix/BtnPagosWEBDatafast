(function () {
    'use strict';

    const { el, api, formatearFecha } = Panel;
    const $ = (id) => document.getElementById(id);
    let pagina = 1;

    const ACCIONES = {
        login_ok: 'Inicio de sesión',
        login_fallido: 'Intento de acceso fallido',
        logout: 'Cierre de sesión',
        password_cambiada: 'Cambió su contraseña',
        password_cambio_fallido: 'Cambio de contraseña fallido',
        password_reseteada: 'Contraseña reseteada',
        usuario_creado: 'Usuario creado',
        usuario_rol: 'Cambio de rol',
        usuario_activado: 'Usuario activado',
        usuario_desactivado: 'Usuario desactivado',
        link_creado: 'Link de pago generado',
        pago_anulado: 'Pago anulado',
    };

    function resumirDetalle(d) {
        if (!d) return '-';
        return Object.entries(d).map(([k, v]) => k + ': ' + v).join(' · ');
    }

    async function cargar() {
        $('cargando').classList.remove('oculto');
        $('tabla').classList.add('oculto');
        $('vacio').classList.add('oculto');
        $('paginacion').classList.add('oculto');

        try {
            const datos = await api('/api/admin/actividad?pagina=' + pagina);
            $('cargando').classList.add('oculto');

            if (datos.eventos.length === 0) {
                $('vacio').classList.remove('oculto');
                return;
            }

            const cuerpo = $('cuerpoTabla');
            cuerpo.textContent = '';
            for (const ev of datos.eventos) {
                cuerpo.appendChild(el('tr', null,
                    el('td', { text: formatearFecha(ev.fecha) }),
                    el('td', { text: ev.actor || '-' }),
                    el('td', { text: ACCIONES[ev.accion] || ev.accion }),
                    el('td', { text: resumirDetalle(ev.detalle) }),
                    el('td', { text: ev.ip || '-' })
                ));
            }

            $('infoPagina').textContent = 'Página ' + datos.pagina + ' de ' + datos.totalPaginas;
            $('btnAnterior').disabled = datos.pagina <= 1;
            $('btnSiguiente').disabled = datos.pagina >= datos.totalPaginas;
            $('tabla').classList.remove('oculto');
            $('paginacion').classList.remove('oculto');
        } catch (err) {
            $('cargando').textContent = err.mensaje || 'Error al cargar la actividad.';
        }
    }

    $('btnAnterior').addEventListener('click', () => { if (pagina > 1) { pagina -= 1; cargar(); } });
    $('btnSiguiente').addEventListener('click', () => { pagina += 1; cargar(); });

    Panel.iniciar({ permiso: 'actividad:ver' }).then(cargar).catch(() => {});
})();