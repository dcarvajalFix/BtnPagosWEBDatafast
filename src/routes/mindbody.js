/* -----------------------------------------------------------------------
   RUTAS DE MIND BODY
------------------------------------------------------------------------ */

const express = require('express');
const router = express.Router();

const {
    obtenerClases,
    obtenerServicios,
    obtenerCliente
} = require('../controllers/mindbodyController');

// Ruta de prueba
router.get('/test', (req, res) => {
    res.json({
        mensaje: '✅ Rutas de Mind Body funcionando',
        estado: 'ok'
    });
});

// Obtener clases disponibles
router.get('/clases', obtenerClases);

// Obtener servicios y membresías
router.get('/servicios', obtenerServicios);

// Buscar cliente por email
router.get('/cliente', obtenerCliente);

module.exports = router;