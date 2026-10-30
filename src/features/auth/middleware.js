/*
  MIDDLEWARES DE AUTENTICACIÓN / AUTORIZACIÓN
  ---------------------------------------------
  La sesión guarda SOLO el id del usuario. En cada petición se vuelve a
  leer el usuario desde la base de datos: así, si un administrador desactiva
  a alguien o le cambia el rol, el efecto es inmediato (no hay que esperar
  a que expire su sesión).
*/

const crypto = require('crypto');
const config = require('../../core/config/env');
const userStore = require('./userStore');
const { tienePermiso } = require('./permisos');

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

function identificar(req) {
    const id = req.session && req.session.userId;
    if (!id) return null;
    const usuario = userStore.obtenerPorId(id);
    return usuario && usuario.activo ? usuario : null;
}

/**
 * Defensa extra contra CSRF (además de sameSite=lax): en peticiones que
 * modifican datos, si el navegador manda Origin debe ser nuestro propio host.
 */
function origenValido(req) {
    if (METODOS_SEGUROS.has(req.method)) return true;
    const origen = req.get('origin');
    if (!origen) return true;
    try {
        return new URL(origen).host === req.get('host');
    } catch (_) {
        return false;
    }
}

function exigirSesion({ permitirCambioPendiente }) {
    return (req, res, next) => {
        const usuario = identificar(req);
        if (!usuario) {
            return res.status(401).json({ ok: false, mensaje: 'Sesión no válida. Inicia sesión de nuevo.' });
        }
        if (!origenValido(req)) {
            return res.status(403).json({ ok: false, mensaje: 'Origen no permitido' });
        }
        if (usuario.debeCambiarPassword && !permitirCambioPendiente) {
            return res.status(403).json({
                ok: false,
                codigo: 'CAMBIAR_PASSWORD',
                mensaje: 'Debes cambiar tu contraseña antes de continuar',
            });
        }

        req.usuario = usuario;
        req.actor = { tipo: 'usuario', nombre: usuario.username, rol: usuario.rol };
        next();
    };
}

/** Sesión válida y sin cambio de contraseña pendiente. */
const requireSession = exigirSesion({ permitirCambioPendiente: false });

/** Sesión válida aunque deba cambiar la contraseña (para /sesion y /password). */
const requireSessionSinCambio = exigirSesion({ permitirCambioPendiente: true });

function requirePermiso(permiso) {
    return (req, res, next) => {
        requireSession(req, res, (err) => {
            if (err) return next(err);
            if (!tienePermiso(req.usuario.rol, permiso)) {
                return res.status(403).json({ ok: false, mensaje: 'No tienes permiso para esta acción' });
            }
            next();
        });
    };
}

function apiKeyValida(key) {
    if (typeof key !== 'string' || !key) return false;
    const a = Buffer.from(key);
    const b = Buffer.from(config.adminApiKey);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Autoriza por API key (integraciones) O por sesión con el permiso dado.
 * Si el cliente manda x-api-key, solo se evalúa la key (no cae a sesión).
 */
function sesionOApiKey(permiso) {
    const porSesion = requirePermiso(permiso);
    return (req, res, next) => {
        if (req.header('x-api-key') !== undefined) {
            if (!apiKeyValida(req.header('x-api-key'))) {
                return res.status(401).json({ ok: false, mensaje: 'No autorizado' });
            }
            req.actor = { tipo: 'api', nombre: 'api-key', rol: null };
            return next();
        }
        porSesion(req, res, next);
    };
}

/**
 * Para páginas HTML: redirige en vez de responder JSON.
 *  - sin sesión            -> /login
 *  - debe cambiar password -> /cuenta/password
 *  - sin el permiso pedido -> /panel
 */
function paginaProtegida({ permiso, permitirCambioPendiente = false } = {}) {
    return (req, res, next) => {
        const usuario = identificar(req);
        if (!usuario) return res.redirect('/login');

        if (usuario.debeCambiarPassword && !permitirCambioPendiente) {
            return res.redirect('/cuenta/password');
        }
        if (permiso && !tienePermiso(usuario.rol, permiso)) {
            return res.redirect('/panel');
        }

        res.set('Cache-Control', 'no-store');
        req.usuario = usuario;
        next();
    };
}

module.exports = {
    identificar,
    requireSession,
    requireSessionSinCambio,
    requirePermiso,
    sesionOApiKey,
    paginaProtegida,
};