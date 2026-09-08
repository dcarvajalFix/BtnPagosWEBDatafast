/*
  CONEXIÓN A SQLITE
  ------------------
  Este archivo SOLO abre la conexión a un archivo .sqlite local y la
  expone. No sabe nada de "órdenes" ni "usuarios admin" — eso lo definen
  las features que la usan (ver src/features/payment-link/orderStore.js y
  src/features/admin-panel/authService.js), cada una creando sus propias
  tablas con CREATE TABLE IF NOT EXISTS.

  Por qué SQLite: un solo comercio, volumen bajo, sin necesidad de
  levantar un servicio de base de datos aparte en Plesk. Es un archivo
  que se puede respaldar copiándolo.

  RUTA CONFIGURABLE (importante para Plesk): si la variable de entorno
  DB_PATH está definida, se usa esa ruta absoluta tal cual. Si no, cae al
  default relativo 'data/fixbtn.sqlite' dentro del proyecto (cómodo para
  desarrollo local).

  En Plesk, definir DB_PATH apuntando a una carpeta FUERA del directorio
  que Git gestiona (ej. un directorio hermano, no dentro de httpdocs/ o
  donde sea que el deploy haga pull) — si el pipeline de Git hace un
  reset/clean en cada despliegue, cualquier archivo dentro de esa carpeta
  se pierde, incluida la base de datos con el historial y los usuarios
  del panel.
*/

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.resolve(__dirname, '../../../data/fixbtn.sqlite');

const DB_DIR = path.dirname(DB_PATH);

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function getDb() {
    return db;
}

module.exports = { getDb, DB_PATH };