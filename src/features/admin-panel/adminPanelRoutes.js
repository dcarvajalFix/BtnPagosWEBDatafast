const express = require('express');
const router = express.Router();

const controller = require('./adminPanelController');
const requireSession = require('./sessionAuth');
const { limiteLogin, limiteInterno } = require('../../core/middleware/rateLimit');

router.post('/login', limiteLogin, controller.login);
router.post('/logout', controller.logout);
router.get('/sesion', controller.sesionActual);

router.get('/transacciones', limiteInterno, requireSession, controller.listarTransacciones);

module.exports = router;