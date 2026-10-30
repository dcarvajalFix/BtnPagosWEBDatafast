/*
  MÓDULO: user-management
  ------------------------
  API para que un administrador gestione usuarios. Depende únicamente de la
  interfaz publicada por el módulo auth (app.locals.auth). Si auth no está
  disponible, este módulo no se monta y el resto sigue funcionando.
*/

const crearRouter = require('./userManagementRoutes');

function montar(app) {
    if (!app.locals.auth) throw new Error('El módulo auth no está disponible');
    app.use('/api/usuarios', crearRouter(app.locals.auth));
}

module.exports = { montar };