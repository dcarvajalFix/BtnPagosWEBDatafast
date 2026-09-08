/*
  MANEJO CENTRAL DE ERRORES (A09 - Logging & Monitoring Failures)
  -------------------------------------------------------------------
  Antes cada controller hacía su propio try/catch y devolvía
  `error: error.message` directo al cliente. Eso puede filtrar detalles
  internos (rutas, nombres de librerías, mensajes de Datafast con
  estructura interna).

  Ahora: el detalle completo se loguea SOLO en el servidor (con un id de
  correlación), y al cliente se le devuelve un mensaje genérico + ese id,
  para que si necesita soporte, ustedes puedan buscar el error real en los
  logs sin haberlo expuesto públicamente.
*/

const crypto = require('crypto');

function errorHandler(err, req, res, _next) {
    const errorId = crypto.randomBytes(4).toString('hex');

    // Log completo del lado del servidor (acá sí es útil el detalle).
    console.error(`[${errorId}] ${req.method} ${req.originalUrl} ->`, err.response?.data || err.message);

    const status = err.status || 500;

    res.status(status).json({
        ok: false,
        mensaje: 'Ocurrió un error procesando la solicitud. Si el problema persiste, contacta a soporte con este código.',
        errorId,
    });
}

module.exports = errorHandler;
