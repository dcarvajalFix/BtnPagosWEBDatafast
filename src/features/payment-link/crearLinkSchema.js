const { z } = require('zod');
const { crearLinkSchema } = require('../../core/validators/paymentValidators');

// Mismo contrato que el link original + caducidad opcional en minutos
// (de 5 minutos a 7 días). Si no se envía, rige ORDER_TTL_MINUTES.
const MINUTOS_MIN = 5;
const MINUTOS_MAX = 7 * 24 * 60;

const crearLinkConCaducidadSchema = crearLinkSchema.extend({
    ttlMinutos: z.number().int().min(MINUTOS_MIN).max(MINUTOS_MAX).optional(),
});

module.exports = { crearLinkConCaducidadSchema, MINUTOS_MIN, MINUTOS_MAX };