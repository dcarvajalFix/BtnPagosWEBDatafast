/*
  USER STORE (tabla admin_users)
  --------------------------------
  Mantiene la tabla que ya existía y le agrega, de forma segura, las
  columnas nuevas (rol, activo, debe_cambiar_password, ultimo_login_en,
  creado_por). Los usuarios que ya existían quedan como 'admin' (hasta
  ahora todos lo eran de hecho), así nadie pierde acceso al actualizar.
*/

const { getDb } = require('../../core/services/database');

const db = getDb();

db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        creado_en     INTEGER NOT NULL
    );
`);

db.transaction(() => {
    const columnas = db.pragma('table_info(admin_users)').map((c) => c.name);

    if (!columnas.includes('rol')) {
        db.exec("ALTER TABLE admin_users ADD COLUMN rol TEXT NOT NULL DEFAULT 'empleado'");
        db.exec("UPDATE admin_users SET rol = 'admin'");
    }
    if (!columnas.includes('activo')) {
        db.exec('ALTER TABLE admin_users ADD COLUMN activo INTEGER NOT NULL DEFAULT 1');
    }
    if (!columnas.includes('debe_cambiar_password')) {
        db.exec('ALTER TABLE admin_users ADD COLUMN debe_cambiar_password INTEGER NOT NULL DEFAULT 0');
    }
    if (!columnas.includes('ultimo_login_en')) {
        db.exec('ALTER TABLE admin_users ADD COLUMN ultimo_login_en INTEGER');
    }
    if (!columnas.includes('creado_por')) {
        db.exec('ALTER TABLE admin_users ADD COLUMN creado_por TEXT');
    }
})();

/** Nunca incluye el hash de la contraseña. */
function filaAUsuario(fila) {
    if (!fila) return null;
    return {
        id: fila.id,
        username: fila.username,
        rol: fila.rol,
        activo: !!fila.activo,
        debeCambiarPassword: !!fila.debe_cambiar_password,
        ultimoLoginEn: fila.ultimo_login_en || null,
        creadoEn: fila.creado_en,
        creadoPor: fila.creado_por || null,
    };
}

function obtenerPorId(id) {
    return filaAUsuario(db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id));
}

/** Fila cruda (con hash). Solo para verificar credenciales. */
function obtenerFilaPorUsername(username) {
    return db.prepare('SELECT * FROM admin_users WHERE username = ? COLLATE NOCASE').get(username);
}

function obtenerHashPorId(id) {
    const fila = db.prepare('SELECT password_hash FROM admin_users WHERE id = ?').get(id);
    return fila ? fila.password_hash : null;
}

function listar() {
    return db
        .prepare('SELECT * FROM admin_users ORDER BY activo DESC, rol ASC, username COLLATE NOCASE ASC')
        .all()
        .map(filaAUsuario);
}

function contar() {
    return db.prepare('SELECT COUNT(*) AS c FROM admin_users').get().c;
}

function contarAdminsActivos() {
    return db.prepare("SELECT COUNT(*) AS c FROM admin_users WHERE rol = 'admin' AND activo = 1").get().c;
}

function crear({ username, passwordHash, rol = 'empleado', creadoPor = null, debeCambiarPassword = true }) {
    const info = db.prepare(`
        INSERT INTO admin_users (username, password_hash, creado_en, rol, activo, debe_cambiar_password, creado_por)
        VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(username, passwordHash, Date.now(), rol, debeCambiarPassword ? 1 : 0, creadoPor);

    return obtenerPorId(info.lastInsertRowid);
}

/** Devuelve { ok, codigo?, anterior?, usuario? }. Protege al último admin. */
const cambiarRol = db.transaction((id, rol) => {
    const fila = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id);
    if (!fila) return { ok: false, codigo: 'NO_EXISTE' };

    if (fila.rol === 'admin' && rol !== 'admin' && fila.activo && contarAdminsActivos() <= 1) {
        return { ok: false, codigo: 'ULTIMO_ADMIN' };
    }

    db.prepare('UPDATE admin_users SET rol = ? WHERE id = ?').run(rol, id);
    return { ok: true, anterior: fila.rol, usuario: obtenerPorId(id) };
});

/** Devuelve { ok, codigo?, usuario? }. Protege al último admin. */
const cambiarActivo = db.transaction((id, activo) => {
    const fila = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id);
    if (!fila) return { ok: false, codigo: 'NO_EXISTE' };

    if (!activo && fila.rol === 'admin' && fila.activo && contarAdminsActivos() <= 1) {
        return { ok: false, codigo: 'ULTIMO_ADMIN' };
    }

    db.prepare('UPDATE admin_users SET activo = ? WHERE id = ?').run(activo ? 1 : 0, id);
    return { ok: true, usuario: obtenerPorId(id) };
});

function establecerPassword(id, passwordHash, debeCambiarPassword) {
    db.prepare('UPDATE admin_users SET password_hash = ?, debe_cambiar_password = ? WHERE id = ?')
        .run(passwordHash, debeCambiarPassword ? 1 : 0, id);
}

function registrarLogin(id) {
    db.prepare('UPDATE admin_users SET ultimo_login_en = ? WHERE id = ?').run(Date.now(), id);
}

module.exports = {
    obtenerPorId,
    obtenerFilaPorUsername,
    obtenerHashPorId,
    listar,
    contar,
    contarAdminsActivos,
    crear,
    cambiarRol,
    cambiarActivo,
    establecerPassword,
    registrarLogin,
    filaAUsuario,
};