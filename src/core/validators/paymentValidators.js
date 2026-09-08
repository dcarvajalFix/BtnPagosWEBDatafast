/*
  VALIDADORES DE ENTRADA (A03/A04 OWASP)
  ---------------------------------------
  Antes no había NINGUNA validación de lo que mandaba el cliente: el monto
  llegaba como string y se usaba directo. Acá se define, de forma explícita,
  qué es un input válido para cada endpoint. Si no cumple, se rechaza antes
  de tocar la base de datos o llamar a Datafast.
*/

const { z } = require('zod');

// Límite superior conservador. Ajusten este valor según el caso de uso real
// del negocio (evita que un error de tipeo mande a cobrar $100000).
const MONTO_MAXIMO = 5000;

const montoSchema = z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === 'string' ? parseFloat(val) : val))
    .refine((val) => Number.isFinite(val), { message: 'El monto debe ser un número válido' })
    .refine((val) => val > 0, { message: 'El monto debe ser mayor a 0' })
    .refine((val) => val <= MONTO_MAXIMO, { message: `El monto no puede superar $${MONTO_MAXIMO}` })
    .transform((val) => val.toFixed(2));

const crearLinkSchema = z.object({
    monto: montoSchema,
    moneda: z.literal('USD').optional().default('USD'),
    descripcion: z.string().trim().max(255).optional().default(''),
});

const crearCheckoutSchema = z.object({
    orderId: z.string().trim().regex(/^[a-f0-9]{32}$/i, 'orderId con formato inválido'),
    cliente: z.object({
        nombre: z.string().trim().min(1).max(48),
        segundoNombre: z.string().trim().max(50).optional().default(''),
        apellido: z.string().trim().min(1).max(48),
        email: z.string().trim().email().max(128),
        telefono: z.string().trim().min(7).max(25),
        identificacion: z.string().trim().min(1).max(10),
        direccion: z.string().trim().min(1).max(100),
        pais: z.string().trim().length(2).optional().default('EC'),
    }),
});

const verificarPagoSchema = z.object({
    orderId: z.string().trim().regex(/^[a-f0-9]{32}$/i, 'orderId con formato inválido'),
    resourcePath: z.string().trim().min(1).max(255),
});

const anularPagoSchema = z.object({
    paymentId: z.string().trim().regex(/^[a-zA-Z0-9.]+$/, 'paymentId con formato inválido'),
    monto: montoSchema,
    merchantTransactionId: z.string().trim().min(8).max(255),
});

/**
 * Middleware de Express que valida req.body contra un schema de zod.
 * Si falla, responde 400 con un mensaje genérico (nunca el detalle interno
 * de zod, que podría filtrar estructura del código).
 */
function validar(schema) {
    return (req, res, next) => {
        const resultado = schema.safeParse(req.body);
        if (!resultado.success) {
            return res.status(400).json({
                ok: false,
                mensaje: 'Datos inválidos',
                errores: resultado.error.issues.map((i) => ({
                    campo: i.path.join('.'),
                    mensaje: i.message,
                })),
            });
        }
        req.body = resultado.data;
        next();
    };
}

module.exports = {
    crearLinkSchema,
    crearCheckoutSchema,
    verificarPagoSchema,
    anularPagoSchema,
    validar,
    MONTO_MAXIMO,
};
