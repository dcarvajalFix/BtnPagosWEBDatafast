// orderId sale de la URL (/pagar/:orderId), nunca del navegador se decide
// el monto: eso lo resuelve el servidor.
const partesUrl = window.location.pathname.split('/');
const ORDER_ID = partesUrl[partesUrl.length - 1];

let ORDEN = null;

async function cargarOrden() {
    try {
        const respuesta = await fetch(`/api/payment/orden/${ORDER_ID}`);
        const datos = await respuesta.json();

        if (!datos.ok) {
            mostrarMensaje('error');
            document.getElementById('mensaje-error').textContent = datos.mensaje;
            document.getElementById('formulario-cliente').style.display = 'none';
            return;
        }

        ORDEN = datos;
        document.getElementById('descripcion-servicio').textContent = datos.descripcion || 'Pago';
        document.getElementById('total').textContent = `$${datos.monto} ${datos.moneda}`;
    } catch (error) {
        mostrarMensaje('error');
    }
}

document.getElementById('formulario-cliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!ORDEN) return;

    const boton = document.getElementById('btn-pagar');
    boton.disabled = true;
    mostrarMensaje('cargando');

    const cliente = {
        nombre: document.getElementById('nombre').value.trim(),
        segundoNombre: document.getElementById('segundoNombre').value.trim(),
        apellido: document.getElementById('apellido').value.trim(),
        email: document.getElementById('email').value.trim(),
        telefono: document.getElementById('telefono').value.trim(),
        identificacion: document.getElementById('identificacion').value.trim(),
        direccion: document.getElementById('direccion').value.trim(),
    };

    try {
        const respuesta = await fetch('/api/payment/crear-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: ORDER_ID, cliente }),
        });

        const datos = await respuesta.json();

        if (datos.ok) {
            mostrarFormularioDatafast(datos.checkoutId);
        } else {
            mostrarMensaje('error');
            document.getElementById('mensaje-error').textContent = datos.mensaje || 'Error al procesar el pago.';
            boton.disabled = false;
        }
    } catch (error) {
        mostrarMensaje('error');
        boton.disabled = false;
    }
});

function mostrarFormularioDatafast(checkoutId) {
    ocultarMensajes();
    document.getElementById('formulario-cliente').style.display = 'none';

    const contenedor = document.getElementById('formulario-datafast');
    contenedor.style.display = 'block';

    const script = document.createElement('script');
    script.src = `https://eu-test.oppwa.com/v1/paymentWidgets.js?checkoutId=${checkoutId}`;
    document.body.appendChild(script);

    const form = document.createElement('form');
    form.action = `${window.location.origin}/resultado/${ORDER_ID}`;
    form.className = 'paymentWidgets';
    form.setAttribute('data-brands', 'VISA MASTER AMEX DINERS DISCOVER');

    contenedor.appendChild(form);
}

function mostrarMensaje(tipo) {
    ocultarMensajes();
    document.getElementById(`mensaje-${tipo}`).style.display = 'block';
}

function ocultarMensajes() {
    document.getElementById('mensaje-cargando').style.display = 'none';
    document.getElementById('mensaje-error').style.display = 'none';
}

cargarOrden();