/* -----------------------------------------------------------------------
   ESTE ARCHIVO MANEJA TODA LA COMUNICACIÓN CON LA API DE MIND BODY
   
   FLUJO:
   1. Obtenemos un token de Mind Body (autenticación)
   2. Usamos ese token para consultar clases, servicios, etc.
------------------------------------------------------------------------ */

const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/*------------------------------------------------------------------
  VARIABLES DE CONFIGURACIÓN
------------------------------------------------------------------*/
const MINDBODY_URL = process.env.MINDBODY_URL;
const MINDBODY_API_KEY = process.env.MINDBODY_API_KEY;
const MINDBODY_SITE_ID = process.env.MINDBODY_SITE_ID;
const MINDBODY_SOURCE_NAME = process.env.MINDBODY_SOURCE_NAME;
const MINDBODY_SOURCE_PASSWORD = process.env.MINDBODY_SOURCE_PASSWORD;

/*------------------------------------------------------------------
  FUNCIÓN HELPER: obtenerToken
  
  ¿Qué hace?
  Antes de llamar a cualquier endpoint de Mind Body
  necesitamos autenticarnos y obtener un token.
  Es como iniciar sesión antes de usar la app.
  
  ¿Qué devuelve?
  Un token temporal que usamos en las demás llamadas
------------------------------------------------------------------*/
const obtenerToken = async () => {

    const respuesta = await axios.post(
        `${MINDBODY_URL}/public/v6/usertoken/issue`,
        {
            // Credenciales del usuario administrador del sandbox
            Username: 'mindbodysandboxsite@gmail.com',
            Password: 'Apitest1234'
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'API-Key': MINDBODY_API_KEY,
                'SiteId': MINDBODY_SITE_ID,
                // Credenciales de tu integración van aquí
                'SourceName': MINDBODY_SOURCE_NAME,
                'SourcePassword': MINDBODY_SOURCE_PASSWORD
            }
        }
    );

    return respuesta.data.AccessToken;
};

/*------------------------------------------------------------------
  FUNCIÓN 1: obtenerClases
  
  ¿Qué hace?
  Obtiene el horario de clases disponibles del estudio
  
  ¿Qué devuelve?
  Lista de clases con nombre, horario, instructor, cupos
------------------------------------------------------------------*/
const obtenerClases = async (req, res) => {

    try {
        // Primero obtenemos el token
        const token = await obtenerToken();

        // Luego consultamos las clases
        const respuesta = await axios.get(
            `${MINDBODY_URL}/public/v6/class/classes`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'API-Key': MINDBODY_API_KEY,
                    'SiteId': MINDBODY_SITE_ID,
                    'Authorization': token
                },
                params: {
                    // Solo clases futuras
                    StartDateTime: new Date().toISOString(),
                    // Máximo 20 clases
                    Limit: 20
                }
            }
        );

        // Simplificamos la respuesta para el frontend
        const clases = respuesta.data.Classes.map(clase => ({
            id: clase.Id,
            nombre: clase.ClassDescription.Name,
            fecha: clase.StartDateTime,
            duracion: clase.ClassDescription.Duration,
            instructor: clase.Staff?.DisplayName || 'Por confirmar',
            cuposDisponibles: clase.TotalBooked < clase.MaxCapacity,
            cupos: clase.MaxCapacity - clase.TotalBooked,
            precio: clase.ClassDescription?.SessionType?.Price || 0
        }));

        res.json({
            ok: true,
            total: clases.length,
            clases: clases
        });

    } catch (error) {
        console.error('Error obteniendo clases:', error.message);
        res.status(500).json({
            ok: false,
            mensaje: 'Error al obtener clases de Mind Body',
            error: error.message
        });
    }
};

/*------------------------------------------------------------------
  FUNCIÓN 2: obtenerServicios
  
  ¿Qué hace?
  Obtiene los servicios y membresías disponibles
  con sus precios
  
  ¿Qué devuelve?
  Lista de servicios con nombre y precio
------------------------------------------------------------------*/
const obtenerServicios = async (req, res) => {

    try {
        const token = await obtenerToken();

        const respuesta = await axios.get(
            `${MINDBODY_URL}/public/v6/sale/services`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'API-Key': MINDBODY_API_KEY,
                    'SiteId': MINDBODY_SITE_ID,
                    'Authorization': token
                }
            }
        );

        const servicios = respuesta.data.Services.map(servicio => ({
            id: servicio.Id,
            nombre: servicio.Name,
            precio: servicio.Price,
            descripcion: servicio.Description || ''
        }));

        res.json({
            ok: true,
            total: servicios.length,
            servicios: servicios
        });

    } catch (error) {
        console.error('Error obteniendo servicios:', error.message);
        res.status(500).json({
            ok: false,
            mensaje: 'Error al obtener servicios de Mind Body',
            error: error.message
        });
    }
};

/*------------------------------------------------------------------
  FUNCIÓN 3: obtenerCliente
  
  ¿Qué hace?
  Busca un cliente en Mind Body por su email
  
  ¿Qué recibe?
  - req.query.email → el email del cliente a buscar
  
  ¿Qué devuelve?
  Información del cliente
------------------------------------------------------------------*/
const obtenerCliente = async (req, res) => {

    try {
        const token = await obtenerToken();
        const email = req.query.email;

        const respuesta = await axios.get(
            `${MINDBODY_URL}/public/v6/client/clients`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'API-Key': MINDBODY_API_KEY,
                    'SiteId': MINDBODY_SITE_ID,
                    'Authorization': token
                },
                params: {
                    SearchText: email
                }
            }
        );

        const clientes = respuesta.data.Clients;

        if (clientes.length === 0) {
            return res.json({
                ok: false,
                mensaje: 'Cliente no encontrado'
            });
        }

        const cliente = clientes[0];

        res.json({
            ok: true,
            cliente: {
                id: cliente.Id,
                nombre: cliente.FirstName,
                apellido: cliente.LastName,
                email: cliente.Email,
                telefono: cliente.MobilePhone
            }
        });

    } catch (error) {
        console.error('Error obteniendo cliente:', error.message);
        res.status(500).json({
            ok: false,
            mensaje: 'Error al buscar cliente en Mind Body',
            error: error.message
        });
    }
};

/*------------------------------------------------------------------
  EXPORTAMOS LAS FUNCIONES
------------------------------------------------------------------*/
module.exports = {
    obtenerClases,
    obtenerServicios,
    obtenerCliente
};