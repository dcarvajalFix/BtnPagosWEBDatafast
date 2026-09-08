/*
  RATE LIMITING (A04 - Insecure Design / previene abuso y DoS)
  ----------------------------------------------------------------
  Antes no había ningún límite: alguien podía golpear /crear-checkout en
  loop y agotar el cupo de pruebas de Datafast (el doc menciona que en
  Fase 2 el monto no debe superar $50 por transacción justamente para
  evitar esto), o simplemente saturar el servidor.
*/

const rateLimit = require('express-rate-limit');

// Límite generoso para el flujo público de pago (crear-checkout, verificar):
// un usuario real reintentando un pago no debería pasar de esto en 15 min.
const limitePago = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, mensaje: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
});

// Límite más estricto para los endpoints internos protegidos por API key
// (igual conviene limitarlos, por si la key se filtra).
const limiteInterno = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, mensaje: 'Demasiadas solicitudes.' },
});

// Límite estricto para el login (protección contra fuerza bruta de
// usuario/contraseña — mucho más agresivo que los otros límites).
const limiteLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, mensaje: 'Demasiados intentos de acceso. Intenta de nuevo en unos minutos.' },
});

module.exports = { limitePago, limiteInterno, limiteLogin };