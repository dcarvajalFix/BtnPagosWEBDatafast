const { z } = require('zod');
const authService = require('./authService');
const userStore = require('./userStore');
const { ROLES, permisosDe } = require('./permisos');
const { auditar } = require('../../shared/eventos');

const loginSchema = z.object({
    username: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(200),
});

const cambiarPasswordSchema = z.object({
    passwordActual: z.string().min(1).max(200),
    passwordNueva: z.string().min(1).max(200),
});

function datosSesion(usuario) {
    return {
        username: usuario.username,
        rol: usuario.rol,
        rolEtiqueta: ROLES[usuario.rol] ? ROLES[usuario.rol].etiqueta : usuario.rol,
        permisos: permisosDe(usuario.rol),
        debeCambiarPassword: usuario.debeCambiarPassword,
    };
}

async function login(req, res, next) {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, mensaje: 'Usuario y contraseña son obligatorios' });
        }
        const { username, password } = parsed.data;

        const usuario = await authService.verificarCredenciales(username, password);
        if (!usuario) {
            // Mensaje genérico: no revela si el usuario existe, está inactivo o falló la clave.
            req.actor = { nombre: null };
            auditar(req, 'login_fallido', { usuarioIntentado: username.slice(0, 64) });
            return res.status(401).json({ ok: false, mensaje: 'Usuario o contraseña incorrectos' });
        }

        req.session.regenerate((err) => {
            if (err) return next(err);
            req.session.userId = usuario.id;
            req.session.save((errGuardar) => {
                if (errGuardar) return next(errGuardar);
                userStore.registrarLogin(usuario.id);
                req.actor = { nombre: usuario.username };
                auditar(req, 'login_ok');
                res.json({ ok: true, ...datosSesion(usuario) });
            });
        });
    } catch (error) {
        next(error);
    }
}

function logout(req, res) {
    const usuario = req.session && req.session.userId ? userStore.obtenerPorId(req.session.userId) : null;
    if (usuario) {
        req.actor = { nombre: usuario.username };
        auditar(req, 'logout');
    }
    req.session.destroy(() => {
        res.clearCookie('fixbtn.sid');
        res.json({ ok: true });
    });
}

function sesionActual(req, res) {
    res.json({ ok: true, ...datosSesion(req.usuario) });
}

async function cambiarPassword(req, res, next) {
    try {
        const parsed = cambiarPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, mensaje: 'Completa los campos de contraseña' });
        }
        const { passwordActual, passwordNueva } = parsed.data;

        const hashActual = userStore.obtenerHashPorId(req.usuario.id);
        if (!hashActual || !(await authService.comparar(passwordActual, hashActual))) {
            auditar(req, 'password_cambio_fallido');
            return res.status(400).json({ ok: false, mensaje: 'La contraseña actual no es correcta' });
        }

        const problema = authService.validarPassword(passwordNueva);
        if (problema) return res.status(400).json({ ok: false, mensaje: problema });

        if (passwordNueva === passwordActual) {
            return res.status(400).json({ ok: false, mensaje: 'La nueva contraseña debe ser distinta de la actual' });
        }

        userStore.establecerPassword(req.usuario.id, await authService.hashear(passwordNueva), false);
        auditar(req, 'password_cambiada');
        res.json({ ok: true, mensaje: 'Contraseña actualizada' });
    } catch (error) {
        next(error);
    }
}

module.exports = { login, logout, sesionActual, cambiarPassword };