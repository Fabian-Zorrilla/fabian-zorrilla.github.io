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
