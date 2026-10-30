const { getDb } = require('../../core/services/database');

const db = getDb();

db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        ts      INTEGER NOT NULL,
        actor   TEXT,
        accion  TEXT NOT NULL,
        detalle TEXT,
        ip      TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);
`);

function registrar({ actor, accion, detalle, ip }) {
    try {
        db.prepare(`
            INSERT INTO audit_log (ts, actor, accion, detalle, ip) VALUES (?, ?, ?, ?, ?)
        `).run(
            Date.now(),
            actor ? String(actor).slice(0, 64) : null,
            String(accion).slice(0, 64),
            detalle ? JSON.stringify(detalle).slice(0, 1000) : null,
            ip ? String(ip).slice(0, 64) : null
        );
    } catch (err) {
        console.error('[audit] no se pudo registrar:', err.message);
    }
}

function listar({ pagina = 1, porPagina = 50 } = {}) {
    const offset = (pagina - 1) * porPagina;
    const filas = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?').all(porPagina, offset);
    const total = db.prepare('SELECT COUNT(*) AS c FROM audit_log').get().c;

    return {
        eventos: filas.map((f) => ({
            id: f.id,
            fecha: f.ts,
            actor: f.actor,
            accion: f.accion,
            detalle: f.detalle ? safeParse(f.detalle) : null,
            ip: f.ip,
        })),
        total,
        pagina,
        porPagina,
        totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    };
}

function safeParse(texto) {
    try { return JSON.parse(texto); } catch (_) { return null; }
}

module.exports = { registrar, listar };