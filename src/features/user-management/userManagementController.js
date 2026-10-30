const { z } = require('zod');
const { auditar } = require('../../shared/eventos');

const crearSchema = z.object({
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,32}$/, 'Usuario de 3 a 32 caracteres: letras, números, punto, guion o guion bajo'),
});

const rolSchema = z.object({
    rol: z.string(),
    confirmar: z.literal(true, { error: 'Falta la confirmación del cambio de rol' }),
});

const activoSchema = z.object({
    activo: z.boolean(),
});

function idDeParams(req) {
    const id = Number.parseInt(req.params.id, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function publico(usuario) {
    return {
        id: usuario.id,
        username: usuario.username,
        rol: usuario.rol,
        activo: usuario.activo,
        debeCambiarPassword: usuario.debeCambiarPassword,
        ultimoLoginEn: usuario.ultimoLoginEn,
        creadoEn: usuario.creadoEn,
        creadoPor: usuario.creadoPor,
    };
}

function listar(req, res) {
    const { usuarios } = req.app.locals.auth;
    res.json({
        ok: true,
        usuarios: usuarios.listar().map(publico),
        yo: req.usuario.id,
    });
}

function catalogoRoles(req, res) {
    res.json({ ok: true, ...req.app.locals.auth.permisos.catalogo() });
}

async function crear(req, res, next) {
    try {
        const { usuarios, servicio } = req.app.locals.auth;
        const parsed = crearSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, mensaje: parsed.error.issues[0].message });
        }
        const { username } = parsed.data;

        if (usuarios.obtenerFilaPorUsername(username)) {
            return res.status(409).json({ ok: false, mensaje: 'Ya existe un usuario con ese nombre' });
        }

        const passwordTemporal = servicio.generarPasswordTemporal();
        const usuario = usuarios.crear({
            username,
            passwordHash: await servicio.hashear(passwordTemporal),
            rol: 'empleado', // todos nacen como empleado; el ascenso es un paso aparte y confirmado
            creadoPor: req.usuario.username,
            debeCambiarPassword: true,
        });

        auditar(req, 'usuario_creado', { usuario: usuario.username });
        // La contraseña temporal se muestra UNA sola vez y nunca se audita.
        res.status(201).json({ ok: true, usuario: publico(usuario), passwordTemporal });
    } catch (error) {
        next(error);
    }
}

function cambiarRol(req, res) {
    const { usuarios, permisos } = req.app.locals.auth;
    const id = idDeParams(req);
    const parsed = rolSchema.safeParse(req.body);

    if (!id || !parsed.success) {
        return res.status(400).json({ ok: false, mensaje: 'Datos inválidos o falta confirmar el cambio' });
    }
    if (!permisos.rolValido(parsed.data.rol)) {
        return res.status(400).json({ ok: false, mensaje: 'Rol inválido' });
    }
    if (id === req.usuario.id) {
        return res.status(400).json({ ok: false, mensaje: 'No puedes cambiar tu propio rol' });
    }

    const resultado = usuarios.cambiarRol(id, parsed.data.rol);
    if (!resultado.ok) return respuestaDeError(res, resultado.codigo);

    auditar(req, 'usuario_rol', {
        usuario: resultado.usuario.username,
        de: resultado.anterior,
        a: resultado.usuario.rol,
    });
    res.json({ ok: true, usuario: publico(resultado.usuario) });
}

function cambiarActivo(req, res) {
    const { usuarios } = req.app.locals.auth;
    const id = idDeParams(req);
    const parsed = activoSchema.safeParse(req.body);

    if (!id || !parsed.success) {
        return res.status(400).json({ ok: false, mensaje: 'Datos inválidos' });
    }
    if (id === req.usuario.id) {
        return res.status(400).json({ ok: false, mensaje: 'No puedes desactivar tu propia cuenta' });
    }

    const resultado = usuarios.cambiarActivo(id, parsed.data.activo);
    if (!resultado.ok) return respuestaDeError(res, resultado.codigo);

    auditar(req, parsed.data.activo ? 'usuario_activado' : 'usuario_desactivado', {
        usuario: resultado.usuario.username,
    });
    res.json({ ok: true, usuario: publico(resultado.usuario) });
}

async function resetearPassword(req, res, next) {
    try {
        const { usuarios, servicio } = req.app.locals.auth;
        const id = idDeParams(req);
        if (!id) return res.status(400).json({ ok: false, mensaje: 'Datos inválidos' });

        if (id === req.usuario.id) {
            return res.status(400).json({ ok: false, mensaje: 'Para cambiar tu propia contraseña usa "Mi contraseña"' });
        }

        const objetivo = usuarios.obtenerPorId(id);
        if (!objetivo) return respuestaDeError(res, 'NO_EXISTE');

        const passwordTemporal = servicio.generarPasswordTemporal();
        usuarios.establecerPassword(id, await servicio.hashear(passwordTemporal), true);

        auditar(req, 'password_reseteada', { usuario: objetivo.username });
        res.json({ ok: true, usuario: objetivo.username, passwordTemporal });
    } catch (error) {
        next(error);
    }
}

function respuestaDeError(res, codigo) {
    if (codigo === 'NO_EXISTE') return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
    if (codigo === 'ULTIMO_ADMIN') {
        return res.status(409).json({
            ok: false,
            mensaje: 'Debe quedar al menos un administrador activo. Primero asigna el rol a otra persona.',
        });
    }
    return res.status(400).json({ ok: false, mensaje: 'No se pudo completar la acción' });
}

module.exports = { listar, catalogoRoles, crear, cambiarRol, cambiarActivo, resetearPassword };