const { auditar } = require('../../shared/eventos');

/** Sesiones del usuario en sesión. */
function listarPropias(req, res) {
    const { sesiones } = req.app.locals.auth;
    res.json({ ok: true, sesiones: sesiones.listarDeUsuario(req.usuario.id, req.sessionID) });
}

function cerrarPropia(req, res) {
    const { sesiones } = req.app.locals.auth;
    if (sesiones.idPublico(req.sessionID) === req.params.id) {
        return res.status(400).json({ ok: false, mensaje: 'Esta es tu sesión actual. Usa "Cerrar sesión" para salir.' });
    }
    if (!sesiones.cerrar(req.usuario.id, req.params.id)) {
        return res.status(404).json({ ok: false, mensaje: 'Esa sesión ya no existe' });
    }
    auditar(req, 'sesion_cerrada', { usuario: req.usuario.username, por: 'el mismo usuario' });
    res.json({ ok: true });
}

function cerrarOtrasPropias(req, res) {
    const { sesiones } = req.app.locals.auth;
    const cantidad = sesiones.cerrarOtras(req.usuario.id, req.sessionID);
    auditar(req, 'sesiones_cerradas', { usuario: req.usuario.username, cantidad, por: 'el mismo usuario' });
    res.json({ ok: true, cantidad });
}

module.exports = { listarPropias, cerrarPropia, cerrarOtrasPropias };