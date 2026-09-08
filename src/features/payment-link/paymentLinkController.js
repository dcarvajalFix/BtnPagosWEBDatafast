/*
  CONTROLLER: payment-link
  -------------------------
  Este archivo es el único que conoce el flujo de negocio "generar un link
  con un monto fijo y mandarlo a cobrar". Toda la parte insegura/genérica
  (hablar con Datafast, validar formato de resourcePath, etc.) vive en
  src/core y aquí solo se orquesta.
*/

const datafastService = require('../../core/services/datafastService');
const { verificarPagoSchema } = require('../../core/validators/paymentValidators');
const orderStore = require('./orderStore');

/**
 * [INTERNO - requiere API key]
 * Crea un link de pago con un monto fijo. Lo usa el equipo de FixGroup
 * desde la interfaz interna, nunca el cliente final.
 */
function crearLink(req, res) {
    const { monto, moneda, descripcion } = req.body;

    const orden = orderStore.crearOrden({ monto, moneda, descripcion });

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    res.status(201).json({
        ok: true,
        orderId: orden.orderId,
        link: `${baseUrl}/pagar/${orden.orderId}`,
        monto: orden.monto,
        moneda: orden.moneda,
        expiraEn: new Date(orden.expiraEn).toISOString(),
    });
}

/**
 * [PÚBLICO]
 * Devuelve los datos de una orden (monto, estado) para que el checkout
 * público pueda mostrarlos SIN que el navegador los controle.
 */
function obtenerOrdenPublica(req, res) {
    const orden = orderStore.obtenerOrden(req.params.orderId);

    if (!orden) {
        return res.status(404).json({ ok: false, mensaje: 'Link de pago no encontrado' });
    }

    if (orden.estado === 'expirado') {
        return res.status(410).json({ ok: false, mensaje: 'Este link de pago expiró' });
    }

    if (orden.estado === 'pagado') {
        return res.status(409).json({ ok: false, mensaje: 'Este link ya fue pagado' });
    }

    res.json({
        ok: true,
        orderId: orden.orderId,
        monto: orden.monto,
        moneda: orden.moneda,
        descripcion: orden.descripcion,
    });
}

/**
 * [PÚBLICO]
 * Crea el checkout en Datafast para una orden existente. El monto SIEMPRE
 * sale de la orden guardada en el servidor (orderStore), nunca del body
 * que manda el navegador — esto es lo que cierra el hueco de "el cliente
 * decide cuánto paga".
 */
async function crearCheckout(req, res, next) {
    try {
        const { orderId, cliente } = req.body;

        const orden = orderStore.obtenerOrden(orderId);
        if (!orden) {
            return res.status(404).json({ ok: false, mensaje: 'Link de pago no encontrado' });
        }
        if (orden.estado !== 'pendiente') {
            return res.status(409).json({ ok: false, mensaje: 'Este link ya no está disponible para pago' });
        }

        // merchantTransactionId único y trazable a la orden (evita
        // duplicados — Datafast rechaza con 800.110.100 si se repite).
        const merchantTransactionId = `fixbtn_${orden.orderId}_${Date.now()}`;

        const respuestaDatafast = await datafastService.crearCheckout({
            monto: orden.monto,
            moneda: orden.moneda,
            merchantTransactionId,
            descripcion: orden.descripcion,
            cliente: {
                ...cliente,
                ip: req.ip,
                merchantCustomerId: orden.orderId.slice(0, 16),
            },
        });

        const checkoutId = datafastService.extraerCheckoutIdDeRespuesta(respuestaDatafast);
        if (!checkoutId) {
            // Loguear la respuesta completa de Datafast: sin esto, no hay
            // forma de saber qué campo rechazó (el mensaje al cliente es
            // genérico a propósito, pero acá sí necesitamos el detalle).
            console.error('Datafast no devolvió checkoutId. Respuesta completa:', JSON.stringify(respuestaDatafast, null, 2));
            return res.status(502).json({ ok: false, mensaje: 'Datafast no devolvió un checkoutId válido' });
        }
        
        orderStore.asociarCheckoutId(orderId, checkoutId);

        res.json({ ok: true, checkoutId });
    } catch (error) {
        next(error);
    }
}

/**
 * [PÚBLICO]
 * Verifica el resultado de un pago. Valida que el resourcePath tenga
 * formato correcto Y que corresponda a una orden que este servidor creó
 * (evita el IDOR: ya no se puede consultar transacciones ajenas mandando
 * cualquier resourcePath).
 */
async function verificarPago(req, res, next) {
    try {
        const { orderId, resourcePath } = req.query;

        const parsed = verificarPagoSchema.safeParse({ orderId, resourcePath });
        if (!parsed.success) {
            return res.status(400).json({ ok: false, mensaje: 'Parámetros inválidos' });
        }

        const orden = orderStore.obtenerOrden(orderId);
        if (!orden || !orden.checkoutId) {
            return res.status(404).json({ ok: false, mensaje: 'Orden no encontrada' });
        }

        // El resourcePath tiene forma /v1/checkouts/{checkoutId}/payment:
        // confirmamos que el checkoutId dentro del path sea el mismo que
        // guardamos al crear el checkout de ESTA orden.
        if (!resourcePath.includes(`/v1/checkouts/${orden.checkoutId}/payment`)) {
            return res.status(403).json({ ok: false, mensaje: 'El resourcePath no corresponde a esta orden' });
        }

        const resultado = await datafastService.verificarPago(resourcePath);
        const aprobado = datafastService.pagoFueAprobado(resultado);

        orderStore.marcarResultado(orderId, {
            estado: aprobado ? 'pagado' : 'rechazado',
            paymentId: resultado.id,
        });

        res.json({
            ok: aprobado,
            mensaje: aprobado ? 'Pago aprobado' : 'Pago rechazado',
            datos: resultado,
        });
    } catch (error) {
        if (error.codigo === 'RESOURCE_PATH_INVALIDO') {
            return res.status(400).json({ ok: false, mensaje: 'resourcePath inválido' });
        }
        next(error);
    }
}

/**
 * [INTERNO - requiere API key]
 * Anula/reembolsa un pago ya procesado.
 */
async function anularPago(req, res, next) {
    try {
        const { paymentId, monto } = req.body;
        const merchantTransactionId = `fixbtn_refund_${Date.now()}`;

        const resultado = await datafastService.anularPago({ paymentId, monto, merchantTransactionId });

        res.json({ ok: true, mensaje: 'Pago anulado correctamente', datos: resultado });
    } catch (error) {
        if (error.codigo === 'PAYMENT_ID_INVALIDO') {
            return res.status(400).json({ ok: false, mensaje: 'paymentId inválido' });
        }
        next(error);
    }
}

module.exports = {
    crearLink,
    obtenerOrdenPublica,
    crearCheckout,
    verificarPago,
    anularPago,
};
