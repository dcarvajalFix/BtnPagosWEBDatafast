const ESTADOS_VALIDOS = ['pendiente', 'checkout_creado', 'pagado', 'rechazado', 'expirado'];

function listarTransacciones(req, res, next) {
    try {
        const estado = typeof req.query.estado === 'string' && req.query.estado ? req.query.estado : undefined;
        const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
        const porPagina = Math.min(100, Math.max(1, parseInt(req.query.porPagina, 10) || 25));

        if (estado && !ESTADOS_VALIDOS.includes(estado)) {
            return res.status(400).json({ ok: false, mensaje: 'Estado inválido' });
        }

        // require perezoso: si el módulo de pagos tuviera un problema, el
        // resto del panel (usuarios, sesión) sigue vivo.
        const orderStore = require('../payment-link/orderStore');
        res.json({ ok: true, ...orderStore.listarOrdenes({ estado, pagina, porPagina }) });
    } catch (error) {
        next(error);
    }
}

function listarActividad(req, res) {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const porPagina = Math.min(100, Math.max(1, parseInt(req.query.porPagina, 10) || 50));
    res.json({ ok: true, ...req.app.locals.audit.listar({ pagina, porPagina }) });
}

module.exports = { listarTransacciones, listarActividad };