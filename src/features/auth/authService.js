/*
  AUTH SERVICE
  -------------
  Contraseñas (bcrypt, costo 12), política de contraseñas, contraseñas
  temporales y verificación de credenciales. Sin dependencias de Express.
*/

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../../core/config/env');
const userStore = require('./userStore');

const COSTO_BCRYPT = 12;

// Hash de relleno: si el usuario no existe igual hacemos un compare, para
// que el tiempo de respuesta no revele qué usuarios existen.
const HASH_RELLENO = bcrypt.hashSync('relleno-sin-uso-' + crypto.randomBytes(8).toString('hex'), COSTO_BCRYPT);

const USERNAME_REGEX = /^[a-z0-9._-]{3,32}$/;

function validarPassword(password) {
    if (typeof password !== 'string') return 'Contraseña inválida';
    if (password.length < 10) return 'La contraseña debe tener al menos 10 caracteres';
    if (Buffer.byteLength(password, 'utf8') > 72) return 'La contraseña es demasiado larga (máximo 72 bytes)';
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        return 'La contraseña debe incluir al menos una letra y un número';
    }
    return null;
}

function hashear(password) {
    return bcrypt.hash(password, COSTO_BCRYPT);
}

function comparar(password, hash) {
    return bcrypt.compare(password, hash);
}

/** Contraseña temporal legible (sin caracteres ambiguos como 0/O o 1/l). */
function generarPasswordTemporal() {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let pass;
    do {
        pass = Array.from({ length: 12 }, () => alfabeto[crypto.randomInt(alfabeto.length)]).join('');
    } while (validarPassword(pass) !== null);
    return pass;
}

/**
 * Devuelve el usuario (sin hash) si las credenciales son válidas y el
 * usuario está activo; si no, null. Siempre ejecuta un compare.
 */
async function verificarCredenciales(username, password) {
    const fila = userStore.obtenerFilaPorUsername(username);
    const valido = await comparar(password, fila ? fila.password_hash : HASH_RELLENO);

    if (!fila || !valido || !fila.activo) return null;
    return userStore.filaAUsuario(fila);
}

/** Si la tabla está vacía, crea el primer administrador desde el .env. */
async function sembrarAdminInicial() {
    if (userStore.contar() > 0) return;

    const { usuarioInicial, passwordInicial } = config.adminPanel;
    if (!usuarioInicial || !passwordInicial) {
        console.warn(
            'No hay usuarios y faltan ADMIN_USERNAME/ADMIN_PASSWORD en el entorno: ' +
            'nadie podrá entrar al panel hasta crear un usuario.'
        );
        return;
    }

    const hash = await hashear(passwordInicial);
    userStore.crear({
        username: usuarioInicial,
        passwordHash: hash,
        rol: 'admin',
        creadoPor: 'sistema',
        debeCambiarPassword: false,
    });
    console.log(`Administrador inicial creado: ${usuarioInicial}`);
}

module.exports = {
    USERNAME_REGEX,
    validarPassword,
    hashear,
    comparar,
    generarPasswordTemporal,
    verificarCredenciales,
    sembrarAdminInicial,
};