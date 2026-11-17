# Prompt para arrancar la próxima sesión

Copiá y pegá esto al abrir una sesión nueva:

---

Seguimos con **Decile**, la parte de **Amigo** que maneja el teléfono con la voz (WhatsApp, llamadas,
mapas, música, abrir apps). Vive en el repo `Fabian-Zorrilla/asistente` (Amigo): en el chat y en la
página `/voz`. Hay una copia suelta sin publicar en `Fabian-Zorrilla/fabian-zorrilla.github.io` (`decile/`).

1. Si hace falta, conectate a la carpeta local del repo de Amigo (o abrí/cloná el repo) y usá la rama
   que te indique la sesión (el trabajo de Decile está en `ccr-a4b94d12-9pm9w8`).
2. Leé el `CLAUDE.md` de Amigo (sección «Decile»), su `pendientes.md` y su `decisiones.md`; y el
   `pendientes.md` del repo del sitio.
3. Mostrame los pendientes como **opciones numeradas** y preguntame con cuál seguimos. No empieces a
   programar hasta que elija.

Reglas: explicaciones simples y en español. Probá cada cambio (en Amigo:
`AMIGO_DB_PATH=/tmp/amigo_test.db python test_decile.py`, `cd static/decile && node --test tests/*.test.js`
y `node static/decile/tests/e2e-amigo.mjs`), después commit y push, por pasos chicos. Nunca correr nada
contra las bases reales (usar siempre `AMIGO_DB_PATH`). Al cerrar, actualizá `CLAUDE.md`, `pendientes.md`
y `decisiones.md`.

Estado al cerrar la sesión anterior (2026-11-17): Decile terminado y probado dentro de Amigo, en la rama
`ccr-a4b94d12-9pm9w8`; falta publicarlo (unir a `main`) y probarlo en mi Android.

---
