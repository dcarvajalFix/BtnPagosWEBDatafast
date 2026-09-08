/*
  AUTH POR API KEY (arregla A01 - Broken Access Control)
  --------------------------------------------------------
  Antes /crear-checkout (con monto libre) y /anular NO tenían ninguna
  protección: cualquiera que encontrara la URL podía generar cobros o
  anular pagos ajenos.

  Ahora los endpoints internos (crear link de pago, anular) exigen un
  header 'x-api-key' que coincida con ADMIN_API_KEY. Esta key la usa
  únicamente la interfaz interna del equipo de FixGroup (la que arma el
  link y lo manda al cliente), nunca el navegador de quien paga.

  Es intencionalmente simple (una sola key estática) porque es una
  herramienta de uso interno, no una integración multi-comercio. Si el
  equipo crece y varias personas necesitan trazabilidad de quién generó
  qué link, esto se puede evolucionar a usuarios/roles reales.
*/

const config = require('../config/env');

function requireApiKey(req, res, next) {
    const key = req.header('x-api-key');

    if (!key || key !== config.adminApiKey) {
        return res.status(401).json({
            ok: false,
            mensaje: 'No autorizado',
        });
    }

    next();
}

module.exports = requireApiKey;
