# Pendientes — acciones a seguir

Al abrir una nueva sesión: presentar estas opciones numeradas para elegir con cuál seguir.
Lo principal ahora vive en **Amigo** (repo `Fabian-Zorrilla/asistente`); ver también su `pendientes.md`.

## 1. Publicar Decile dentro de Amigo (lo primero)
Unir la rama `ccr-a4b94d12-9pm9w8` del repo `asistente` a `main`. Render lo publica solo.
Necesita el OK del dueño.

## 2. Probarlo en el teléfono (Android) y ajustar
- Abrir Amigo → menú lateral → «🎙️ Manejar el teléfono con la voz» → Contactos → «Traer del teléfono».
  Poner apodos (mamá, etc.).
- Probar en el chat y en `/voz`: el WhatsApp del ejemplo, una llamada, «llevame a casa»,
  «poné música de…», «abrí Instagram».
- Anotar qué botón no abre bien su app. Si el enlace alternativo («¿No se abrió?») anda mejor,
  cambiar cuál es el principal en `static/decile/js/acciones.js` (Amigo) y en `decile/js/acciones.js` (acá).

## 3. Que la IA de Amigo entienda pedidos del teléfono dichos de cualquier forma
Una herramienta en `ai.py` que devuelva la misma tarjeta (la arma el teléfono con `acciones.js`).
Y «mandale un WhatsApp a [cliente]» buscando el teléfono en el CRM (embudo).

## 3b. Manos libres de verdad («que lo mande solo»)
Una web no puede tener permisos del sistema. Opciones (detalle en el `pendientes.md` de Amigo):
(1) Gemini / «Ok Google» — ya lo hace, sin programar; (2) MacroDroid como «manos» de Amigo (webhook +
toque automático en Enviar, con cuenta regresiva para cancelar); (3) app Android propia — no por ahora.
Esperando que el dueño elija.

## 4. Arreglar la barra de arriba del chat de Amigo en el celular
Hoy no entra (📚 y ＋ quedan cortados y la página se ensancha). Es anterior a Decile.

## 5. Versión suelta de Decile (este repo)
Decidir si se publica en voyavanzando.com/decile para todos (y si aparece en la portada) o se archiva.

## 6. Más acciones a pedido
Pedir Uber/Cabify con destino, más apps argentinas, notas/lista de compras, etc.
