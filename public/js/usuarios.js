(function () {
    'use strict';

    const { el, api, formatearFecha } = Panel;
    const $ = (id) => document.getElementById(id);

    let CATALOGO = null; // { roles: { admin: {...}, empleado: {...} }, permisos }
    let YO = null;       // id del usuario en sesión

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
        dialogo.showModal();
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

    /** Muestra una contraseña temporal UNA vez, con botón de copiar. */
    function mostrarClaveTemporal(titulo, usuario, clave) {
        const botonCopiar = el('button', { type: 'button', class: 'secundario', text: 'Copiar contraseña' });
        botonCopiar.addEventListener('click', () => Panel.copiar(clave, botonCopiar));

        abrirDialogo({
            titulo,
            soloCerrar: true,
            cuerpo: el('div', null,
                el('p', { text: 'Usuario: ' + usuario }),
                el('div', { class: 'clave-temporal', text: clave }),
                botonCopiar,
                el('div', { class: 'aviso-clave', text: 'Guárdala ahora: no se vuelve a mostrar. La persona deberá cambiarla al iniciar sesión.' })
            ),
        });
    }

    /* ------------------------------ Lista de usuarios ------------------------------ */

    function botonAccion(texto, clase, onclick, deshabilitado, titulo) {
        return el('button', { type: 'button', class: clase, text: texto, onclick, disabled: deshabilitado, title: titulo });
    }

    function filaUsuario(u) {
        const esYo = u.id === YO;
        const etiquetaRol = CATALOGO.roles[u.rol] ? CATALOGO.roles[u.rol].etiqueta : u.rol;
        const motivoYo = esYo ? 'No puedes aplicarte esta acción a ti mismo' : '';

        const estado = [el('span', { class: 'badge ' + (u.activo ? 'badge-activo' : 'badge-inactivo'), text: u.activo ? 'Activo' : 'Inactivo' })];
        if (u.debeCambiarPassword) {
            estado.push(' ', el('span', { class: 'badge badge-pendiente-pass', text: 'Cambio de clave pendiente' }));
        }

        return el('tr', null,
            el('td', { text: u.username + (esYo ? ' (tú)' : '') }),
            el('td', null, el('span', { class: 'badge badge-' + u.rol, text: etiquetaRol })),
            el('td', null, estado),
            el('td', { text: formatearFecha(u.ultimoLoginEn) }),
            el('td', { text: u.creadoPor || '-' }),
            el('td', { class: 'acciones' },
                botonAccion('Cambiar rol', 'secundario', () => dialogoCambiarRol(u), esYo, motivoYo),
                botonAccion('Resetear contraseña', 'secundario', () => dialogoResetear(u), esYo, motivoYo),
                u.activo
                    ? botonAccion('Desactivar', 'peligro', () => dialogoActivo(u, false), esYo, motivoYo)
                    : botonAccion('Activar', 'secundario', () => dialogoActivo(u, true), false, '')
            )
        );
    }

    async function cargarUsuarios() {
        try {
            const datos = await api('/api/usuarios');
            YO = datos.yo;

            const cuerpo = $('cuerpoTabla');
            cuerpo.textContent = '';
            datos.usuarios.forEach((u) => cuerpo.appendChild(filaUsuario(u)));

            $('cargando').classList.add('oculto');
            $('tabla').classList.remove('oculto');
        } catch (err) {
            $('cargando').textContent = err.mensaje || 'Error al cargar usuarios.';
        }
    }

    /* ------------------------------ Cambiar rol ------------------------------ */

    function dialogoCambiarRol(usuario) {
        const select = el('select', { id: 'selectRol' },
            Object.entries(CATALOGO.roles).map(([clave, rol]) =>
                el('option', { value: clave, text: rol.etiqueta, selected: clave === usuario.rol })
            )
        );
        const vistaPrevia = el('div');

        function pintarPrevia() {
            const nuevo = select.value;
            const actuales = new Set(CATALOGO.roles[usuario.rol].permisos.map((p) => p.clave));
            const futuros = new Set(CATALOGO.roles[nuevo].permisos.map((p) => p.clave));

            vistaPrevia.textContent = '';
            if (nuevo === usuario.rol) {
                vistaPrevia.appendChild(el('p', { class: 'ayuda', text: 'Elige un rol distinto para ver los cambios.' }));
                $('dlgConfirmar').disabled = true;
                return;
            }
            $('dlgConfirmar').disabled = false;

            vistaPrevia.appendChild(el('p', { text: CATALOGO.roles[nuevo].descripcion }));
            vistaPrevia.appendChild(el('p', { class: 'ayuda', text: 'Con el rol ' + CATALOGO.roles[nuevo].etiqueta + ' podrá:' }));

            const lista = el('ul', { class: 'lista-permisos' });
            for (const p of CATALOGO.roles[nuevo].permisos) {
                const esNuevo = !actuales.has(p.clave);
                lista.appendChild(el('li', { class: esNuevo ? 'nuevo' : '', text: (esNuevo ? '+ Nuevo: ' : '✓ ') + p.etiqueta }));
            }
            for (const p of CATALOGO.roles[usuario.rol].permisos) {
                if (!futuros.has(p.clave)) {
                    lista.appendChild(el('li', { class: 'perdido', text: 'Perderá: ' + p.etiqueta }));
                }
            }
            vistaPrevia.appendChild(lista);
        }

        select.addEventListener('change', pintarPrevia);

        abrirDialogo({
            titulo: 'Cambiar rol de ' + usuario.username,
            textoConfirmar: 'Confirmar cambio de rol',
            cuerpo: el('div', null,
                el('div', { class: 'campo' }, el('label', { for: 'selectRol', text: 'Rol nuevo' }), select),
                vistaPrevia
            ),
            onConfirmar: async () => {
                await api('/api/usuarios/' + usuario.id + '/rol', {
                    method: 'PATCH',
                    body: { rol: select.value, confirmar: true },
                });
                dialogo.close();
                Panel.mostrar($('mensaje'), 'ok', 'Rol de ' + usuario.username + ' actualizado.');
                await cargarUsuarios();
            },
        });
        pintarPrevia();
    }

    /* ------------------------------ Resetear contraseña ------------------------------ */

    function dialogoResetear(usuario) {
        abrirDialogo({
            titulo: 'Resetear contraseña de ' + usuario.username,
            textoConfirmar: 'Generar contraseña temporal',
            cuerpo: el('p', { text: 'Se generará una contraseña temporal. La persona deberá cambiarla al volver a iniciar sesión.' }),
            onConfirmar: async () => {
                const datos = await api('/api/usuarios/' + usuario.id + '/reset-password', { method: 'POST', body: {} });
                dialogo.close();
                mostrarClaveTemporal('Contraseña temporal generada', datos.usuario, datos.passwordTemporal);
                await cargarUsuarios();
            },
        });
    }

    /* ------------------------------ Activar / desactivar ------------------------------ */

    function dialogoActivo(usuario, activar) {
        abrirDialogo({
            titulo: (activar ? 'Activar a ' : 'Desactivar a ') + usuario.username,
            textoConfirmar: activar ? 'Activar' : 'Desactivar',
            peligro: !activar,
            cuerpo: el('p', {
                text: activar
                    ? 'La persona podrá volver a iniciar sesión.'
                    : 'La persona no podrá iniciar sesión y perderá el acceso de inmediato. Sus registros anteriores se conservan.',
            }),
            onConfirmar: async () => {
                await api('/api/usuarios/' + usuario.id + '/activo', { method: 'PATCH', body: { activo: activar } });
                dialogo.close();
                Panel.mostrar($('mensaje'), 'ok', 'Usuario ' + usuario.username + (activar ? ' activado.' : ' desactivado.'));
                await cargarUsuarios();
            },
        });
    }

    /* ------------------------------ Crear usuario ------------------------------ */

    $('formCrear').addEventListener('submit', async (e) => {
        e.preventDefault();
        Panel.ocultar($('mensajeCrear'));
        const username = $('nuevoUsuario').value.trim();

        try {
            const datos = await api('/api/usuarios', { method: 'POST', body: { username } });
            $('nuevoUsuario').value = '';
            mostrarClaveTemporal('Usuario creado', datos.usuario.username, datos.passwordTemporal);
            await cargarUsuarios();
        } catch (err) {
            if (err.estado !== 401) Panel.mostrar($('mensajeCrear'), 'error', err.mensaje);
        }
    });

    /* ------------------------------ Arranque ------------------------------ */

    Panel.iniciar({ permiso: 'usuarios:gestionar' })
        .then(async () => {
            const datos = await api('/api/usuarios/roles');
            CATALOGO = { roles: datos.roles, permisos: datos.permisos };
            await cargarUsuarios();
        })
        .catch(() => {});
})();