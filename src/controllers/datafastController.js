/* 
ESTE ES EL ARCHIVO QUE REALMENTE SE VA A COMUNICAR POR LA API DE DATAFAST, EL FLUJO ES EL SIGUIENTE: 
1. TODO PARTE DE index.js QUE TIENE LA CONFIG DEL SERVIDOR Y LO ARRANCA
2. payment.js ES EL QUE RECIBE LA PETICIÓN DEL USUARIO AL SERVIDOR Y ESTE LLAMA AL CONTROLLER QUE SE REQUIERE
3. datafastController.js REALIZA LA CONEXIÓN CON LA API DE DATAFAST Y TODA SU LÓGICA DE PAGOS 
(El controller es el que tiene la lógica de lo que se requiera)
*/

/* 
ESTE CONTROLLER HARÁ LO SIGUIENTE: 
1. OBTENER CHECKOUTID 
2. VERIFICAR EL PAGO
3. ANULAR UN PAGO
*/

/*---------------------------VARIABLES-------------------------------*/

/*---------------------(Librerías necesarias)--------------------*/
            
// Axios es una librería de JS que sirve para comunicar el proyecto con APIS EXTERNAS
const axios = require('axios'); 

// Dotenv es para poder acceder a los datos que tenemos en el .env para no declararlos específicamente en el código
const dotenv = require('dotenv'); 
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/*------------- (Leemos las variables que están en el .env) -----------*/

const DATAFAST_URL = process.env.DATAFAST_URL; 
const ENTITY_ID = process.env.DATAFAST_ENTITY_ID;
const BEARER_TOKEN = process.env.DATAFAST_BEARER_TOKEN;
const MID = process.env.DATAFAST_MID;
const TID = process.env.DATAFAST_TID;


console.log('Variables de entorno:');
console.log('DATAFAST_URL:', DATAFAST_URL);
console.log('ENTITY_ID:', ENTITY_ID);
console.log('MID:', MID);
console.log('TID:', TID);

/* FUNCIONES */

/*---------------------- ObtenerCheckoutId ----------------------------*/

const obtenerCheckoutId = async (req, res) =>{

    try{
        const monto = req.body.monto || '0.00';
        const moneda = req.body.moneda || 'USD'; 

        const datos = new URLSearchParams({
            entityId: ENTITY_ID,                                    //Identificador como comercio en Datafast
            amount: monto,                                          //Monto que se va a pagar (Viene del usuario)
            currency: moneda,                                       //Es el tipo de moneda (Solo se va a manejar USD)
            paymentType: 'DB',                                      //Tipo de pago (DB: debit y RF: refund) 
            'customParameters[SHOPPER_MID]': MID,                   //Merchant ID (Único por negocio)
            'customParameters[SHOPPER_TID]': TID,                   //Terminal ID (Indica desde que terminal se hace el cobro)
            'customParameters[SHOPPER_ECI]': '0103910',             //Código de seguridad Fijo, siempre es este valor
            'customParameters[SHOPPER_PSERV]': '17913101',          //Identificador del proveedor del servicio (Nunca cambia)
            'customParameters[SHOPPER_VERSIONDF]': '2',             //Versión de la API
            'customParameters[SHOPPER_VAL_BASE0]':'0.00',           //Se usa cuando hay productos sin impuestos
            'customParameters[SHOPPER_VAL_BASEIMP]': monto,         //Aqui se asigna el impuesto que se usa 
            'customParameters[SHOPPER_VAL_IVA]': '0.00',            //El valor calculado del IVA
            testMode: process.env.DATAFAST_TEST_MODE                //Linea de test para datafast
        }); 

        const respuesta = await axios.post(
            `${DATAFAST_URL}/v1/checkouts`, 
            datos.toString(),
            {
                headers: {
                    'Authorization': `Bearer ${BEARER_TOKEN}`, 
                    'Content-Type': 'application/x-www-form-urlencoded'
                }

            }
        ); 

        const checkoutId = respuesta.data.id; 

        res.json({
            ok: true,
            checkoutId: checkoutId 
        })
    }catch (error){

        console.error('Error obtenido checkoutId:', error.message); 
        res.status(500).json({
            ok: false, 
            mensaje: 'Error al conectar con Datafast', 
            error: error.message
        }); 
    }
}; 

/*---------------------- Verificar Pago ----------------------------*/

const verificarPago = async (req, res) => {

    try {

        // Tomamos el resourcePath que nos mandó Datafast
        const resourcePath = req.query.resourcePath;

        // Llamamos a Datafast para saber el resultado del pago
        const respuesta = await axios.get(
            `${DATAFAST_URL}${resourcePath}?entityId=${ENTITY_ID}`,
            {
                headers: {
                    'Authorization': `Bearer ${BEARER_TOKEN}`
                }
            }
        );

        // Guardamos el resultado
        const resultado = respuesta.data;

        // El código 000.100.112 significa pago aprobado en pruebas
        // El código 000.000.000 significa pago aprobado en producción
        const pagoAprobado = 
            resultado.result.code === '000.100.112' || 
            resultado.result.code === '000.000.000';

        // Le devolvemos el resultado al cliente
        res.json({
            ok: pagoAprobado,
            mensaje: pagoAprobado ? 'Pago aprobado' : 'Pago rechazado',
            datos: resultado
        });

    } catch (error) {
        console.error('Error verificando pago:', error.message);
        res.status(500).json({
            ok: false,
            mensaje: 'Error al verificar el pago',
            error: error.message
        });
    }
};

/*---------------------- Anular Pago ----------------------------*/

const anularPago = async (req, res) => {

    try {

        const paymentId = req.body.paymentId;
        const monto = req.body.monto;

        const datos = new URLSearchParams({
            entityId: ENTITY_ID,
            amount: monto,
            currency: 'USD',
            paymentType: 'RF'   // RF = Refund (devolución)
        });

        const respuesta = await axios.post(
            `${DATAFAST_URL}/v1/payments/${paymentId}`,
            datos.toString(),
            {
                headers: {
                    'Authorization': `Bearer ${BEARER_TOKEN}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        res.json({
            ok: true,
            mensaje: 'Pago anulado correctamente',
            datos: respuesta.data
        });

    } catch (error) {
        console.error('Error anulando pago:', error.message);
        res.status(500).json({
            ok: false,
            mensaje: 'Error al anular el pago',
            error: error.message
        });
    }
};

/* Esportar funciones */

module.exports = {
    obtenerCheckoutId,
    verificarPago,
    anularPago
};