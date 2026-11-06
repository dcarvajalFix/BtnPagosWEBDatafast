(function () {
    'use strict';

    const { el, api, formatearFecha } = Panel;
    let pagina = 1;
    let puedeAnular = false;

    const $ = (id) => document.getElementById(id);

    /* ------------------------------ Diálogo genérico ------------------------------ */

    const dialogo = $('dialogo');
    let alConfirmar = null;

    function abrirDialogo({ titulo, cuerpo, textoConfirmar, soloCerrar, peligro, onConfirmar }) {
        $('dlgTitulo').textContent = titulo;
        $('dlgCuerpo').textContent = '';
        $('dlgCuerpo').appendChild(cuerpo);
        Panel.ocultar($('dlgError'));

        const confirmar = $('dlgConfirmar');
        confirmar.textContent = textoConfirmar || 'Confirmar';
        confirmar.className = peligro ? 'peligro' : 'primario';
        confirmar.disabled = false;
        $('dlgCancelar').textContent = soloCerrar ? 'Cerrar' : 'Cancelar';
        confirmar.classList.toggle('oculto', !!soloCerrar);

        alConfirmar = onConfirmar || null;
        if (!dialogo.open) dialogo.showModal();
    }

    $('dlgCancelar').addEventListener('click', () => dialogo.close());

    $('dlgConfirmar').addEventListener('click', async () => {
        if (!alConfirmar) return;
        const boton = $('dlgConfirmar');
        boton.disabled = true;
        Panel.ocultar($('dlgError'));
        try {
            await alConfirmar();
        } catch (err) {
            if (err.estado !== 401) Panel.mostrar($('dlgError'), 'error', err.mensaje || 'No se pudo completar la acción');
            boton.disabled = false;
        }
    });

    /* ------------------------------ Anulación ------------------------------ */

    function dialogoAnular(orden) {
        abrirDialogo({
            titulo: 'Anular pago',
            peligro: true,
            textoConfirmar: 'Anular pago',
            cuerpo: el('div', null,
                el('p', { text: 'Descripción: ' + (orden.descripcion || '-') }),
                el('p', { text: 'Monto: $' + orden.monto + ' ' + orden.moneda }),
                el('div', { class: 'aviso-clave', text: 'Se anulará el monto completo en Datafast y el cargo se revertirá en la tarjeta del cliente. Esta acción no se puede deshacer.' })
            ),
            onConfirmar: async () => {
                const r = await api('/api/payment/anular', { method: 'POST', body: { orderId: orden.orderId } });
                abrirDialogo({
                    titulo: 'Pago anulado',
                    soloCerrar: true,
                    cuerpo: el('div', null,
                        el('p', { text: 'La anulación fue aprobada por Datafast.' }),
                        el('p', null, el('strong', { text: 'Referencia: ' }), el('code', { text: r.referencia || '-' })),
                        el('p', null, el('strong', { text: 'Autorización: ' }), el('code', { text: r.autorizacion || '-' })),
                        el('div', { class: 'aviso-clave', text: 'Estos datos también quedan en la tabla de transacciones (columna Anulación).' })
                    ),
                });
                cargar();
            },
        });
    }

    function celdaAnulacion(o) {
        if (o.estado === 'anulado') {
            return el('td', null, el('div', { class: 'detalle-anulacion' },
                el('div', { text: 'Ref: ' + (o.anulacionReferencia || '-') }),
                el('div', { text: 'Aut: ' + (o.anulacionAutorizacion || '-') }),
                el('div', { text: formatearFecha(o.anuladoEn) + (o.anuladoPor ? ' · ' + o.anuladoPor : '') })
            ));
        }
        if (o.estado === 'anulando') {
            return el('td', null, el('div', {
                class: 'detalle-anulacion',
                text: 'En curso o sin confirmar. Verifica en Datafast antes de reintentar.',
            }));
        }
        if (o.estado === 'pagado' && puedeAnular) {
            return el('td', { class: 'tabla-acciones' },
                el('button', { type: 'button', class: 'peligro', text: 'Anular', onclick: () => dialogoAnular(o) })
            );
        }
        return el('td', { text: '-' });
    }

    /* ------------------------------ Tabla ------------------------------ */

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
                    el('td', { text: formatearFecha(o.expiraEn) }),
                    el('td', { text: o.descripcion || '-' }),
                    el('td', { text: '$' + o.monto + ' ' + o.moneda }),
                    el('td', null, el('span', { class: 'badge badge-' + o.estado, text: o.estado })),
                    el('td', { text: o.creadoPor || '-' }),
                    el('td', null, el('code', { text: o.orderId })),
                    celdaAnulacion(o)
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

    Panel.iniciar({ permiso: 'transacciones:ver' })
        .then((sesion) => { puedeAnular = sesion.permisos.includes('pago:anular'); return cargar(); })
        .catch(() => {});
})();