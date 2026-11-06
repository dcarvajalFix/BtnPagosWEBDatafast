/*
  ORDER STORE (persistente en SQLite)
  -------------------------------------
  Antes esto era un Map en memoria: se perdía todo al reiniciar el
  servidor. Ahora se guarda en SQLite (ver src/core/services/database.js),
  así que sobrevive a reinicios/deploys y puede alimentar el panel de
  transacciones.

  Las funciones exportadas son las MISMAS que antes (mismo nombre, misma
  firma) — el controller que las usa (paymentLinkController.js) no tuvo
  que cambiar nada. Solo cambió cómo se guardan los datos por dentro.
*/

const crypto = require('crypto');
const config = require('../../core/config/env');
const { getDb } = require('../../core/services/database');

const db = getDb();

db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
        order_id    TEXT PRIMARY KEY,
        monto       TEXT NOT NULL,
        moneda      TEXT NOT NULL,
        descripcion TEXT,
        estado      TEXT NOT NULL,
        checkout_id TEXT,
        payment_id  TEXT,
        creado_en   INTEGER NOT NULL,
        expira_en   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orders_creado_en ON orders(creado_en);
    CREATE INDEX IF NOT EXISTS idx_orders_estado ON orders(estado);
`);

// Migración: quién creó el link (nombre de usuario, o 'api-key'). Las
// órdenes anteriores quedan con NULL y siguen funcionando igual.
if (!db.pragma('table_info(orders)').some((c) => c.name === 'creado_por')) {
    db.exec('ALTER TABLE orders ADD COLUMN creado_por TEXT');
}

// Migración: datos de la anulación (quién, cuándo, y la referencia/autorización
// que devuelve Datafast, que el Test Script pide como "Referencia Anulación").
const COLUMNAS_ANULACION = [
    ['anulado_en', 'INTEGER'],
    ['anulado_por', 'TEXT'],
    ['anulacion_id', 'TEXT'],
    ['anulacion_ref', 'TEXT'],
    ['anulacion_auth', 'TEXT'],
    ['anulacion_mtid', 'TEXT'],
];
const columnasExistentes = db.pragma('table_info(orders)').map((c) => c.name);
for (const [nombre, tipo] of COLUMNAS_ANULACION) {
    if (!columnasExistentes.includes(nombre)) db.exec(`ALTER TABLE orders ADD COLUMN ${nombre} ${tipo}`);
}

function generarOrderId() {
    return crypto.randomBytes(16).toString('hex');
}

function filaAOrden(fila) {
    if (!fila) return null;
    return {
        orderId: fila.order_id,
        monto: fila.monto,
        moneda: fila.moneda,
        descripcion: fila.descripcion || '',
        estado: fila.estado,
        checkoutId: fila.checkout_id,
        paymentId: fila.payment_id,
        creadoEn: fila.creado_en,
        expiraEn: fila.expira_en,
        creadoPor: fila.creado_por || null,
        anuladoEn: fila.anulado_en || null,
        anuladoPor: fila.anulado_por || null,
        anulacionId: fila.anulacion_id || null,
        anulacionReferencia: fila.anulacion_ref || null,
        anulacionAutorizacion: fila.anulacion_auth || null,
        anulacionMtid: fila.anulacion_mtid || null,
    };
}

function crearOrden({ monto, moneda, descripcion, creadoPor = null }) {
    const orderId = generarOrderId();
    const ahora = Date.now();
    const expiraEn = ahora + config.orderTtlMinutes * 60 * 1000;

    db.prepare(`
        INSERT INTO orders (order_id, monto, moneda, descripcion, estado, checkout_id, payment_id, creado_en, expira_en, creado_por)
        VALUES (?, ?, ?, ?, 'pendiente', NULL, NULL, ?, ?, ?)
    `).run(orderId, monto, moneda, descripcion || '', ahora, expiraEn, creadoPor);

    return filaAOrden(db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId));
}

function obtenerOrden(orderId) {
    const fila = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
    if (!fila) return null;

    if (Date.now() > fila.expira_en && fila.estado === 'pendiente') {
        db.prepare("UPDATE orders SET estado = 'expirado' WHERE order_id = ?").run(orderId);
        fila.estado = 'expirado';
    }

    return filaAOrden(fila);
}

function asociarCheckoutId(orderId, checkoutId) {
    const resultado = db.prepare(`
        UPDATE orders SET checkout_id = ?, estado = 'checkout_creado' WHERE order_id = ?
    `).run(checkoutId, orderId);

    if (resultado.changes === 0) return null;
    return obtenerOrden(orderId);
}

function marcarResultado(orderId, { estado, paymentId }) {
    // Una orden anulada (o con anulación en curso) no vuelve a 'pagado' aunque
    // el cliente recargue la página de resultado: Datafast sigue mostrando la
    // compra original como aprobada.
    db.prepare(`
        UPDATE orders SET estado = ?, payment_id = COALESCE(?, payment_id)
        WHERE order_id = ? AND estado NOT IN ('anulando', 'anulado')
    `).run(estado, paymentId || null, orderId);

    return obtenerOrden(orderId);
}

/**
 * Paso 1 de una anulación: "reserva" la orden (pagado -> anulando) de forma
 * atómica. Si dos administradores (o un doble clic) intentan anular a la vez,
 * solo uno consigue la reserva y el otro recibe false.
 */
function reservarAnulacion(orderId, merchantTransactionId) {
    const r = db.prepare(`
        UPDATE orders SET estado = 'anulando', anulacion_mtid = ?
        WHERE order_id = ? AND estado = 'pagado'
    `).run(merchantTransactionId, orderId);
    return r.changes === 1;
}

/** Datafast rechazó la anulación: la orden vuelve a 'pagado'. */
function liberarAnulacion(orderId) {
    db.prepare("UPDATE orders SET estado = 'pagado' WHERE order_id = ? AND estado = 'anulando'").run(orderId);
    return obtenerOrden(orderId);
}

/** Datafast aprobó la anulación: se guarda quién, cuándo y la referencia. */
function confirmarAnulacion(orderId, { por, anulacionId, referencia, autorizacion }) {
    db.prepare(`
        UPDATE orders SET estado = 'anulado', anulado_en = ?, anulado_por = ?,
            anulacion_id = ?, anulacion_ref = ?, anulacion_auth = ?
        WHERE order_id = ? AND estado = 'anulando'
    `).run(Date.now(), por || null, anulacionId || null, referencia || null, autorizacion || null, orderId);
    return obtenerOrden(orderId);
}

function buscarPorCheckoutId(checkoutId) {
    const fila = db.prepare('SELECT * FROM orders WHERE checkout_id = ?').get(checkoutId);
    return filaAOrden(fila);
}

/**
 * NUEVO: lista órdenes para el panel de admin, con filtro opcional por
 * estado y paginación simple.
 */
function listarOrdenes({ estado, pagina = 1, porPagina = 25 } = {}) {
    const offset = (pagina - 1) * porPagina;

    let filas, total;
    if (estado) {
        filas = db.prepare(`
            SELECT * FROM orders WHERE estado = ? ORDER BY creado_en DESC LIMIT ? OFFSET ?
        `).all(estado, porPagina, offset);
        total = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE estado = ?').get(estado).c;
    } else {
        filas = db.prepare(`
            SELECT * FROM orders ORDER BY creado_en DESC LIMIT ? OFFSET ?
        `).all(porPagina, offset);
        total = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
    }

    return {
        ordenes: filas.map(filaAOrden),
        total,
        pagina,
        porPagina,
        totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    };
}

// Limpieza periódica: marca como expiradas las órdenes pendientes que ya
// vencieron (por si nadie las volvió a consultar para que se actualizaran solas).
setInterval(() => {
    db.prepare(`
        UPDATE orders SET estado = 'expirado' WHERE estado = 'pendiente' AND expira_en < ?
    `).run(Date.now());
}, 15 * 60 * 1000).unref();

module.exports = {
    crearOrden,
    obtenerOrden,
    asociarCheckoutId,
    marcarResultado,
    buscarPorCheckoutId,
    listarOrdenes,
    reservarAnulacion,
    liberarAnulacion,
    confirmarAnulacion,
};