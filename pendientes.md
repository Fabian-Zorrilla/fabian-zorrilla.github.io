# Pendientes — acciones a seguir

Al abrir una nueva sesión: presentar estas opciones numeradas para elegir con cuál seguir.

## 1. Publicar Decile (lo primero)
Unir la rama `ccr-a4b94d12-9pm9w8` a `main` (PR + merge). GitHub Pages la publica
sola en **https://voyavanzando.com/decile/**. Necesita el OK del dueño.

## 2. Probarla en el teléfono (Android) y ajustar
- Abrir la dirección en Chrome → «Instalar app» → dar permiso al micrófono.
- Cargar contactos («Traer del teléfono») y poner apodos (mamá, etc.).
- Probar: el ejemplo del WhatsApp, una llamada, «llevame a casa», «poné música de…»,
  «recordame… mañana a las 10», «¿cómo está el clima?».
- Anotar qué botón no abre bien la app. Si el enlace alternativo («¿No se abrió?»)
  anda mejor, cambiar cuál es el principal en `js/acciones.js`.
- Revisar en el teléfono: archivo de calendario (.ics), Waze, Spotify y los enlaces
  `intent://` de Android.

## 3. Modo IA opcional (Claude) para frases libres
Para que entienda cualquier forma de pedir. Opciones: (a) clave propia guardada en el
teléfono, o (b) un pequeño servicio con la clave del lado del servidor (podría vivir
en Amigo/Render). La IA solo propondría la tarjeta: siempre se confirma con un toque.
Modelo por defecto: `claude-opus-5-5` (ver skill claude-api antes de programarlo).

## 4. Conectar con Amigo
Por ejemplo: un comando «anotá en Amigo…» que abra Amigo con el texto, o un botón en
Amigo que abra Decile. Ver qué conviene en el repo `asistente`.

## 5. Decidir si Decile aparece en la portada de voyavanzando.com
Hoy no está enlazada (es de uso personal). Si se publica para todos, agregar la
tarjeta en `index.html` de la raíz.

## 6. Más acciones a pedido
Ideas: pedir Uber/Cabify con destino, más apps argentinas, lista de compras/notas
dentro de Decile, leer en voz alta la respuesta del clima siempre, etc.

## 7. iPhone (si se usa)
Guía para crear Atajos (alarma, linterna, modos) y llamarlos desde «Mis comandos».
