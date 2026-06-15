/* ESTE ARCHIVO SOLO REDIRECCIONA LAS PETICIONES DE PAGO QUE VAN A LOS CONTROLLERS*/

//Esta declaración es para poder usar las herramientas de express 
const express = require('express'); 

/*
Esta es la que guarda las rutas (como si fuera una lista para saber que hacer en caso de que llegue una ruta u otra)
*/
const router = express.Router(); 

const { 
    obtenerCheckoutId,
    verificarPago,
    anularPago 
} = require('../controllers/datafastController');


//Esta es una ruta que damos con el "/test" donde publicamos un mensaje de prueba que estaría denotado con el res.json (en formato json)

router.get('/test', (req, res) => {
    res.json({ 
        mensaje: 'Rutas de pago funcionando',
        estado: 'ok'
    });
});
/*---------------- RUTAS --------------------- */
//Crear checkout y enviar datos (POST) 
router.post('/crear-checkout', obtenerCheckoutId);
//Ruta para Verificar el pago 
router.get('/verificar', verificarPago);
//Ruta para anular pago
router.post('/anular', anularPago);

//Este es el que expone el dato a index.js que lo pide a través del require al declarar la variable. 
module.exports = router;

