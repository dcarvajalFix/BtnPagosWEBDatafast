const { z } = require('zod');

// Se anula por orden: el servidor busca el paymentId y el monto guardados,
// así nadie puede anular un pago ajeno ni por un monto distinto.
const anularOrdenSchema = z.object({
    orderId: z.string().trim().regex(/^[a-f0-9]{32}$/i, 'orderId con formato inválido'),
});

module.exports = { anularOrdenSchema };