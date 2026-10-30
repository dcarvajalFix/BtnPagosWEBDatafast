/*
  RUTAS: payment-link
  --------------------
  Se montan bajo /api/payment (ver index.js del módulo).

  Internas (sesión con permiso, o x-api-key para integraciones):
    POST /crear-link      -> genera el link con monto fijo
    POST /anular          -> reembolsa un pago (solo administrador o API key)

  Públicas (las usa quien recibe el link, sin autenticación):
    GET  /orden/:orderId  -> datos de la orden (monto, estado) para pintar el checkout
    POST /crear-checkout  -> crea el checkout en Datafast para esa orden
    GET  /verificar       -> confirma el resultado del pago
*/

const express = require('express');

const controller = require('./paymentLinkController');
const { limitePago, limiteInterno } = require('../../core/middleware/rateLimit');
const {
    validar,
    crearLinkSchema,
    crearCheckoutSchema,
    anularPagoSchema,
} = require('../../core/validators/paymentValidators');

function crearRouter({ autorizarCrearLink, autorizarAnular }) {
    const router = express.Router();

    // --- Endpoints internos ---
    router.post('/crear-link', limiteInterno, autorizarCrearLink, validar(crearLinkSchema), controller.crearLink);
    router.post('/anular', limiteInterno, autorizarAnular, validar(anularPagoSchema), controller.anularPago);

    // --- Endpoints públicos (quien recibe el link) ---
    router.get('/orden/:orderId', limitePago, controller.obtenerOrdenPublica);
    router.post('/crear-checkout', limitePago, validar(crearCheckoutSchema), controller.crearCheckout);
    router.get('/verificar', limitePago, controller.verificarPago);

    return router;
}

module.exports = crearRouter;