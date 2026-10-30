/*
  MÓDULO: payment-link
  ---------------------
  Flujo de pago: órdenes, checkout público y verificación. NO depende del
  módulo auth para funcionar: si auth está disponible, los endpoints
  internos aceptan sesión o API key; si no, vuelven a exigir solo la API key
  (como antes). El pago de un cliente nunca requiere sesión.
*/

const path = require('path');
const crearRouter = require('./paymentLinkRoutes');
const requireApiKey = require('../../core/middleware/apiKeyAuth');

function montar(app) {
    const auth = app.locals.auth;

    const autorizarCrearLink = auth ? auth.sesionOApiKey('link:crear') : requireApiKey;
    const autorizarAnular = auth ? auth.sesionOApiKey('pago:anular') : requireApiKey;

    app.use('/api/payment', crearRouter({ autorizarCrearLink, autorizarAnular }));

    // Páginas públicas del flujo de pago. El monto lo resuelve el servidor
    // (ver /api/payment/orden/:orderId), nunca el navegador.
    app.get('/pagar/:orderId', (req, res) => {
        res.sendFile(path.join(__dirname, '../../../public/checkout.html'));
    });

    app.get('/resultado/:orderId', (req, res) => {
        res.sendFile(path.join(__dirname, '../../../public/resultado.html'));
    });
}

module.exports = { montar };