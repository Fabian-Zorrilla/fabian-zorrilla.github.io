# Prompt para retomar Decile (dentro de Amigo)

Copiá y pegá esto al abrir una sesión nueva en la compu:

---

Retomamos **Decile**, la parte de **Amigo** que maneja el teléfono con la voz (WhatsApp, llamadas, mapas,
música, abrir apps). Está **publicada** desde el 2026-11-17: funciona en el chat de Amigo y en la página `/voz`.

1. Conectate a la carpeta local del repo de Amigo (`asistente`) en esta compu. Si no la encontrás, preguntame la ruta.
2. Traé lo último de GitHub (`git pull` en `master`): el trabajo de Decile se hizo en la nube y la copia local está atrasada.
3. Leé el `CLAUDE.md` de Amigo (sección «Decile»), `pendientes.md` (punto 0 y «Próximas funciones») y el final de
   `decisiones.md`.
4. Si usás la memoria del proyecto (`proyecto-asistente.md`), sumale lo de Decile.
5. Mostrame los pendientes de Decile como **opciones numeradas** y preguntame con cuál seguimos. No programes hasta
   que elija.

Opciones que quedaron:
1. **Probarlo en mi Android y ajustar** lo que no abra bien (te cuento qué pasó; el enlace principal de cada app se
   cambia en `static/decile/js/acciones.js`).
2. **Manos libres**: conectar MacroDroid para que mande solo (link privado + toque automático, con cuenta regresiva
   para cancelar). Antes, decidir si alcanza con Gemini («Ok Google»).
3. **Que la IA de Amigo entienda** pedidos del teléfono dichos de cualquier forma, y «mandale un WhatsApp a [cliente]»
   buscando el teléfono en el CRM.
4. **Arreglar la barra de arriba del chat** en el celular (hoy 📚 y ＋ quedan cortados).
5. **La copia suelta de Decile** (repo `fabian-zorrilla.github.io`, carpeta `decile/`, rama `ccr-a4b94d12-9pm9w8`, sin
   publicar): publicarla en voyavanzando.com o archivarla.

Reglas: explicaciones simples y en español; código y commits en inglés (regla de Amigo). Probar cada cambio antes
de darlo por hecho: `AMIGO_DB_PATH=/tmp/amigo_test.db python test_decile.py`, `cd static/decile && node --test tests/*.test.js`
y, si hay Playwright, `node static/decile/tests/e2e-amigo.mjs`. Después commit chico y push (Render publica solo).
Nunca correr nada contra las bases reales: siempre `AMIGO_DB_PATH`. Al cerrar, seguí `CIERRE-DE-SESION.md`.

---
