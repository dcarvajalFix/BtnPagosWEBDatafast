/*
  MIDDLEWARE: exige sesión de admin activa
  -------------------------------------------
  Protege las rutas del panel (listar transacciones, etc.). No confundir
  con requireApiKey (core/middleware/apiKeyAuth.js) — esa es para
  integraciones programáticas (crear-link, anular); esta es para personas
  navegando el panel con usuario/contraseña.
*/

function requireSession(req, res, next) {
    if (!req.session || !req.session.usuario) {
        return res.status(401).json({ ok: false, mensaje: 'Sesión no válida. Inicia sesión de nuevo.' });
    }
    next();
}

module.exports = requireSession;