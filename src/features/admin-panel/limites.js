const rateLimit = require('express-rate-limit');

// La tabla de transacciones se actualiza sola cada ~20 s por cada pestaña
// abierta. Con el límite general (60 por 15 min) se agotaría en 15 minutos,
// así que las lecturas del panel tienen su propio cupo, más amplio.
const limiteLectura = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, mensaje: 'Demasiadas solicitudes.' },
});

module.exports = { limiteLectura };