/* ---------------------------------- CONFIGURA Y ARRANCA EL SERVIDOR --------------------------------------------*/

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');

// Cargar/validar config PRIMERO. Si falta una variable obligatoria, el
// proceso falla acá con un mensaje claro, en vez de arrancar "a medias".
const config = require('./core/config/env');

const errorHandler = require('./core/middleware/errorHandler');
const paymentLinkRoutes = require('./features/payment-link/paymentLinkRoutes');
const adminPanelRoutes = require('./features/admin-panel/adminPanelRoutes');

const app = express();

// Confiar en el proxy de Plesk/nginx para que req.ip sea la IP real del
// cliente (Datafast exige customer.ip real, no la del servidor).
app.set('trust proxy', 1);

/*
  HEADERS DE SEGURIDAD (A05 - Security Misconfiguration)
  Antes no había ninguno: sin CSP, sin X-Frame-Options, sin HSTS.
  El widget de Datafast se carga desde un script externo, así que la CSP
  necesita permitir explícitamente ese dominio.
*/
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", 'https://eu-test.oppwa.com', 'https://eu-prod.oppwa.com'],
                connectSrc: ["'self'", 'https://eu-test.oppwa.com', 'https://eu-prod.oppwa.com'],
                frameSrc: ["'self'", 'https://eu-test.oppwa.com', 'https://eu-prod.oppwa.com'],
                formAction: ["'self'", 'https://eu-test.oppwa.com', 'https://eu-prod.oppwa.com'],
                imgSrc: ["'self'", 'https://www.datafast.com.ec', 'https://eu-test.oppwa.com', 'https://eu-prod.oppwa.com', 'data:'],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://eu-test.oppwa.com', 'https://eu-prod.oppwa.com'],
            },
        },
    })
);

/*
  CORS: por defecto el checkout público (/pagar/:orderId) se sirve desde
  este mismo servidor, así que no necesita CORS. Si en el futuro algún
  frontend externo necesita llamar a la API directo (cross-origin), agregar
  su dominio a ALLOWED_ORIGINS en el .env.
*/
if (config.allowedOrigins.length > 0) {
    app.use(
        cors({
            origin: config.allowedOrigins,
            methods: ['GET', 'POST'],
        })
    );
}

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

/*
  SESIÓN (panel de admin)
  ------------------------
  Cookie httpOnly (no accesible por JS, mitiga XSS robando la sesión),
  'secure' en producción (solo viaja por HTTPS), sameSite 'lax' (mitiga
  CSRF básico). El store por defecto es en memoria: si el proceso se
  reinicia, las sesiones activas se cierran (el usuario simplemente
  vuelve a hacer login, no es un problema de seguridad).
*/
app.use(
    session({
        name: 'fixbtn.sid',
        secret: config.sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: config.isProduction,
            sameSite: 'lax',
            maxAge: 8 * 60 * 60 * 1000, // 8 horas
        },
    })
);

app.use(express.static(path.join(__dirname, '../public')));

/*--------------- API ---------------*/
app.use('/api/payment', paymentLinkRoutes);
app.use('/api/admin', adminPanelRoutes);

/*--------------- PÁGINAS ---------------*/

// Página del checkout público: el orderId va en la URL, el monto se
// resuelve del lado del servidor (ver /api/payment/orden/:orderId).
app.get('/pagar/:orderId', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/checkout.html'));
});

app.get('/resultado/:orderId', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/resultado.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

// El panel en sí es HTML público (sin datos sensibles adentro); todos
// los datos reales los pide vía fetch a /api/admin/transacciones, que sí
// exige sesión. Si no hay sesión, panel.js redirige a /login.
app.get('/panel', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/panel.html'));
});

// Health check simple, útil para monitoreo en Plesk sin exponer nada sensible.
app.get('/health', (req, res) => {
    res.json({ ok: true });
});

/*--------------- 404 y errores ---------------*/
app.use((req, res) => {
    res.status(404).json({ ok: false, mensaje: 'No encontrado' });
});

app.use(errorHandler);

app.listen(config.port, () => {
    console.log(`Servidor escuchando en el puerto ${config.port} (${config.nodeEnv})`);
});

module.exports = app;