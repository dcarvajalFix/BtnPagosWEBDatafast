/*
  MÓDULO: admin-panel
  --------------------
  Páginas internas (login, transacciones, generar link, usuarios, actividad,
  cambio de contraseña) y la API de consulta. Las páginas HTML NO están en
  /public: viven en ./views y solo se entregan si hay sesión válida.
*/

const path = require('path');
const express = require('express');
const controller = require('./adminPanelController');
const { limiteInterno } = require('../../core/middleware/rateLimit');

const VISTAS = path.join(__dirname, 'views');

function montar(app) {
    const auth = app.locals.auth;
    if (!auth) throw new Error('El módulo auth no está disponible');

    const enviar = (archivo) => (req, res) => res.sendFile(path.join(VISTAS, archivo));

    // --- Páginas ---
    app.get('/login', (req, res) => {
        if (auth.identificar(req)) return res.redirect('/panel');
        res.set('Cache-Control', 'no-store');
        res.sendFile(path.join(VISTAS, 'login.html'));
    });
    app.get('/panel', auth.paginaProtegida({ permiso: 'transacciones:ver' }), enviar('panel.html'));
    app.get('/panel/nuevo-link', auth.paginaProtegida({ permiso: 'link:crear' }), enviar('nuevo-link.html'));
    app.get('/panel/usuarios', auth.paginaProtegida({ permiso: 'usuarios:gestionar' }), enviar('usuarios.html'));
    app.get('/panel/actividad', auth.paginaProtegida({ permiso: 'actividad:ver' }), enviar('actividad.html'));
    app.get('/cuenta/password', auth.paginaProtegida({ permitirCambioPendiente: true }), enviar('cuenta-password.html'));

    // La URL antigua del generador ya no existe como archivo público.
    app.get('/admin.html', (req, res) => res.redirect(301, '/panel/nuevo-link'));

    // --- API ---
    const api = express.Router();
    api.get('/transacciones', limiteInterno, auth.requirePermiso('transacciones:ver'), controller.listarTransacciones);

    if (app.locals.audit) {
        api.get('/actividad', limiteInterno, auth.requirePermiso('actividad:ver'), controller.listarActividad);
    }

    app.use('/api/admin', api);
}

module.exports = { montar };