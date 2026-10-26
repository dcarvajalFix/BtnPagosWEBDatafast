window.onload = async function () {
    // El orderId viaja en el PATH (/resultado/:orderId), fijado por el
    // servidor al armar el formulario de Datafast; el resourcePath lo
    // agrega Datafast como query param al redirigir.
    const partesUrl = window.location.pathname.split('/');
    const orderId = partesUrl[partesUrl.length - 1];

    const urlParams = new URLSearchParams(window.location.search);
    const resourcePath = urlParams.get('resourcePath');

    if (!resourcePath || !orderId) {
        mostrarError('No se recibió información del pago');
        return;
    }

    try {
        const respuesta = await fetch('/api/payment/verificar?' +
            new URLSearchParams({ orderId, resourcePath }));

        const datos = await respuesta.json();

        if (datos.ok) {
            mostrarAprobado(datos.datos);
        } else {
            mostrarRechazado(datos.datos);
        }

        mostrarJsonCompleto(datos.datos);
    } catch (error) {
        mostrarError('Error al verificar el pago');
    }
};

document.getElementById('btn-imprimir').addEventListener('click', () => window.print());

document.getElementById('btnCopiarJson').addEventListener('click', async () => {
    const texto = document.getElementById('jsonCompleto').textContent;
    try {
        await navigator.clipboard.writeText(texto);
        const boton = document.getElementById('btnCopiarJson');
        const original = boton.textContent;
        boton.textContent = '¡Copiado!';
        setTimeout(() => { boton.textContent = original; }, 1500);
    } catch (error) {
        // Si el navegador bloquea el portapapeles, igual el texto ya
        // está visible en el <pre> para seleccionar y copiar a mano.
    }
});

function mostrarJsonCompleto(datos) {
    if (!datos) return;
    document.getElementById('jsonCompleto').textContent = JSON.stringify(datos, null, 2);
    document.getElementById('jsonSoporte').style.display = 'block';
}

function mostrarAprobado(datos) {
    document.getElementById('icono').textContent = '✅';
    document.getElementById('titulo').textContent = '¡Pago exitoso!';
    document.getElementById('titulo').className = 'titulo-aprobado';
    document.getElementById('subtitulo').textContent = 'Tu pago fue procesado correctamente';
    llenarDetalles(datos);
}

function mostrarRechazado(datos) {
    document.getElementById('icono').textContent = '❌';
    document.getElementById('titulo').textContent = 'Pago rechazado';
    document.getElementById('titulo').className = 'titulo-rechazado';
    document.getElementById('subtitulo').textContent = 'Tu pago no pudo ser procesado. Intenta de nuevo.';
    llenarDetalles(datos);
}

function mostrarError(mensaje) {
    document.getElementById('icono').textContent = '⚠️';
    document.getElementById('titulo').textContent = 'Error';
    document.getElementById('titulo').className = 'titulo-rechazado';
    document.getElementById('subtitulo').textContent = mensaje;
}

function llenarDetalles(datos) {
    if (!datos) return;
    document.getElementById('detalles').style.display = 'block';
    document.getElementById('detalle-monto').textContent = `$${datos.amount} ${datos.currency}`;
    document.getElementById('detalle-authcode').textContent = datos.resultDetails?.AuthCode || '-';
    document.getElementById('detalle-referencia').textContent = datos.resultDetails?.ReferenceNbr || '-';
    document.getElementById('detalle-tarjeta').textContent = datos.card ? `**** **** **** ${datos.card.last4Digits}` : '-';
    const fecha = new Date(datos.timestamp);
    document.getElementById('detalle-fecha').textContent = fecha.toLocaleDateString('es-EC', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}