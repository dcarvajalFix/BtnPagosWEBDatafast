/*
  CARGADOR DE MÓDULOS
  --------------------
  Cada feature es un módulo independiente con una función montar(app). Se
  montan en orden y cada uno dentro de su propio try/catch: si uno falla al
  arrancar (por ejemplo un error en su tabla o en sus rutas), se registra el
  error en el log y los demás módulos siguen levantando.

  Orden: audit y auth primero (otros dependen de ellos de forma opcional),
  payment-link antes que el panel para que el flujo de pago sea lo primero
  que queda disponible.
*/

const CARGADORES = [
    ['audit', () => require('./features/audit')],
    ['auth', () => require('./features/auth')],
    ['payment-link', () => require('./features/payment-link')],
    ['user-management', () => require('./features/user-management')],
    ['admin-panel', () => require('./features/admin-panel')],
];

function montarModulos(app) {
    const estado = {};

    for (const [nombre, cargar] of CARGADORES) {
        try {
            cargar().montar(app);
            estado[nombre] = 'ok';
            console.log(`[modulo:${nombre}] montado`);
        } catch (err) {
            estado[nombre] = 'caido';
            console.error(`[modulo:${nombre}] NO se pudo montar:`, err.stack || err.message);
        }
    }

    app.locals.estadoModulos = estado;
    return estado;
}

module.exports = { montarModulos };