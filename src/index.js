/* ---------------------------------- CONFIGURA Y ARRANCA EL SERVIDOR --------------------------------------------*/

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');

// Cargar/validar config PRIMERO. Si falta una variable obligatoria, el
// proceso falla acá con un mensaje claro, en vez de arrancar "a medias".
const config = require('./core/config/env');

const errorHandler = require('./core/middleware/errorHandler');
const { crearBus } = require('./shared/eventos');
const { montarModulos } = require('./modulos');

const app = express();

// Bus de eventos para que los módulos se comuniquen sin importarse entre sí.
app.locals.eventos = crearBus();

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

app.use(express.static(path.join(__dirname, '../public')));

/*--------------- MÓDULOS ---------------
  Cada feature se monta de forma independiente (ver src/modulos.js): si uno
  falla al arrancar, se registra el error y los demás siguen funcionando.
  Aquí se registran sus rutas de API y sus páginas.
*/
montarModulos(app);

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