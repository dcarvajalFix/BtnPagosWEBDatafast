/*
  AUTH SERVICE (usuarios del panel de admin)
  ---------------------------------------------
  Guarda usuario/contraseña (hasheada con bcrypt) en SQLite. Al arrancar,
  si la tabla está vacía, crea un usuario inicial con las credenciales de
  ADMIN_USERNAME / ADMIN_PASSWORD del .env — así el primer acceso no
  depende de tocar la base de datos a mano.

  Después de ese primer arranque, ADMIN_USERNAME/ADMIN_PASSWORD ya no se
  vuelven a leer (el usuario ya existe en la tabla). Si quieren agregar
  más personas del equipo con su propio usuario más adelante, se agrega
  un endpoint de gestión — por ahora, con uno alcanza.
*/

const bcrypt = require('bcryptjs');
const { getDb } = require('../../core/services/database');
const config = require('../../core/config/env');

const db = getDb();

db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        creado_en     INTEGER NOT NULL
    );
`);

function sembrarUsuarioInicial() {
    const cantidad = db.prepare('SELECT COUNT(*) AS c FROM admin_users').get().c;
    if (cantidad > 0) return;

    if (!config.adminPanel.usuarioInicial || !config.adminPanel.passwordInicial) {
        console.warn(
            'No hay usuarios en admin_users y faltan ADMIN_USERNAME/ADMIN_PASSWORD ' +
            'en el .env — nadie podrá entrar al panel hasta crear un usuario.'
        );
        return;
    }

    const hash = bcrypt.hashSync(config.adminPanel.passwordInicial, 12);
    db.prepare(`
        INSERT INTO admin_users (username, password_hash, creado_en) VALUES (?, ?, ?)
    `).run(config.adminPanel.usuarioInicial, hash, Date.now());

    console.log(`Usuario admin inicial creado: ${config.adminPanel.usuarioInicial}`);
}

sembrarUsuarioInicial();

/**
 * Verifica usuario/contraseña. Devuelve el usuario (sin el hash) si es
 * válido, o null si no.
 */
function verificarCredenciales(username, password) {
    const usuario = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
    if (!usuario) return null;

    const valido = bcrypt.compareSync(password, usuario.password_hash);
    if (!valido) return null;

    return { id: usuario.id, username: usuario.username };
}

module.exports = { verificarCredenciales };