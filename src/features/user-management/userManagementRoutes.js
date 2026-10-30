const express = require('express');
const controller = require('./userManagementController');
const { limiteInterno } = require('../../core/middleware/rateLimit');

function crearRouter(auth) {
    const router = express.Router();
    const gestionar = auth.requirePermiso('usuarios:gestionar');
    const rol = auth.requirePermiso('usuarios:rol');

    router.use(limiteInterno);

    router.get('/', gestionar, controller.listar);
    router.get('/roles', gestionar, controller.catalogoRoles);
    router.post('/', gestionar, controller.crear);
    router.patch('/:id/rol', rol, controller.cambiarRol);
    router.patch('/:id/activo', gestionar, controller.cambiarActivo);
    router.post('/:id/reset-password', gestionar, controller.resetearPassword);

    return router;
}

module.exports = crearRouter;