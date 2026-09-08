/*
  CONFIG CENTRALIZADA
  --------------------
  Antes las variables de entorno se leían sueltas en cada archivo (con
  console.log de las credenciales, incluido). Ahora se leen UNA sola vez
  aquí, se validan, y se exportan ya tipadas/limpias.

  Si falta una variable obligatoria, el servidor NO arranca (fail-fast),
  en vez de arrancar "a medias" y fallar en el primer pago real.
*/

const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function required(name) {
    const value = process.env[name];
    if (!value || value.trim() === '') {
        throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
    }
    return value;
}

function optionalBoolean(name, defaultValue = false) {
    const value = process.env[name];
    if (value === undefined || value.trim() === '') return defaultValue;
    return value.trim().toUpperCase() === 'TRUE' || value.trim() === '1';
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

const config = {
    nodeEnv: NODE_ENV,
    isProduction: IS_PRODUCTION,
    port: parseInt(process.env.PORT, 10) || 3000,

    // Clave que deben mandar los endpoints internos (crear-link, anular)
    // en el header 'x-api-key'. Solo la conoce el equipo de FixGroup.
    adminApiKey: required('ADMIN_API_KEY'),

    // Secreto para firmar la cookie de sesión del panel de admin.
    sessionSecret: required('SESSION_SECRET'),

    // Credenciales del PRIMER usuario del panel de admin. Solo se usan una
    // vez, al arrancar por primera vez, para sembrar la tabla admin_users
    // (ver src/features/admin-panel/authService.js). No son obligatorias
    // porque, tras el primer arranque, el usuario ya vive en la base de
    // datos y estas variables dejan de leerse.
    adminPanel: {
        usuarioInicial: process.env.ADMIN_USERNAME || null,
        passwordInicial: process.env.ADMIN_PASSWORD || null,
    },

    // Orígenes permitidos para llamadas cross-origin (si en el futuro se
    // embebe el checkout vía fetch desde otro dominio). El checkout público
    // (/pagar/:orderId) se sirve desde este mismo servidor, así que en la
    // mayoría de casos esto puede quedar vacío.
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),

    datafast: {
        url: required('DATAFAST_URL'),
        entityId: required('DATAFAST_ENTITY_ID'),
        bearerToken: required('DATAFAST_BEARER_TOKEN'),
        mid: required('DATAFAST_MID'),
        tid: required('DATAFAST_TID'),
        nombreComercio: process.env.DATAFAST_NOMBRE_COMERCIO || 'FixGroup',
        // Importante: en producción este parámetro NO debe enviarse a
        // Datafast (el doc de integración lo exige explícitamente). Por
        // eso lo resolvemos a boolean acá y en el controller decidimos si
        // se incluye o no el campo, en vez de mandar el string "undefined".
        testMode: optionalBoolean('DATAFAST_TEST_MODE', !IS_PRODUCTION),
    },

    // Cuánto dura vivo un link de pago antes de expirar (minutos).
    // Datafast igual expira el checkoutId a los 30 min, así que no tiene
    // sentido que la orden dure más que eso.
    orderTtlMinutes: parseInt(process.env.ORDER_TTL_MINUTES, 10) || 30,
};

module.exports = config;