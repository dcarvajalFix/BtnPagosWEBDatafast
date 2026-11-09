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
                cargar({ silencioso: true });
            },
        });
    }

    /** Enlace de pago para reenviarlo: solo mientras el cliente todavía pueda usarlo. */
    function celdaLink(o) {
        const vigente = ['pendiente', 'checkout_creado'].includes(o.estado) && o.expiraEn > Date.now();
        if (!vigente) return el('td', { text: o.estado === 'expirado' ? 'Vencido' : '-' });
        const url = window.location.origin + '/pagar/' + o.orderId;
        return el('td', { class: 'tabla-acciones' },
            el('button', { type: 'button', class: 'secundario', text: 'Copiar link', onclick: (e) => Panel.copiar(url, e.currentTarget) })
        );
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

    let cargando = false;
    let recarga = null;

    function horaActual() {
        return new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    /**
     * silencioso = actualización automática: no muestra "Cargando...", no
     * oculta la tabla y deja la pantalla como está (sin saltos).
     */
    async function cargar({ silencioso = false } = {}) {
        // Si ya hay una carga en curso, se encola una más para cuando termine
        // (así un cambio de filtro o un "Actualizar" nunca se pierde).
        if (cargando) {
            recarga = { silencioso: silencioso && (recarga ? recarga.silencioso : true) };
            return;
        }
        cargando = true;

        if (!silencioso) {
            $('cargando').classList.remove('oculto');
            $('tabla').classList.add('oculto');
            $('vacio').classList.add('oculto');
            $('paginacion').classList.add('oculto');
        }

        const estado = $('filtroEstado').value;
        const params = new URLSearchParams({ pagina, porPagina: 25 });
        if (estado) params.set('estado', estado);

        try {
            const datos = await api('/api/admin/transacciones?' + params);
            $('cargando').classList.add('oculto');
            $('ultimaActualizacion').textContent = 'Actualizado ' + horaActual();

            if (datos.ordenes.length === 0) {
                $('vacio').classList.remove('oculto');
                $('tabla').classList.add('oculto');
                $('paginacion').classList.add('oculto');
                return;
            }
            $('vacio').classList.add('oculto');

            const filas = datos.ordenes.map((o) => el('tr', null,
                el('td', { text: formatearFecha(o.creadoEn) }),
                el('td', { text: formatearFecha(o.expiraEn) }),
                el('td', { text: o.descripcion || '-' }),
                el('td', { text: '$' + o.monto + ' ' + o.moneda }),
                el('td', null, el('span', { class: 'badge badge-' + o.estado, text: o.estado })),
                el('td', { text: o.creadoPor || '-' }),
                el('td', null, el('code', { text: o.orderId })),
                celdaLink(o),
                celdaAnulacion(o)
            ));
            $('cuerpoTabla').replaceChildren(...filas);

            $('infoPagina').textContent = 'Página ' + datos.pagina + ' de ' + datos.totalPaginas + ' (' + datos.total + ' en total)';
            $('btnAnterior').disabled = datos.pagina <= 1;
            $('btnSiguiente').disabled = datos.pagina >= datos.totalPaginas;
            $('tabla').classList.remove('oculto');
            $('paginacion').classList.remove('oculto');
        } catch (err) {
            if (silencioso) $('ultimaActualizacion').textContent = 'Sin conexión, reintentando...';
            else $('cargando').textContent = err.mensaje || 'Error al cargar transacciones.';
        } finally {
            cargando = false;
            if (recarga) {
                const siguiente = recarga;
                recarga = null;
                cargar(siguiente);
            }
        }
    }

    /* ------------------------------ Actualización automática ------------------------------ */

    const INTERVALO_MS = 20000;
    let temporizador = null;

    function leerPreferencia() {
        try { return localStorage.getItem('panelAuto') !== '0'; } catch (_) { return true; }
    }

    function guardarPreferencia(valor) {
        try { localStorage.setItem('panelAuto', valor ? '1' : '0'); } catch (_) { /* sin almacenamiento */ }
    }

    function tick() {
        // No se refresca si la pestaña está oculta o hay un diálogo abierto (para no pisar lo que se está haciendo).
        if (document.hidden || dialogo.open) return;
        cargar({ silencioso: true });
    }

    function aplicarAuto() {
        clearInterval(temporizador);
        temporizador = $('chkAuto').checked ? setInterval(tick, INTERVALO_MS) : null;
    }

    $('chkAuto').checked = leerPreferencia();
    $('chkAuto').addEventListener('change', () => { guardarPreferencia($('chkAuto').checked); aplicarAuto(); });
    $('btnActualizar').addEventListener('click', () => cargar({ silencioso: true }));
    // Al volver a la pestaña se actualiza enseguida.
    document.addEventListener('visibilitychange', () => { if (!document.hidden && $('chkAuto').checked) tick(); });

    $('filtroEstado').addEventListener('change', () => { pagina = 1; cargar(); });
    $('btnAnterior').addEventListener('click', () => { if (pagina > 1) { pagina -= 1; cargar(); } });
    $('btnSiguiente').addEventListener('click', () => { pagina += 1; cargar(); });

    Panel.iniciar({ permiso: 'transacciones:ver' })
        .then((sesion) => { puedeAnular = sesion.permisos.includes('pago:anular'); aplicarAuto(); return cargar(); })
        .catch(() => {});
})();