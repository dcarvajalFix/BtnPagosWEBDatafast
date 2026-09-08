// La API key solo vive en memoria de esta pestaña (sessionStorage),
// nunca se hardcodea en el HTML ni se guarda de forma persistente.
const inputKey = document.getElementById('apiKey');
inputKey.value = sessionStorage.getItem('fixbtn_admin_key') || '';

document.getElementById('btnGenerar').addEventListener('click', generarLink);

async function generarLink() {
    const apiKey = inputKey.value.trim();
    const monto = document.getElementById('monto').value;
    const descripcion = document.getElementById('descripcion').value;

    const boton = document.getElementById('btnGenerar');
    const divResultado = document.getElementById('resultado');
    const divError = document.getElementById('error');
    divResultado.style.display = 'none';
    divError.style.display = 'none';

    if (!apiKey || !monto) {
        divError.textContent = 'Completa la API key y el monto.';
        divError.style.display = 'block';
        return;
    }

    sessionStorage.setItem('fixbtn_admin_key', apiKey);
    boton.disabled = true;

    try {
        const respuesta = await fetch('/api/payment/crear-link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
            },
            body: JSON.stringify({ monto, descripcion }),
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || !datos.ok) {
            divError.textContent = datos.mensaje || 'No se pudo generar el link.';
            if (datos.errores) {
                divError.textContent += ' ' + datos.errores.map(e => e.mensaje).join(', ');
            }
            divError.style.display = 'block';
            return;
        }

        divResultado.innerHTML =
            `Link generado (expira ${new Date(datos.expiraEn).toLocaleString('es-EC')}):<br>` +
            `<a href="${datos.link}" target="_blank">${datos.link}</a>`;
        divResultado.style.display = 'block';
    } catch (error) {
        divError.textContent = 'Error de conexión.';
        divError.style.display = 'block';
    } finally {
        boton.disabled = false;
    }
}