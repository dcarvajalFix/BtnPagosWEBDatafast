const authService = require('./authService');
const orderStore = require('../payment-link/orderStore');

function login(req, res) {
    const { username, password } = req.body;

    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
        return res.status(400).json({ ok: false, mensaje: 'Usuario y contraseña son obligatorios' });
    }

    const usuario = authService.verificarCredenciales(username, password);
    if (!usuario) {
        // Mensaje genérico a propósito: no reveles si fue el usuario o la
        // contraseña lo que falló (evita enumerar usuarios válidos).
        return res.status(401).json({ ok: false, mensaje: 'Usuario o contraseña incorrectos' });
    }

    req.session.regenerate((err) => {
        if (err) return res.status(500).json({ ok: false, mensaje: 'Error al iniciar sesión' });
        req.session.usuario = usuario;
        res.json({ ok: true, usuario: usuario.username });
    });
}

function logout(req, res) {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ ok: true });
    });
}

function sesionActual(req, res) {
    if (!req.session || !req.session.usuario) {
        return res.status(401).json({ ok: false });
    }
    res.json({ ok: true, usuario: req.session.usuario.username });
}

function listarTransacciones(req, res) {
    const estado = typeof req.query.estado === 'string' ? req.query.estado : undefined;
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const porPagina = Math.min(100, Math.max(1, parseInt(req.query.porPagina, 10) || 25));

    const estadosValidos = ['pendiente', 'checkout_creado', 'pagado', 'rechazado', 'expirado'];
    if (estado && !estadosValidos.includes(estado)) {
        return res.status(400).json({ ok: false, mensaje: 'Estado inválido' });
    }

    const resultado = orderStore.listarOrdenes({ estado, pagina, porPagina });
    res.json({ ok: true, ...resultado });
}

module.exports = { login, logout, sesionActual, listarTransacciones };