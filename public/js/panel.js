(function () {
    'use strict';

    const { el, api, formatearFecha } = Panel;
    let pagina = 1;

    const $ = (id) => document.getElementById(id);

    async function cargar() {
        $('cargando').classList.remove('oculto');
        $('tabla').classList.add('oculto');
        $('vacio').classList.add('oculto');
        $('paginacion').classList.add('oculto');

        const estado = $('filtroEstado').value;
        const params = new URLSearchParams({ pagina, porPagina: 25 });
        if (estado) params.set('estado', estado);

        try {
            const datos = await api('/api/admin/transacciones?' + params);
            $('cargando').classList.add('oculto');

            if (datos.ordenes.length === 0) {
                $('vacio').classList.remove('oculto');
                return;
            }

            const cuerpo = $('cuerpoTabla');
            cuerpo.textContent = '';
            for (const o of datos.ordenes) {
                cuerpo.appendChild(el('tr', null,
                    el('td', { text: formatearFecha(o.creadoEn) }),
                    el('td', { text: o.descripcion || '-' }),
                    el('td', { text: '$' + o.monto + ' ' + o.moneda }),
                    el('td', null, el('span', { class: 'badge badge-' + o.estado, text: o.estado })),
                    el('td', { text: o.creadoPor || '-' }),
                    el('td', null, el('code', { text: o.orderId }))
                ));
            }

            $('infoPagina').textContent = 'Página ' + datos.pagina + ' de ' + datos.totalPaginas + ' (' + datos.total + ' en total)';
            $('btnAnterior').disabled = datos.pagina <= 1;
            $('btnSiguiente').disabled = datos.pagina >= datos.totalPaginas;
            $('tabla').classList.remove('oculto');
            $('paginacion').classList.remove('oculto');
        } catch (err) {
            $('cargando').textContent = err.mensaje || 'Error al cargar transacciones.';
        }
    }

    $('filtroEstado').addEventListener('change', () => { pagina = 1; cargar(); });
    $('btnAnterior').addEventListener('click', () => { if (pagina > 1) { pagina -= 1; cargar(); } });
    $('btnSiguiente').addEventListener('click', () => { pagina += 1; cargar(); });

    Panel.iniciar({ permiso: 'transacciones:ver' }).then(cargar).catch(() => {});
})();