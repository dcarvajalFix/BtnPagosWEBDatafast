# FixBtnPagos

Botón de pagos de FixGroup sobre Datafast (DataWeb). Flujo actual: **link de
pago con monto fijo** — el equipo genera un link desde `admin.html`, se lo
manda al cliente, y el cliente paga en `checkout.html` sin poder alterar el
monto.

## Arquitectura

```
src/
  core/                     <- Reutilizable. Una vez certificado con
    config/env.js              Datafast, esto no debería volver a tocarse.
    services/datafastService.js
    middleware/ (apiKeyAuth, rateLimit, errorHandler)
    validators/paymentValidators.js

  features/
    payment-link/           <- Caso de uso actual: links con monto fijo.
      orderStore.js             Si mañana necesitan otra forma de usar el
      paymentLinkController.js  botón (ej. integrarlo directo en otra
      paymentLinkRoutes.js      plataforma), se agrega OTRA carpeta acá
                                 que reutiliza src/core, sin tocarlo.
  index.js
```

**Por qué esta separación:** una vez que Datafast certifique el flujo de
producción, la idea es no volver a tocar `src/core` (evita el riesgo de
romper algo certificado). Cualquier caso de uso nuevo se agrega como una
`feature/` nueva que reutiliza `core/`.

## Flujo

1. Alguien del equipo abre `/admin.html`, mete la `ADMIN_API_KEY`, pone el
   monto y una descripción → `POST /api/payment/crear-link`.
2. Se genera un link `/pagar/{orderId}` con el monto **guardado en el
   servidor** (no en la URL, no editable por quien lo recibe).
3. El cliente abre el link, llena sus datos (exigidos por Datafast en Fase
   2) y paga → `POST /api/payment/crear-checkout` (usa el monto de la
   orden, ignora cualquier monto que llegue del navegador).
4. Datafast redirige a `/resultado/{orderId}?resourcePath=...` →
   `GET /api/payment/verificar` valida que el `resourcePath` corresponda a
   esa orden antes de consultar el estado.

## Variables de entorno

Ver `.env.example`. Nunca commitear `.env`.

## Antes de pasar a producción (checklist, según Anexo I del PDF de Datafast)

- [ ] Cambiar `DATAFAST_URL` de `eu-test.oppwa.com` a `eu-prod.oppwa.com`
      (también está hardcodeado en la CSP de `src/index.js` — ya incluye
      ambos dominios, no hace falta tocarlo).
- [ ] Confirmar que `DATAFAST_TEST_MODE` esté en `FALSE` o ausente — el
      código ya omite el parámetro `testMode` por completo cuando
      `config.datafast.testMode` es `false` (no lo manda vacío).
- [ ] Reemplazar `DATAFAST_ENTITY_ID`, `DATAFAST_BEARER_TOKEN`, `MID`, `TID`
      por las credenciales de producción que da Datafast.
- [ ] Rotar `ADMIN_API_KEY` a un valor nuevo para producción.
- [ ] Definir `ALLOWED_ORIGINS` solo si algún frontend externo va a llamar
      la API directo (cross-origin). Si el checkout siempre se sirve desde
      este mismo dominio, dejarlo vacío.
- [ ] Coordinar con Datafast fecha/hora de la primera transacción real
      (mínimo $1.00), como pide el documento — no probar en producción sin
      avisarles.
- [ ] Después de esto, evitar tocar `src/core/*`. Cambios de negocio van en
      `src/features/*`.

## Qué se corrigió en esta revisión (resumen para referencia futura)

- El monto ya no lo controla el navegador (antes: `req.body.monto` directo).
- `/verificar` ya no permite consultar transacciones ajenas (antes:
  `resourcePath` sin validar → IDOR).
- `/crear-link` y `/anular` ahora requieren `x-api-key` (antes: abiertos a
  cualquiera).
- Se agregaron los campos obligatorios de Fase 2 (`customer.*`,
  `billing.*`, `merchantTransactionId`, `risk.parameters`) que faltaban.
- `testMode` ya no se manda como el string `"undefined"` cuando falta la
  env var.
- Se quitaron los `console.log` de credenciales.
- Los errores devueltos al cliente ya no incluyen `error.message` crudo.
- Se agregó `helmet` (CSP, headers de seguridad) y `express-rate-limit`.
- Validación de entrada con `zod` en todos los endpoints.
