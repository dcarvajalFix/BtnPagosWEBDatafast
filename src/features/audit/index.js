/*
  MÓDULO: audit
  --------------
  Escucha el evento 'auditar' del bus y lo guarda en SQLite. Expone
  app.locals.audit.listar para que el panel muestre la actividad (si este
  módulo está caído, el panel simplemente no ofrece esa pantalla).
*/

const auditService = require('./auditService');

function montar(app) {
    if (!app.locals.eventos) throw new Error('No existe el bus de eventos');

    app.locals.eventos.on('auditar', (evento) => auditService.registrar(evento));
    app.locals.audit = { listar: auditService.listar };
}

module.exports = { montar };