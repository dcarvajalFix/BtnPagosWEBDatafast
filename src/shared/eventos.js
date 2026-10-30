/*
  BUS DE EVENTOS (comunicación entre módulos sin acoplarlos)
  -----------------------------------------------------------
  Los módulos NO se importan entre sí para registrar actividad. En su lugar,
  emiten el evento 'auditar' y, si el módulo de auditoría está vivo, lo
  escucha y lo guarda. Si auditoría está caído, el evento simplemente se
  pierde y el resto del sistema sigue funcionando.
*/

const { EventEmitter } = require('events');

function crearBus() {
    const bus = new EventEmitter();
    bus.on('error', (err) => console.error('[eventos] error:', err.message));
    return bus;
}

/**
 * Emite un evento a auditoría. Nunca lanza excepciones: registrar actividad
 * jamás debe romper la operación principal.
 */
function auditar(req, accion, detalle) {
    try {
        const bus = req.app.locals.eventos;
        if (!bus) return;
        bus.emit('auditar', {
            actor: req.actor ? req.actor.nombre : null,
            accion,
            detalle: detalle || null,
            ip: req.ip || null,
        });
    } catch (err) {
        console.error('[eventos] no se pudo auditar:', err.message);
    }
}

module.exports = { crearBus, auditar };  