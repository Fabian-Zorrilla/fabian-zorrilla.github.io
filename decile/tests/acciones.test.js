// Pruebas de las tarjetas y los enlaces que abren cada app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarTarjeta, crearICS, detectarPlataforma, enlaceAbrirApp } from '../js/acciones.js';
import { interpretar } from '../js/parser.js';
import { appPorId } from '../js/apps.js';

const AHORA = new Date(2026, 10, 17, 10, 0);
const CONTACTOS = [
  { id: 'a', nombre: 'Juan Gómez', alias: [], telefonos: ['+54 9 11 2345-6789'], emails: [] },
  { id: 'b', nombre: 'Juan Pérez', alias: [], telefonos: ['011 15 4444-5555'], emails: [] },
  { id: 'c', nombre: 'Mamá', alias: ['vieja'], telefonos: ['0294 15 412-3456'], emails: [] },
  { id: 'd', nombre: 'Laura Fernández', alias: [], telefonos: ['1133334444'], emails: ['laura@example.com'] },
];
const ctx = (plataforma = 'otro', ajustes = {}) => ({ contactos: CONTACTOS, ajustes: { codigoPais: '54', ...ajustes }, plataforma, ahora: AHORA, zona: 'America/Argentina/Buenos_Aires' });
const tarjeta = (frase, c = ctx()) => armarTarjeta(interpretar(frase, c), c);

test('el ejemplo: WhatsApp a Juan Gómez con "Hola amigo."', () => {
  const frase = 'Enviale un WhatsApp a Juan Gómez qué diga. Hola amigo.';
  const otro = tarjeta(frase);
  assert.equal(otro.titulo, 'WhatsApp para Juan Gómez');
  assert.equal(otro.detalle, '+54 9 11 2345-6789');
  assert.equal(otro.editables[0].valor, 'Hola amigo.');
  assert.equal(otro.botones[0].href, 'https://wa.me/5491123456789?text=Hola%20amigo.');
  assert.equal(otro.decir, 'WhatsApp para Juan Gómez: Hola amigo.');
  const ios = tarjeta(frase, ctx('ios'));
  assert.equal(ios.botones[0].href, 'whatsapp://send?phone=5491123456789&text=Hola%20amigo.');
  assert.equal(ios.botones[0].alt, 'https://wa.me/5491123456789?text=Hola%20amigo.');
  const android = tarjeta(frase, ctx('android'));
  assert.equal(android.botones[0].href, 'https://wa.me/5491123456789?text=Hola%20amigo.');
  assert.ok(android.botones[0].alt.startsWith('intent://send?phone=5491123456789&text=Hola%20amigo.#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=https%3A%2F%2Fwa.me%2F'));
});

test('si no encuentra al contacto, ofrece elegir', () => {
  const t = tarjeta('mandale un whatsapp a Roberto que diga hola');
  assert.equal(t.elegir.motivo, 'ninguno');
  assert.equal(t.botones[0].href, 'https://wa.me/?text=Hola');
  const v = tarjeta('mandale un whatsapp a Juan que diga hola');
  assert.equal(v.elegir.motivo, 'varios');
  assert.deepEqual(v.elegir.candidatos.map((c) => c.nombre), ['Juan Gómez', 'Juan Pérez']);
  const elegido = armarTarjeta({ ...interpretar('mandale un whatsapp a Juan que diga hola', ctx()), contactoId: 'b' }, ctx());
  assert.equal(elegido.botones[0].href, 'https://wa.me/5491144445555?text=Hola');
  const falta = tarjeta('mandá un whatsapp');
  assert.equal(falta.elegir.motivo, 'falta');
});

test('llamadas, SMS y mail', () => {
  assert.equal(tarjeta('llamá a Juan Gómez').botones[0].href, 'tel:+5491123456789');
  assert.equal(tarjeta('llamá a mamá').botones[0].href, 'tel:0294154123456');
  assert.equal(tarjeta('llamá al 911').botones[0].href, 'tel:911');
  assert.match(tarjeta('llamá a mamá por WhatsApp').botones[0].href, /^https:\/\/wa\.me\/5492944123456$/);
  assert.equal(tarjeta('mandale un SMS a mamá: llego a las 8', ctx('ios')).botones[0].href, 'sms:0294154123456&body=Llego%20a%20las%208');
  assert.equal(tarjeta('mandale un SMS a mamá: llego a las 8', ctx('android')).botones[0].href, 'sms:0294154123456?body=Llego%20a%20las%208');
  const mail = tarjeta('mandale un mail a Laura con asunto reunión diciendo que confirmo');
  assert.equal(mail.botones[0].href, 'mailto:laura@example.com?subject=reuni%C3%B3n&body=Confirmo');
  assert.ok(mail.botones[0].alt.startsWith('https://mail.google.com/mail/?view=cm&fs=1&to=laura%40example.com'));
});

test('mapas: lugares guardados y apps', () => {
  const sinCasa = tarjeta('llevame a casa');
  assert.equal(sinCasa.botones[0].accion.pantalla, 'ajustes');
  const conCasa = tarjeta('llevame a casa', ctx('otro', { casa: 'Mitre 100, Bariloche' }));
  assert.equal(conCasa.botones[0].href, 'https://www.google.com/maps/dir/?api=1&destination=Mitre%20100%2C%20Bariloche&travelmode=driving');
  assert.equal(tarjeta('llevame al Obelisco con Waze').botones[0].href, 'https://waze.com/ul?q=Obelisco&navigate=yes');
  assert.equal(tarjeta('¿Dónde hay una farmacia?').botones[0].href, 'https://www.google.com/maps/search/?api=1&query=farmacia');
});

test('calendario: Google Calendar y archivo .ics', () => {
  const t = tarjeta('Recordame llamar al dentista mañana a las 10');
  assert.equal(t.titulo, 'Llamar al dentista');
  assert.equal(t.detalle, 'Mañana a las 10:00');
  assert.equal(t.botones[0].href, 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Llamar%20al%20dentista&dates=20261118T100000/20261118T103000&ctz=America%2FArgentina%2FBuenos_Aires&details=Creado%20con%20Decile');
  assert.ok(t.botones[1].href.startsWith('data:text/calendar;charset=utf-8,'));
  const ics = crearICS({ titulo: 'Cumple, mamá', fecha: new Date(2027, 2, 3).toISOString(), conHora: false }, AHORA);
  assert.match(ics, /DTSTART;VALUE=DATE:20270303\r\nDTEND;VALUE=DATE:20270304/);
  assert.match(ics, /SUMMARY:Cumple\\, mamá/);
});

test('música, YouTube, búsquedas y apps', () => {
  assert.equal(tarjeta('Poné música de Soda Stereo').botones[0].href, 'https://open.spotify.com/search/Soda%20Stereo');
  assert.equal(tarjeta('Poné música de Soda Stereo', ctx('otro', { appMusica: 'youtubemusic' })).botones[0].href, 'https://music.youtube.com/search?q=Soda%20Stereo');
  assert.equal(tarjeta('buscá recetas de pizza en YouTube').botones[0].href, 'https://www.youtube.com/results?search_query=recetas%20de%20pizza');
  assert.equal(tarjeta('¿Quién ganó el partido?').botones[0].href, 'https://www.google.com/search?q=Qui%C3%A9n%20gan%C3%B3%20el%20partido');
  assert.equal(enlaceAbrirApp(appPorId('instagram'), 'android').href,
    'intent://www.instagram.com/#Intent;scheme=https;package=com.instagram.android;S.browser_fallback_url=https%3A%2F%2Fwww.instagram.com%2F;end');
  assert.equal(tarjeta('Abrí Instagram', ctx('ios')).botones[0].href, 'instagram://app');
  assert.equal(tarjeta('Abrí Instagram').botones[0].href, 'https://www.instagram.com/');
});

test('respuestas directas y cosas que no se pueden', () => {
  assert.equal(tarjeta('¿Qué hora es?').respuesta, 'Son las 10:00');
  assert.equal(tarjeta('qué día es hoy').respuesta, 'Hoy es martes 17 de noviembre de 2026');
  const alarma = tarjeta('poné una alarma a las 7');
  assert.equal(alarma.botones[0].accion.tipo, 'intencion');
  assert.equal(alarma.botones[0].accion.intencion.tipo, 'evento');
  assert.equal(tarjeta('asdf qwerty').tipo, 'desconocido');
  assert.equal(tarjeta('abrí mis contactos').accion.pantalla, 'contactos');
});

test('reconoce el tipo de teléfono', () => {
  assert.equal(detectarPlataforma('Mozilla/5.0 (Linux; Android 14; Pixel 8)'), 'android');
  assert.equal(detectarPlataforma('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'ios');
  assert.equal(detectarPlataforma('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5), 'ios');
  assert.equal(detectarPlataforma('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'otro');
});
