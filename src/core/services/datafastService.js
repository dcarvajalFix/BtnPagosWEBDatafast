/*
  DATAFAST SERVICE
  ----------------
  Toda la comunicación HTTP con Datafast vive aquí. El controller ya no
  arma URLSearchParams a mano ni sabe nada de axios: solo llama a estas
  funciones. Esto separa "cómo le hablo a Datafast" de "qué hago con la
  petición HTTP entrante", que es lo que hacía difícil de mantener y
  testear el controller original.
*/

const axios = require('axios');
const config = require('../config/env');

const RESOURCE_PATH_REGEX = /^\/v1\/checkouts\/[a-zA-Z0-9.-]+\/payment$/;

const datafastClient = axios.create({
    baseURL: config.datafast.url,
    timeout: 15000,
    headers: {
        Authorization: `Bearer ${config.datafast.bearerToken}`,
    },
});

/**
 * Crea un checkout en Datafast (Fase 1 + campos obligatorios de Fase 2
 * según la Guía de Implementación DataWeb v3.2.2, sección 3.2.1).
 *
 * Antes solo se mandaban los campos de Fase 1, lo que hace que Datafast
 * rechace las transacciones en el ambiente de pruebas/producción real
 * (sección 3.2 del PDF: customer.*, billing.*, merchantTransactionId y
 * risk.parameters son obligatorios a partir de Fase 2).
 */

async function crearCheckout({ monto, moneda, merchantTransactionId, descripcion, cliente }) {
    const campos = {
        entityId: config.datafast.entityId,
        amount: monto,
        currency: moneda,
        paymentType: 'DB',

        merchantTransactionId,

        // --- Datos obligatorios del cliente (Fase 2) ---
        'customer.givenName': cliente.nombre,
        'customer.surname': cliente.apellido,
        'customer.ip': cliente.ip,
        'customer.merchantCustomerId': cliente.merchantCustomerId,
        'customer.email': cliente.email,
        'customer.identificationDocType': 'IDCARD',
        'customer.identificationDocId': cliente.identificacion,
        'customer.phone': cliente.telefono,

        // Datafast exige TANTO billing como shipping. Para un servicio (no
        // hay envío físico), reutilizamos la misma dirección del cliente
        // en ambos — es lo que hacen la mayoría de comercios de servicios.
        'billing.street1': cliente.direccion,
        'billing.country': cliente.pais || 'EC',
        'shipping.street1': cliente.direccion,
        'shipping.country': cliente.pais || 'EC',

        // Datos del producto/servicio pagado (obligatorio, sección 3.2.1.10).
        'cart.items[0].name': (descripcion || 'Pago').slice(0, 255),
        'cart.items[0].description': (descripcion || 'Pago').slice(0, 255),
        'cart.items[0].price': monto,
        'cart.items[0].quantity': '1',

        // --- Impuestos (obligatorio aunque sea todo en cero) ---
        'customParameters[SHOPPER_VAL_BASE0]': '0.00',
        'customParameters[SHOPPER_VAL_BASEIMP]': monto,
        'customParameters[SHOPPER_VAL_IVA]': '0.00',

        // --- Datos fijos del comercio / integración ---
        'customParameters[SHOPPER_MID]': config.datafast.mid,
        'customParameters[SHOPPER_TID]': config.datafast.tid,
        'customParameters[SHOPPER_ECI]': '0103910',
        'customParameters[SHOPPER_PSERV]': '17913101',
        'customParameters[SHOPPER_VERSIONDF]': '2',

        'risk.parameters[USER_DATA2]': config.datafast.nombreComercio,
    };

    // Segundo nombre: el PDF lo lista como campo de Fase 2, pero es común
    // que el cliente no tenga uno. Se manda solo si vino, para no forzar
    // un valor inventado (el doc prohíbe explícitamente valores "de relleno").
    if (cliente.segundoNombre) {
        campos['customer.middleName'] = cliente.segundoNombre;
    }

        const datos = new URLSearchParams(campos);

    // El doc de Datafast es explícito: en producción, testMode NO se debe
    // enviar en absoluto (ni siquiera vacío). Antes el código lo mandaba
    // siempre, resultando en "testMode=undefined" cuando la env var faltaba.
    if (config.datafast.testMode) {
        datos.append('testMode', 'EXTERNAL');
    }

    const respuesta = await datafastClient.post('/v1/checkouts', datos.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return respuesta.data;
}

/**
 * Consulta el estado de una transacción usando el resourcePath que
 * Datafast devuelve tras el pago.
 *
 * Valida el formato del resourcePath ANTES de concatenarlo a la URL: sin
 * esto, cualquiera puede pasar un resourcePath arbitrario y consultar
 * transacciones ajenas (ver validación adicional en el controller, que
 * además confirma que el checkoutId pertenece a una orden propia).
 */
async function verificarPago(resourcePath) {
    if (typeof resourcePath !== 'string' || !RESOURCE_PATH_REGEX.test(resourcePath)) {
        const error = new Error('resourcePath con formato inválido');
        error.codigo = 'RESOURCE_PATH_INVALIDO';
        throw error;
    }

    const respuesta = await datafastClient.get(resourcePath, {
        params: { entityId: config.datafast.entityId },
    });

    return respuesta.data;
}

/**
 * Anula (reembolsa) un pago ya procesado.
 */
async function anularPago({ paymentId, monto, merchantTransactionId }) {
    if (typeof paymentId !== 'string' || !/^[a-zA-Z0-9.-]+$/.test(paymentId)) {
        const error = new Error('paymentId con formato inválido');
        error.codigo = 'PAYMENT_ID_INVALIDO';
        throw error;
    }

    const datos = new URLSearchParams({
        entityId: config.datafast.entityId,
        amount: monto,
        currency: 'USD',
        paymentType: 'RF',
        merchantTransactionId,
    });

    if (config.datafast.testMode) {
        datos.append('testMode', 'EXTERNAL');
    }

    const respuesta = await datafastClient.post(`/v1/payments/${paymentId}`, datos.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return respuesta.data;
}

function extraerCheckoutIdDeRespuesta(respuestaDatafast) {
    return respuestaDatafast && respuestaDatafast.id ? respuestaDatafast.id : null;
}

function pagoFueAprobado(respuestaDatafast) {
    const codigo = respuestaDatafast && respuestaDatafast.result && respuestaDatafast.result.code;
    // 000.000.000: aprobado en producción. 000.100.11x: aprobado en pruebas.
    return codigo === '000.000.000' || /^000\.100\.1\d\d$/.test(codigo || '');
}

module.exports = {
    crearCheckout,
    verificarPago,
    anularPago,
    extraerCheckoutIdDeRespuesta,
    pagoFueAprobado,
    RESOURCE_PATH_REGEX,
};

