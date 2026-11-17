# Decisiones tomadas

Cada decisión con su fecha y el motivo, en simple.

## 2026-11-17 — Decile (asistente de voz)

- **App web instalable (PWA) en vez de app nativa.** Se publica gratis en este
  sitio, sirve para Android y iPhone, y no hay que pasar por tiendas. Costo: una web
  no puede apretar "Enviar" dentro de WhatsApp ni cambiar ajustes del teléfono
  (linterna, alarmas, volumen). Por eso Decile deja todo listo y el último toque
  lo hace el usuario.
- **App aparte de Amigo.** Amigo (repo `asistente`, en Render) es el asistente con IA.
  Decile es independiente: anda sin internet, sin servidor y sin claves, y no corre
  el riesgo de romper Amigo. Más adelante se pueden conectar (ver pendientes).
- **Nombre "Decile" y carpeta `/decile/`.** Corto, rioplatense y distinto de "Amigo"
  y de "asistente" (así no se confunden en el teléfono).
- **Entender el pedido con reglas, sin IA (por ahora).** Gratis, instantáneo, privado
  y funciona sin conexión. La IA (Claude) queda como mejora opcional.
- **Siempre se confirma con un toque.** Evita mandar un mensaje a la persona
  equivocada si el reconocimiento de voz entendió mal, y los navegadores exigen
  un toque para abrir otra app.
- **Contactos propios de la app.** Una web no puede leer la agenda del teléfono sola.
  Se cargan: desde el teléfono (Android/Chrome, el usuario elige cuáles), con un
  archivo `.vcf` (iPhone o Google Contacts) o a mano. Se guardan solo en el teléfono.
- **Voz: una frase por toque, sin reinicio automático** (lección de Amigo: en Android
  reiniciar el dictado duplica palabras). Siempre se muestra el texto para revisarlo,
  y se puede escribir en lugar de hablar.
- **Idioma por defecto español de Argentina (`es-AR`) y código de país 54**,
  configurables en Ajustes.
- **Cómo se abre cada app**: en iPhone, WhatsApp con `whatsapp://` (más directo); en
  Android y PC con `wa.me` (el enlace oficial). Siempre hay un enlace alternativo
  («¿No se abrió? Probá de esta otra forma»); en Android, `intent://` que abre justo
  esa app o la web si no está instalada.
- **WhatsApp usa el número internacional** (Argentina: 54 9 + área + número, sin 0 ni
  15). **Llamadas y SMS usan el número tal como está guardado**, porque así marca igual
  que el teléfono (y no se rompen los fijos).
- **Alarmas y temporizadores**: una web no puede ponerlos; Decile ofrece un recordatorio
  en el calendario. «Despertador a las 6» se toma como 6 de la mañana; en el resto,
  «a las 5» se toma como 17:00 (lo más común al agendar).
- **Calendario**: Google Calendar (enlace con el evento cargado) y, además, archivo
  `.ics` para el calendario del teléfono (en iPhone se abre, en Android se descarga).
- **Clima con Open-Meteo**: gratis y sin claves; ubicación redondeada (~1 km) y solo
  cuando se pide.
- **Contactos repetidos** al importar: se juntan por nombre; los teléfonos se comparan
  por los últimos 8 dígitos.
- **No se enlaza desde la portada** por ahora (uso personal).
- **Pruebas automáticas sin instalar nada**: `node --test` para la lógica y el
  Chromium que ya trae el entorno para la pantalla (con micrófono simulado).
