/* ---------------------------------- ESTE ARCHIVO ES EL QUE CONFIGURA EL SERVIDOR --------------------------------------------*/

/*------------------------- DEFINIR VARIABLES -------------------------*/

/*
Express sirve para arrancar el servidor web. 
"const" es para declarar una variable al que luego no se le puede reasignar una valor 
"require" es para traer el framework 
*/
const express = require('express');

//dotenv ayuda a leer el .env que es donde están todas las credenciales
const dotenv = require('dotenv'); 

//Path es para construir las rutas de los archivos
const path = require('path'); 

//Con esta línea traemos la info de payment, el ./ indica que busque el archivo en la carpeta actual
const paymentRoutes = require('./routes/payment'); 

//Este nos sirve para traer todas las variables que creamos en el .env
dotenv.config(); 

const cors = require('cors');


//Con esta línea arrancamos el servidor con express
const app = express(); 

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://business.fixgroup.net');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Responder inmediatamente a preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});


/*
Definimos el puerto en el que queremos que se abra para desplegar la web, la parte de "|| 3000" significa que si no encuentra
un puerto declarado en el env use el 3000 por defecto
*/
const PORT = process.env.PORT || 3000; 


 

/*--------------- TAREAS DE CONTROL (Se ejecutan en el orden que las escribamos y antes de ir a una ruta) -------------------*/
                                           /* Se definen por el app.use(tarea) */
                                
/*
Esto hace que el servidor al recibir datos en formato json los lea automaticamente, si no declaramos esto al recibir json el 
servidor no va a reconocer los textos en formato json
*/
app.use(express.json()); 

/* 
Este se usa para recibir respuestas de formularios HTML que están entre <form> </form>, el true es para que 
pueda entender estructuras de formularios más complejas 
*/
app.use(express.urlencoded({ extended: true })); 

/* 
Si se solicita una imagen la carpeta public va a estar expuesta para que el navegador la pueda encontrar
*/
app.use(express.static(path.join( __dirname, '../public'))); 

/*
Cualquier url que empiece con api/payments lo enrutamos a ./routes/payments.js
*/
app.use('/api/payment', paymentRoutes); 



/*------------------------- RUTAS -------------------------*/

/* 
En caso de que el usuario visite la página principal ('/') se lo direcciona para el archivo checkout.html en la carpeta public.
Los parámetros son req (Petición del visitante) y res (Respuesta del servidor). 
*/

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/checkout.html')); 
}); 

app.get('/resultado', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/resultado.html')); 
});

/*------------------------- Arrancar el servidor -------------------------*/

// Arranca el servidor 
app.listen(PORT, () => {
    console.log(`El servidor está en: http://localhost:${PORT}`); 
});   



// Agrega este require arriba con los demás


// Agrega esta línea con los demás app.use
