# voyavanzando.com — notas para Claude

> Ojo: este repo se publica entero en la web (GitHub Pages). Todo lo que se
> escriba acá —incluidas estas notas— se puede leer en internet. No poner
> datos personales, claves ni números de teléfono.

## Qué es este repo

- Sitio de **GitHub Pages** con dominio propio `voyavanzando.com` (archivo `CNAME`).
  Se publica desde la rama `main` (carpeta raíz). `.nojekyll` = se sirve tal cual.
- `index.html`: portada de la marca **Voy Avanzando** ("apps chiquitas para avanzar").
  Enlaza a `/elempujoncito/`, que vive en OTRO repo (no está acá).
- `decile/`: app **Decile**, asistente de voz para manejar las apps del teléfono
  hablando (ver abajo).

## Decile (carpeta `decile/`)

**Qué hace**: le hablás ("mandale un WhatsApp a Juan Gómez que diga hola amigo")
y te deja la acción lista en la app que corresponde (WhatsApp, llamada, SMS, mail,
mapas, música, YouTube, calendario, abrir apps, buscar). Vos confirmás con un toque.

**Cómo está hecha**
- HTML + CSS + JavaScript (módulos ES) **sin build, sin servidor y sin claves**.
- Es una **PWA**: se instala en la pantalla de inicio y abre sin internet.
- Los datos (contactos, ajustes, historial) quedan **solo en el teléfono** (localStorage).
- Voz: Web Speech API del navegador. Una frase por toque (`continuous=false`) y
  **nunca** reiniciar el dictado solo (en Android duplica palabras: lección de Amigo).
- Abre las apps con **enlaces** (wa.me, whatsapp://, tel:, sms:, mailto:, Google Maps,
  Waze, Spotify, YouTube, intent:// en Android). Ninguna web puede tocar "Enviar"
  dentro de otra app: por eso siempre hay un último toque del usuario.

**Archivos** (detalle en `decile/README.md`)
- `index.html`, `estilos.css`, `manifest.webmanifest`, `sw.js`, `iconos/`
- `js/texto.js` (normalizar texto), `js/parser.js` (entiende el pedido),
  `js/fechas.js` (fechas y horas en castellano), `js/contactos.js` (agenda y búsqueda
  aproximada), `js/telefono.js` (números para WhatsApp), `js/vcard.js` (importar .vcf),
  `js/apps.js` (catálogo de apps), `js/acciones.js` (arma los enlaces),
  `js/clima.js`, `js/voz.js`, `js/almacen.js`, `js/app.js` (pantalla)
- `tests/`: pruebas automáticas.

**Probar**
- Lógica: `cd decile && npm test` (usa `node --test`, sin instalar nada).
- Pantalla: `node decile/tests/e2e.mjs` (Playwright + Chromium ya instalados).

**Publicar**
- Hay que llevar los cambios a `main` (PR + merge). GitHub Pages actualiza solo.
- **Cada vez que cambie un archivo de `decile/`, subir `VERSION` en `decile/sw.js`**:
  si no, el teléfono sigue usando la copia vieja guardada.

## Reglas de trabajo (pedidas por el dueño)

- Explicaciones simples y en español.
- Probar cada cambio → commit → push. Commits chicos, por pasos, para poder volver atrás.
- Mantener al día: `CLAUDE.md` (lo hecho), `pendientes.md` (lo que sigue),
  `decisiones.md` (por qué se eligió cada cosa).
- Al cerrar sesión: actualizar esos 3 archivos y dejar el prompt de arranque en
  `prompt-proxima-sesion.md`.

## Historial

- **2026-11-17** — Arranque del proyecto Decile (ver detalle al cerrar la sesión).
