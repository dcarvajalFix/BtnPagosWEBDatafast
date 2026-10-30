/*
  ROLES Y PERMISOS
  -----------------
  Única fuente de verdad. El backend la usa para autorizar y el panel la
  muestra (por ejemplo, antes de convertir a alguien en administrador).
  Para agregar un permiso nuevo: se define aquí y se asigna al rol.
*/

const PERMISOS = {
    'cuenta:password': 'Cambiar su propia contraseña',
    'link:crear': 'Generar links de pago',
    'transacciones:ver': 'Ver todas las transacciones',
    'pago:anular': 'Anular / reembolsar pagos',
    'usuarios:gestionar': 'Crear, desactivar y resetear contraseñas de usuarios',
    'usuarios:rol': 'Cambiar el rol de otros usuarios',
    'actividad:ver': 'Ver el registro de actividad del sistema',
};

const PERMISOS_EMPLEADO = ['cuenta:password', 'link:crear', 'transacciones:ver'];

const ROLES = {
    empleado: {
        etiqueta: 'Empleado',
        descripcion: 'Genera links de pago y consulta las transacciones.',
        permisos: PERMISOS_EMPLEADO,
    },
    admin: {
        etiqueta: 'Administrador',
        descripcion: 'Todo lo del empleado, más anulaciones y gestión de usuarios.',
        permisos: Object.keys(PERMISOS),
    },
};

function rolValido(rol) {
    return typeof rol === 'string' && Object.prototype.hasOwnProperty.call(ROLES, rol);
}

function permisosDe(rol) {
    return rolValido(rol) ? ROLES[rol].permisos : [];
}

function tienePermiso(rol, permiso) {
    return permisosDe(rol).includes(permiso);
}

/** Versión serializable para el frontend (con las etiquetas legibles). */
function catalogo() {
    const roles = {};
    for (const [clave, rol] of Object.entries(ROLES)) {
        roles[clave] = {
            etiqueta: rol.etiqueta,
            descripcion: rol.descripcion,
            permisos: rol.permisos.map((p) => ({ clave: p, etiqueta: PERMISOS[p] })),
        };
    }
    return { roles, permisos: PERMISOS };
}

module.exports = { PERMISOS, ROLES, rolValido, permisosDe, tienePermiso, catalogo };