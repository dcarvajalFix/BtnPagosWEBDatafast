/*
  STORE DE SESIONES EN SQLITE
  -----------------------------
  Reemplaza al MemoryStore de express-session. Beneficios:
    - Las sesiones sobreviven a reinicios y despliegues (Restart App).
    - Se pueden listar y cerrar a distancia ("Mis sesiones").
    - Se pueden revocar todas al desactivar a alguien o resetear su clave.

  El id de sesión real (el de la cookie) NUNCA se guarda ni se expone: la
  tabla usa un hash de él. Ese hash es el "id público" que ve el panel; no
  permite reconstruir la cookie.
*/

const crypto = require('crypto');
const session = require('express-session');
const { getDb } = require('../../core/services/database');

const TTL_POR_DEFECTO_MS = 8 * 60 * 60 * 1000;
const REFRESCO_ACTIVIDAD_MS = 60 * 1000; // no escribir "última actividad" en cada petición

function idPublico(sid) {
    return crypto.createHash('sha256').update(String(sid)).digest('hex').slice(0, 32);
}

class SqliteSessionStore extends session.Store {
    constructor({ ttlMs = TTL_POR_DEFECTO_MS } = {}) {
        super();
        this.db = getDb();
        this.ttlMs = ttlMs;

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sesiones (
                id          TEXT PRIMARY KEY,
                user_id     INTEGER,
                data        TEXT NOT NULL,
                expires     INTEGER NOT NULL,
                creado_en   INTEGER NOT NULL,
                ultimo_uso  INTEGER NOT NULL,
                ip          TEXT,
                navegador   TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_sesiones_user ON sesiones(user_id);
            CREATE INDEX IF NOT EXISTS idx_sesiones_expires ON sesiones(expires);
        `);

        this.sentencias = {
            obtener: this.db.prepare('SELECT data, expires FROM sesiones WHERE id = ?'),
            guardar: this.db.prepare(`
                INSERT INTO sesiones (id, user_id, data, expires, creado_en, ultimo_uso, ip, navegador)
                VALUES (@id, @user_id, @data, @expires, @ahora, @ahora, @ip, @navegador)
                ON CONFLICT(id) DO UPDATE SET
                    user_id = excluded.user_id, data = excluded.data, expires = excluded.expires,
                    ultimo_uso = excluded.ultimo_uso, ip = excluded.ip, navegador = excluded.navegador
            `),
            tocar: this.db.prepare(`
                UPDATE sesiones SET expires = @expires,
                    ultimo_uso = CASE WHEN ultimo_uso < @umbral THEN @ahora ELSE ultimo_uso END
                WHERE id = @id
            `),
            borrar: this.db.prepare('DELETE FROM sesiones WHERE id = ?'),
            purgar: this.db.prepare('DELETE FROM sesiones WHERE expires <= ?'),
            deUsuario: this.db.prepare(
                'SELECT id, ip, navegador, creado_en, ultimo_uso FROM sesiones WHERE user_id = ? AND expires > ? ORDER BY ultimo_uso DESC'
            ),
            borrarDeUsuario: this.db.prepare('DELETE FROM sesiones WHERE id = ? AND user_id = ?'),
            borrarOtras: this.db.prepare('DELETE FROM sesiones WHERE user_id = ? AND id != ?'),
            borrarTodasDeUsuario: this.db.prepare('DELETE FROM sesiones WHERE user_id = ?'),
        };

        this.purgar();
        const temporizador = setInterval(() => this.purgar(), 15 * 60 * 1000);
        temporizador.unref();
    }

    /* ----------------------- Interfaz de express-session ----------------------- */

    get(sid, cb) {
        try {
            const fila = this.sentencias.obtener.get(idPublico(sid));
            if (!fila) return cb(null, null);
            if (fila.expires <= Date.now()) {
                this.sentencias.borrar.run(idPublico(sid));
                return cb(null, null);
            }
            const datos = JSON.parse(fila.data);
            if (datos.cookie) datos.cookie.expires = new Date(fila.expires).toISOString();
            cb(null, datos);
        } catch (err) {
            cb(err);
        }
    }

    set(sid, sess, cb) {
        try {
            const ahora = Date.now();
            const meta = sess.meta || {};
            this.sentencias.guardar.run({
                id: idPublico(sid),
                user_id: Number.isInteger(sess.userId) ? sess.userId : null,
                data: JSON.stringify(sess),
                expires: this._vence(sess, ahora),
                ahora,
                ip: meta.ip ? String(meta.ip).slice(0, 64) : null,
                navegador: meta.navegador ? String(meta.navegador).slice(0, 100) : null,
            });
            if (cb) cb(null);
        } catch (err) {
            if (cb) cb(err);
        }
    }

    touch(sid, sess, cb) {
        try {
            const ahora = Date.now();
            this.sentencias.tocar.run({
                id: idPublico(sid),
                expires: this._vence(sess, ahora),
                ahora,
                umbral: ahora - REFRESCO_ACTIVIDAD_MS,
            });
            if (cb) cb(null);
        } catch (err) {
            if (cb) cb(err);
        }
    }

    destroy(sid, cb) {
        try {
            this.sentencias.borrar.run(idPublico(sid));
            if (cb) cb(null);
        } catch (err) {
            if (cb) cb(err);
        }
    }

    _vence(sess, ahora) {
        const expires = sess && sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : NaN;
        return Number.isFinite(expires) ? expires : ahora + this.ttlMs;
    }

    /* ----------------------- Gestión de sesiones (panel) ----------------------- */

    purgar() {
        try { this.sentencias.purgar.run(Date.now()); } catch (err) { console.error('[sesiones] no se pudo purgar:', err.message); }
    }

    /** Sesiones vigentes de un usuario. sidActual (opcional) marca la sesión en uso. */
    listarDeUsuario(userId, sidActual = null) {
        const actual = sidActual ? idPublico(sidActual) : null;
        return this.sentencias.deUsuario.all(userId, Date.now()).map((f) => ({
            id: f.id,
            navegador: f.navegador || 'Navegador desconocido',
            ip: f.ip || '-',
            creadoEn: f.creado_en,
            ultimoUso: f.ultimo_uso,
            actual: f.id === actual,
        }));
    }

    /** Cierra UNA sesión de ese usuario (el userId evita tocar sesiones ajenas). */
    cerrar(userId, id) {
        if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id)) return false;
        return this.sentencias.borrarDeUsuario.run(id, userId).changes > 0;
    }

    /** Cierra todas las sesiones del usuario salvo la indicada. Devuelve cuántas. */
    cerrarOtras(userId, sidActual) {
        return this.sentencias.borrarOtras.run(userId, idPublico(sidActual)).changes;
    }

    /** Cierra todas las sesiones del usuario. Devuelve cuántas. */
    cerrarTodas(userId) {
        return this.sentencias.borrarTodasDeUsuario.run(userId).changes;
    }

    idPublico(sid) {
        return idPublico(sid);
    }
}

module.exports = { SqliteSessionStore, idPublico };