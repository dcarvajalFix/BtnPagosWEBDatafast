/*
  Utilidades compartidas por las páginas del panel (sin librerías, sin
  innerHTML con datos del servidor: todo se construye con el DOM para evitar XSS).
*/
(function () {
    'use strict';

    function el(tag, props, ...hijos) {
        const nodo = document.createElement(tag);
        
        if (props) {
            for (const [clave, valor] of Object.entries(props)) {
                if (valor === null || valor === undefined || valor === false) continue;
                if (clave === 'class') nodo.className = valor;
                else if (clave === 'text') nodo.textContent = valor;
                else if (clave.startsWith('on') && typeof valor === 'function') nodo.addEventListener(clave.slice(2), valor);
                else nodo.setAttribute(clave, valor === true ? '' : valor);
            }
        }

        for (const hijo of hijos.flat()) {
            if (hijo === null || hijo === undefined || hijo === false) continue;
            nodo.appendChild(typeof hijo === 'string' ? document.createTextNode(hijo) : hijo);
        }
        return nodo;
    }

    /** fetch JSON con manejo común: 401 -> login, cambio de clave pendiente -> /cuenta/password. */
    async function api(url, opciones = {}) {
        const init = { method: opciones.method || 'GET', headers: {}, credentials: 'same-origin' };
        if (opciones.body !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(opciones.body);
        }

        let respuesta;
        try {
            respuesta = await fetch(url, init);
        } catch (_) {
            throw { mensaje: 'Error de conexión', estado: 0 };
        }

        let datos = {};
        try { datos = await respuesta.json(); } catch (_) { /* sin cuerpo JSON */ }

        if (respuesta.status === 401) {
            window.location.href = '/login';
            throw { mensaje: 'Sesión no válida', estado: 401 };
        }

        if (respuesta.status === 403 && datos.codigo === 'CAMBIAR_PASSWORD') {
            window.location.href = '/cuenta/password';
            throw { mensaje: 'Debes cambiar tu contraseña', estado: 403 };
        }

        if (!respuesta.ok || datos.ok === false) {
            let mensaje = datos.mensaje || 'No se pudo completar la acción';
            if (Array.isArray(datos.errores) && datos.errores.length) {
                mensaje += ': ' + datos.errores.map((e) => e.mensaje).join(', ');
            }
            throw { mensaje, estado: respuesta.status, datos };
        }
        return datos;
    }

    function formatearFecha(ms) {
        if (!ms) return '-';
        return new Date(ms).toLocaleString('es-EC', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    }

    function mostrar(nodo, tipo, texto) {
        nodo.textContent = texto;
        nodo.className = 'mensaje ' + tipo;
    }

    function ocultar(nodo) {
        nodo.className = 'mensaje oculto';
        nodo.textContent = '';
    }

    async function copiar(texto, boton) {
        const original = boton.textContent;
        try {
            await navigator.clipboard.writeText(texto);
            boton.textContent = 'Copiado';
        } catch (_) {
            boton.textContent = 'Selecciona y copia (Ctrl+C)';
        }
        setTimeout(() => { boton.textContent = original; }, 2000);
    }

    const ENLACES = [
        { href: '/panel', texto: 'Transacciones', permiso: 'transacciones:ver' },
        { href: '/panel/nuevo-link', texto: 'Generar link', permiso: 'link:crear' },
        { href: '/panel/usuarios', texto: 'Usuarios', permiso: 'usuarios:gestionar' },
        { href: '/panel/actividad', texto: 'Actividad', permiso: 'actividad:ver' },
        { href: '/cuenta/password', texto: 'Mi contraseña', permiso: 'cuenta:password' },
    ];

    function dibujarNavegacion(sesion) {
        const contenedor = document.getElementById('nav');
        if (!contenedor) return;
        contenedor.textContent = '';
        contenedor.className = 'nav';
        contenedor.appendChild(el('span', { class: 'marca', text: 'FixGroup · Pagos' }));

        if (!sesion.debeCambiarPassword) {
            for (const enlace of ENLACES) {
                if (!sesion.permisos.includes(enlace.permiso)) continue;
                const activo = window.location.pathname === enlace.href;
                contenedor.appendChild(el('a', { href: enlace.href, class: activo ? 'activo' : '', text: enlace.texto }));
            }
        }

        contenedor.appendChild(
            el('div', { class: 'derecha' },
                el('span', { text: sesion.username + ' (' + sesion.rolEtiqueta + ')' }),
                el('button', {
                    type: 'button',
                    text: 'Cerrar sesión',
                    onclick: async () => {
                        try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) { /* ignorar */ }
                        window.location.href = '/login';
                    },
                })
            )
        );
    }

    /**
     * Valida la sesión, dibuja la navegación y devuelve los datos de sesión.
     * opciones.permiso: si el usuario no lo tiene, vuelve a /panel.
     * opciones.permitirCambioPendiente: para la pantalla de cambio de contraseña.
     */
    async function iniciar(opciones = {}) {
        const sesion = await api('/api/auth/sesion');
        if (sesion.debeCambiarPassword && !opciones.permitirCambioPendiente) {
            window.location.href = '/cuenta/password';
            throw { mensaje: 'Debes cambiar tu contraseña' };
        }
        if (opciones.permiso && !sesion.permisos.includes(opciones.permiso)) {
            window.location.href = '/panel';
            throw { mensaje: 'Sin permiso' };
        }
        dibujarNavegacion(sesion);
        return sesion;
    }

        /* ------------------- Mostrar / ocultar contraseña (el "ojito") ------------------- */

    const SVG_NS = 'http://www.w3.org/2000/svg';

    function icono(visible) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        const rutas = visible
            ? ['M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94', 'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19', 'M1 1l22 22', 'M14.12 14.12a3 3 0 1 1-4.24-4.24']
            : ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'];
        for (const d of rutas) {
            const ruta = document.createElementNS(SVG_NS, 'path');
            ruta.setAttribute('d', d);
            svg.appendChild(ruta);
        }
        return svg;
    }

    /** Envuelve cada <input type="password"> y le agrega un botón para ver lo que se escribe. */
    function agregarOjitos() {
        document.querySelectorAll('input[type="password"]').forEach((input) => {
            if (input.dataset.conOjo) return;
            input.dataset.conOjo = '1';

            const envoltura = el('span', { class: 'campo-password' });
            input.parentNode.insertBefore(envoltura, input);
            envoltura.appendChild(input);

            const boton = el('button', { type: 'button', class: 'ojo', 'aria-label': 'Mostrar contraseña', title: 'Mostrar contraseña' });
            boton.appendChild(icono(false));
            boton.addEventListener('click', () => {
                const mostrando = input.type === 'text';
                input.type = mostrando ? 'password' : 'text';
                boton.textContent = '';
                boton.appendChild(icono(!mostrando));           
                const etiqueta = mostrando ? 'Mostrar contraseña' : 'Ocultar contraseña';
                boton.setAttribute('aria-label', etiqueta);
                boton.title = etiqueta;
                input.focus();
            });
                envoltura.appendChild(boton);
            });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', agregarOjitos);
    else agregarOjitos();

        /* ------------- Tablas -> tarjetas en el celular (CSS usa data-label) ------------- */

    function etiquetarTabla(tabla) {
        const titulos = Array.from(tabla.querySelectorAll('thead th')).map((th) => th.textContent.trim());
        const cuerpo = tabla.querySelector('tbody');
        if (!cuerpo) return;
        const aplicar = () => {
            cuerpo.querySelectorAll('tr').forEach((tr) => {
                Array.from(tr.children).forEach((td, i) => {
                    if (!td.hasAttribute('data-label')) td.setAttribute('data-label', titulos[i] || '');
                });
            });
        };
        aplicar();
        new MutationObserver(aplicar).observe(cuerpo, { childList: true });
    }

    function etiquetarTablas() {
        document.querySelectorAll('table').forEach(etiquetarTabla);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', etiquetarTablas);
    else etiquetarTablas();

    window.Panel = { el, api, iniciar, formatearFecha, mostrar, ocultar, copiar };
})();