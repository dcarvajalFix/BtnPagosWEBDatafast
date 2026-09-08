document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();

    const boton = document.getElementById('btnLogin');
    const divError = document.getElementById('error');
    divError.style.display = 'none';
    boton.disabled = true;

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
        const respuesta = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const datos = await respuesta.json();

        if (datos.ok) {
            window.location.href = '/panel';
        } else {
            divError.textContent = datos.mensaje || 'No se pudo iniciar sesión';
            divError.style.display = 'block';
        }
    } catch (error) {
        divError.textContent = 'Error de conexión';
        divError.style.display = 'block';
    } finally {
        boton.disabled = false;
    }
});