(function () {
    'use strict';

    /*
      Página de inicio: si ya hay una sesión abierta en este navegador, en vez de
      mostrar el formulario se ofrece ir al panel o cerrar la sesión y entrar con
      otro usuario. (Las ventanas de incógnito de un mismo navegador comparten
      cookies, así que sin esto parecería que "el login no aparece".)
    */
    const tarjeta = document.getElementById('acceso');
    if (!tarjeta) return;

    fetch('/api/auth/sesion', { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : null))
        .then((sesion) => {
            if (!sesion || !sesion.ok) return;
            const { el } = Panel;
            const destino = sesion.debeCambiarPassword ? '/cuenta/password' : '/panel';
            tarjeta.textContent = '';
            tarjeta.appendChild(el('h2', { text: 'Sesión iniciada' }));
            tarjeta.appendChild(el('p', { text: 'Ingresaste como ' + sesion.username + ' (' + sesion.rolEtiqueta + ').' }));
            tarjeta.appendChild(el('p', { style: 'margin-top:14px' },
                el('a', { href: destino, class: 'boton-primario', text: 'Ir al panel' })));
            tarjeta.appendChild(el('p', { style: 'margin-top:12px' },
                el('button', {
                    type: 'button',
                    class: 'enlace-boton',
                    text: 'Cerrar sesión e ingresar con otro usuario',
                    onclick: async () => {
                        try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) { /* ignorar */ }
                        window.location.reload();
                    },
                })));
        })
        .catch(() => { /* sin sesión o sin red: se deja el formulario */ });
})();