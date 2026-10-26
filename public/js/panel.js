let paginaActual = 1;

async function verificarSesion() {
    const respuesta = await fetch('/api/admin/sesion');
    if (!respuesta.ok) {
        window.location.href = '/login';
        return;
    }
    const datos = await respuesta.json();
    document.getElementById('usuarioActual').textContent = datos.usuario;
}

async function cargarTransacciones() {
    document.getElementById('cargando').style.display = 'block';
    document.getElementById('tabla').style.display = 'none';
    document.getElementById('vacio').style.display = 'none';
    document.getElementById('paginacion').style.display = 'none';

    const estado = document.getElementById('filtroEstado').value;
    const params = new URLSearchParams({ pagina: paginaActual, porPagina: 25 });
    if (estado) params.set('estado', estado);

    try {
        const respuesta = await fetch(`/api/admin/transacciones?${params}`);

        if (respuesta.status === 401) {
            window.location.href = '/login';
            return;
        }

        const datos = await respuesta.json();
        document.getElementById('cargando').style.display = 'none';

        if (datos.ordenes.length === 0) {
            document.getElementById('vacio').style.display = 'block';
            return;
        }

        pintarTabla(datos.ordenes);
        pintarPaginacion(datos);
        document.getElementById('tabla').style.display = 'table';
        document.getElementById('paginacion').style.display = 'flex';
    } catch (error) {
        document.getElementById('cargando').textContent = 'Error al cargar transacciones.';
    }
}

function pintarTabla(ordenes) {
    const cuerpo = document.getElementById('cuerpoTabla');
    cuerpo.innerHTML = '';

    for (const orden of ordenes) {
        const fila = document.createElement('tr');

        const fecha = new Date(orden.creadoEn).toLocaleString('es-EC', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });

        fila.innerHTML = `
            <td>${fecha}</td>
            <td>${escaparHtml(orden.descripcion || '-')}</td>
            <td>$${orden.monto} ${orden.moneda}</td>
            <td><span class="badge badge-${orden.estado}">${orden.estado}</span></td>
            <td><code>${orden.orderId}</code></td>
        `;
        cuerpo.appendChild(fila);
    }
}

function pintarPaginacion(datos) {
    document.getElementById('infoPagina').textContent = `Página ${datos.pagina} de ${datos.totalPaginas} (${datos.total} en total)`;
    document.getElementById('btnAnterior').disabled = datos.pagina <= 1;
    document.getElementById('btnSiguiente').disabled = datos.pagina >= datos.totalPaginas;
}

function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

document.getElementById('filtroEstado').addEventListener('change', () => {
    paginaActual = 1;
    cargarTransacciones();
});

document.getElementById('btnAnterior').addEventListener('click', () => {
    if (paginaActual > 1) {
        paginaActual -= 1;
        cargarTransacciones();
    }
});

document.getElementById('btnSiguiente').addEventListener('click', () => {
    paginaActual += 1;
    cargarTransacciones();
});

document.getElementById('btnLogout').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/login';
});

verificarSesion();
cargarTransacciones();