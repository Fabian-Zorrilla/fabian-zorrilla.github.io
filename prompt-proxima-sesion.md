# Prompt para arrancar la próxima sesión

Copiá y pegá esto al abrir una sesión nueva:

---

Seguimos con **Decile**, mi asistente de voz para manejar las apps del teléfono
(PWA en la carpeta `decile/` del repo `Fabian-Zorrilla/fabian-zorrilla.github.io`,
sitio voyavanzando.com).

1. Si hace falta, conectate a la carpeta local del repo (o abrí/cloná el repo) y
   trabajá en la rama que te indique la sesión.
2. Leé `CLAUDE.md`, `pendientes.md` y `decisiones.md` (están en la raíz).
3. Mostrame los pendientes de `pendientes.md` como **opciones numeradas** y preguntame
   con cuál seguimos. No empieces a programar hasta que elija.

Reglas: explicaciones simples y en español. Probá cada cambio
(`cd decile && npm test` y `node tests/e2e.mjs`), después commit y push, por pasos
chicos. Si cambia algún archivo de la app, subí `VERSION` en `decile/sw.js`. Al cerrar,
actualizá `CLAUDE.md`, `pendientes.md` y `decisiones.md`.

Estado al cerrar la sesión anterior (2026-11-17): Decile v1 terminada y probada en la
rama `ccr-a4b94d12-9pm9w8`; falta publicarla (unir a `main`) y probarla en mi Android.

---
