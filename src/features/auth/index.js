/*
  MÓDULO: auth
  -------------
  Sesiones, usuarios, roles y permisos. Publica en app.locals.auth la
  interfaz que usan los demás módulos (middlewares y consultas), de modo que
  ninguno necesita importar archivos internos de este módulo.
*/

const session = require('express-session');
const config = require('../../core/config/env');
const authService = require('./authService');
const userStore = require('./userStore');
const permisos = require('./permisos');
const middleware = require('./middleware');
const authRoutes = require('./authRoutes');
const { SqliteSessionStore } = require('./sessionStore');

function montar(app) {
    /*
      Cookie httpOnly (no accesible por JS), 'secure' en producción (solo
      HTTPS) y sameSite 'lax' (mitiga CSRF). Las sesiones se guardan en
      SQLite (no en memoria): sobreviven a reinicios y despliegues, y se
      pueden listar y cerrar desde el panel.
    */
    const sesiones = new SqliteSessionStore({ ttlMs: 8 * 60 * 60 * 1000 });

    app.use(
        session({
            name: 'fixbtn.sid',
            store: sesiones,
            secret: config.sessionSecret,
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                secure: config.isProduction,
                sameSite: 'lax',
                maxAge: 8 * 60 * 60 * 1000,
            },
        })
    );

    authService.sembrarAdminInicial().catch((err) => console.error('[auth] no se pudo sembrar el admin:', err.message));

    app.locals.auth = {
        requireSession: middleware.requireSession,
        requirePermiso: middleware.requirePermiso,
        sesionOApiKey: middleware.sesionOApiKey,
        paginaProtegida: middleware.paginaProtegida,
        identificar: middleware.identificar,
        usuarios: userStore,
        sesiones,
        servicio: authService,
        permisos,
    };

    app.use('/api/auth', authRoutes);
}

module.exports = { montar };