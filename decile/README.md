# Decile — asistente de voz para tus apps

Le hablás al teléfono y Decile te deja lista la acción en la app que corresponde.

> «Enviale un WhatsApp a Juan Gómez que diga hola amigo» → se abre WhatsApp en el
> chat de Juan con «Hola amigo.» escrito. Vos solo tocás **enviar**.

Dirección (una vez publicada): **https://voyavanzando.com/decile/**

## Cómo se usa

1. Abrí Decile y tocá el micrófono (o escribí el pedido).
2. Mirá la tarjeta: muestra lo que entendió. Podés corregir el mensaje.
3. Tocá el botón grande: se abre la app con todo listo.

La primera vez, cargá tus contactos (botón 👥): desde el teléfono (Android),
con un archivo `.vcf` (iPhone o Google Contacts) o a mano. Podés ponerles
apodos («mamá», «el gordo»).

### Instalarla como app
- **Android (Chrome):** menú ⋮ → «Instalar app» (o el botón «Instalar» que aparece en Decile).
- **iPhone (Safari):** botón Compartir → «Agregar a inicio».
- Tip: mantené apretado el ícono → «Hablar ahora» abre escuchando.

## Qué entiende

| Tipo | Ejemplos |
|---|---|
| WhatsApp, SMS, mail, Telegram | «Mandale un WhatsApp a Juan que diga hola» · «Decile a mamá que llego en 10» · «Mandale un SMS a Pedro: ya salgo» · «Mandale un mail a Laura con asunto reunión diciendo que confirmo» · «Mandale mi ubicación a mamá» |
| Llamadas | «Llamá a Juan» · «Llamá al 11 2345 6789» · «Llamá a mamá por WhatsApp» |
| Mapas | «Llevame a casa» · «¿Cómo llego al Obelisco?» · «Llevame al trabajo con Waze» · «¿Dónde hay una farmacia?» |
| Música y videos | «Poné música de Soda Stereo» · «Reproducí Cerati en Spotify» · «Buscá recetas de pizza en YouTube» |
| Agenda | «Recordame llamar al dentista mañana a las 10» · «Agendá reunión con Pedro el viernes a las 15» |
| Apps | «Abrí Instagram» · «Abrí Mercado Pago» · «Abrí el chat de Juan» |
| Preguntas | «¿Qué hora es?» · «¿Va a llover mañana?» · «¿Quién ganó el partido?» (Google) |
| Contactos | «Agregá el contacto Juan Gómez con el número 11 2345 6789» |
| Mis comandos | Frases propias que abren cualquier enlace (Ajustes → Mis comandos) |

## Límites (y por qué)

- **No aprieta «Enviar» por vos.** Ningún teléfono deja que una página web toque
  botones de otras apps. Decile deja todo listo y vos confirmás.
- **No cambia ajustes del teléfono** (linterna, volumen, wifi, alarmas). Para
  alarmas ofrece un recordatorio en el calendario. En iPhone se pueden sumar con
  «Mis comandos» + Atajos (`shortcuts://run-shortcut?name=…`).
- **No lee mensajes ni notificaciones.**

## Privacidad

- Contactos, ajustes e historial quedan **solo en el teléfono** (localStorage).
  No hay servidor ni cuentas.
- El dictado lo hace el navegador (Google en Android, Apple en iPhone).
- El clima usa Open-Meteo con la ubicación aproximada, solo cuando se pide.

---

## Para desarrollar

Sin build ni dependencias: HTML + CSS + JavaScript (módulos ES).

```
decile/
  index.html, estilos.css, manifest.webmanifest, sw.js, iconos/
  js/
    app.js        pantalla (micrófono, tarjetas, contactos, ajustes)
    parser.js     entiende el pedido → intención
    acciones.js   intención → tarjeta con enlaces (wa.me, tel:, Maps, Spotify…)
    contactos.js  agenda y búsqueda aproximada
    telefono.js   números para WhatsApp (Argentina: 54 9 + área + número)
    fechas.js     fechas y horas en castellano
    apps.js       catálogo de apps que sabe abrir
    vcard.js      leer archivos .vcf
    voz.js        dictado y voz sintética
    clima.js      pronóstico (Open-Meteo)
    almacen.js    guardado local y copias de seguridad
  tests/          pruebas
```

- Probar la lógica: `npm test` (usa `node --test`).
- Probar en el navegador: `node tests/e2e.mjs` (Playwright + Chromium).
  Con `CAPTURAS=/carpeta node tests/e2e.mjs` guarda capturas de pantalla.
- Correr local: desde la raíz del repo, `python3 -m http.server` y abrir
  `http://localhost:8000/decile/`.
- **Al publicar cambios, subir `VERSION` en `sw.js`** (si no, los teléfonos siguen
  con la versión guardada).
- Atajos útiles: `?q=texto` hace el pedido directo; `?escuchar=1` abre escuchando.
