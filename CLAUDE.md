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

## Estado actual

- **Decile se mudó a Amigo** (repo privado `Fabian-Zorrilla/asistente`, rama `ccr-a4b94d12-9pm9w8`):
  ahí está la versión que se va a usar, en el chat y en la página `/voz`. Ver el `CLAUDE.md` de ese repo.
- Esta versión suelta (`decile/`) queda como respaldo, en la rama `ccr-a4b94d12-9pm9w8` de este repo,
  **sin publicar** (`voyavanzando.com/decile/` da 404). Si algún día se quiere ofrecer a todos desde la
  marca, está lista: unir la rama a `main`.
- La lógica es la misma en los dos lados (`js/parser.js`, `js/acciones.js`, etc.). Si se mejora en Amigo,
  copiar los módulos acá antes de publicar esta versión.

## Trampas conocidas (no re-descubrir)

- En formularios, `form.id` devuelve el id del propio formulario: los campos ocultos
  se llaman `cid` y se leen con `form.elements.cid`.
- Listas con `display: grid` y textos largos: usar `grid-template-columns: minmax(0, 1fr)`
  o se ensancha la página (scroll horizontal en el teléfono).
- Las capturas de Playwright salen "apagadas" si se toman durante la animación de la
  tarjeta: esperar ~350 ms.
- Desde este entorno de Claude la API del clima (open-meteo.com) está bloqueada por la
  red: se prueba con respuestas simuladas (`tests/clima.test.js`). En el teléfono anda.
- Llamadas y SMS usan el número **tal como está guardado** (marca igual que el
  teléfono); WhatsApp usa el formato internacional (54 9 + área + número).

## Historial

- **2026-11-17** — Se creó Decile v1 desde cero:
  - Parser en castellano (voseo y tuteo, con o sin tildes, puntuación del dictado):
    mensajes (WhatsApp/SMS/mail/Telegram, ubicación, audios), llamadas, agenda y
    recordatorios, mapas y navegación (casa/trabajo, Waze, modos), música, YouTube,
    abrir ~35 apps, búsquedas y preguntas, hora/fecha/clima, contactos, comandos propios,
    y respuestas honestas para lo que una web no puede (alarmas → recordatorio).
  - Contactos: búsqueda aproximada (errores del dictado), apodos, importar desde el
    teléfono (Android) o `.vcf`, elegir cuando hay varios, agregar al vuelo.
  - Pantalla: micrófono + texto, tarjeta editable, historial, ajustes, ayuda, modo
    oscuro, PWA instalable que anda sin internet.
  - Pruebas: 32 de lógica (`npm test`) + 17 pasos en Chromium con micrófono simulado
    (`node tests/e2e.mjs`).
  - Commits: notas → lógica + pruebas → pantalla + PWA → notas finales.
  - Después, a pedido del dueño («colocarlo dentro de la app de Amigo»), se metió en Amigo: el chat
    resuelve los pedidos del teléfono antes de ir a la IA, y `/voz` tiene la pantalla de Decile.
