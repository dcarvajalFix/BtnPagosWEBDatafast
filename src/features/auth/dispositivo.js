/*
  DESCRIPCIÓN DE DISPOSITIVO
  ---------------------------
  A partir del User-Agent devuelve un texto corto, ej. "Chrome en Windows" o
  "Safari en iPhone". Solo identifica navegador y sistema: el modelo exacto
  del equipo no lo expone el navegador (y no se intenta adivinar).
*/

function describirDispositivo(userAgent) {
    const ua = String(userAgent || '').slice(0, 512);
    if (!ua) return 'Navegador desconocido';

    // El orden importa: Edge, Opera y Samsung también dicen "Chrome" en su UA.
    let navegador = 'Navegador desconocido';
    if (/Edg(e|A|iOS)?\//.test(ua)) navegador = 'Edge';
    else if (/OPR\/|Opera/.test(ua)) navegador = 'Opera';
    else if (/SamsungBrowser\//.test(ua)) navegador = 'Samsung Internet';
    else if (/Firefox\/|FxiOS\//.test(ua)) navegador = 'Firefox';
    else if (/Chrome\/|CriOS\//.test(ua)) navegador = 'Chrome';
    else if (/Safari\//.test(ua) && /Version\//.test(ua)) navegador = 'Safari';

    let sistema = null;
    if (/iPhone/.test(ua)) sistema = 'iPhone';
    else if (/iPad/.test(ua)) sistema = 'iPad';
    else if (/Android/.test(ua)) sistema = 'Android';
    else if (/Windows/.test(ua)) sistema = 'Windows';
    else if (/CrOS/.test(ua)) sistema = 'ChromeOS';
    else if (/Mac OS X|Macintosh/.test(ua)) sistema = 'macOS';
    else if (/Linux/.test(ua)) sistema = 'Linux';

    return sistema ? `${navegador} en ${sistema}` : navegador;
}

module.exports = { describirDispositivo };