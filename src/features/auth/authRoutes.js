const express = require('express');
const router = express.Router();

const controller = require('./authController');
const sesionesController = require('./sesionesController');
const { requireSession, requireSessionSinCambio } = require('./middleware');
const { limiteLogin, limiteInterno } = require('../../core/middleware/rateLimit');

router.post('/login', limiteLogin, controller.login);
router.post('/logout', controller.logout);
router.get('/sesion', limiteInterno, requireSessionSinCambio, controller.sesionActual);
router.post('/password', limiteLogin, requireSessionSinCambio, controller.cambiarPassword);

// Mis sesiones: ver dónde está abierta mi cuenta y cerrar las que no reconozca.
router.get('/sesiones', limiteInterno, requireSession, sesionesController.listarPropias);
router.post('/sesiones/cerrar-otras', limiteInterno, requireSession, sesionesController.cerrarOtrasPropias);
router.delete('/sesiones/:id', limiteInterno, requireSession, sesionesController.cerrarPropia);

module.exports = router;