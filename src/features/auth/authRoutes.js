const express = require('express');
const router = express.Router();

const controller = require('./authController');
const { requireSessionSinCambio } = require('./middleware');
const { limiteLogin, limiteInterno } = require('../../core/middleware/rateLimit');

router.post('/login', limiteLogin, controller.login);
router.post('/logout', controller.logout);
router.get('/sesion', limiteInterno, requireSessionSinCambio, controller.sesionActual);
router.post('/password', limiteLogin, requireSessionSinCambio, controller.cambiarPassword);

module.exports = router;