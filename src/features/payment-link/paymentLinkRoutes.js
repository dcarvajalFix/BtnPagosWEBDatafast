/*
  RUTAS: payment-link
  --------------------
  Se montan bajo /api/payment en index.js.

  Internas (requieren x-api-key):
    POST /crear-link      -> genera el link con monto fijo
    POST /anular          -> reembolsa un pago

  Públicas (las usa quien recibe el link, sin autenticación):
    GET  /orden/:orderId  -> datos de la orden (monto, estado) para pintar el checkout
    POST /crear-checkout  -> crea el checkout en Datafast para esa orden
    GET  /verificar        -> confirma el resultado del pago
*/

const express = require('express');
const router = express.Router();

const controller = require('./paymentLinkController');
const requireApiKey = require('../../core/middleware/apiKeyAuth');
const { limitePago, limiteInterno } = require('../../core/middleware/rateLimit');
const {
    validar,
    crearLinkSchema,
    crearCheckoutSchema,
    anularPagoSchema,
} = require('../../core/validators/paymentValidators');

// --- Endpoints internos (equipo FixGroup) ---
router.post('/crear-link', limiteInterno, requireApiKey, validar(crearLinkSchema), controller.crearLink);
router.post('/anular', limiteInterno, requireApiKey, validar(anularPagoSchema), controller.anularPago);

// --- Endpoints públicos (quien recibe el link) ---
router.get('/orden/:orderId', limitePago, controller.obtenerOrdenPublica);
router.post('/crear-checkout', limitePago, validar(crearCheckoutSchema), controller.crearCheckout);
router.get('/verificar', limitePago, controller.verificarPago);

module.exports = router;
