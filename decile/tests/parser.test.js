// Pruebas del "parser": ¿entiende bien los pedidos?
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretar, elegirMejor } from '../js/parser.js';

// Martes 17 de noviembre de 2026, 10:00
const AHORA = new Date(2026, 10, 17, 10, 0);
const CONTACTOS = [
  { id: 'a', nombre: 'Juan Gómez', alias: [], telefonos: ['+54 9 11 2345-6789'], emails: [] },
  { id: 'b', nombre: 'Juan Pérez', alias: [], telefonos: ['011 15 4444-5555'], emails: [] },
  { id: 'c', nombre: 'Mamá', alias: ['vieja', 'ma'], telefonos: ['0294 15 412-3456'], emails: [] },
  { id: 'd', nombre: 'Laura Fernández', alias: [], telefonos: ['1133334444'], emails: ['laura@example.com'] },
  { id: 'e', nombre: 'Pedro Sánchez', alias: ['Pedrito'], telefonos: ['2944556677'], emails: [] },
];
const ctx = { contactos: CONTACTOS, ahora: AHORA, ajustes: { canalMensaje: 'whatsapp' } };
const sin = (r) => { const { texto, ...resto } = r; return resto; };
const ok = (frase, esperado, c = ctx) => {
  const r = sin(interpretar(frase, c));
  for (const [k, v] of Object.entries(esperado)) {
    assert.deepEqual(r[k], v, `«${frase}» → ${k}: ${JSON.stringify(r[k])} (esperaba ${JSON.stringify(v)})\n${JSON.stringify(r)}`);
  }
  return r;
};

test('el ejemplo del pedido original', () => {
  ok('Enviale un WhatsApp a Juan Gómez qué diga. Hola amigo.', { tipo: 'whatsapp', destinatario: 'Juan Gómez', mensaje: 'Hola amigo.' });
  ok('enviale un whatsapp a juan gomez que diga hola amigo', { tipo: 'whatsapp', destinatario: 'juan gomez', mensaje: 'Hola amigo' });
});

test('WhatsApp dicho de muchas formas', () => {
  ok('Mandale un WhatsApp a Juan Gómez diciendo que llego tarde', { tipo: 'whatsapp', destinatario: 'Juan Gómez', mensaje: 'Llego tarde' });
  ok('Decile a Juan por WhatsApp que llego en 10 minutos', { tipo: 'whatsapp', destinatario: 'Juan', mensaje: 'Llego en 10 minutos' });
  ok('mandale a Juan Gómez un wasap que diga hola', { tipo: 'whatsapp', destinatario: 'Juan Gómez', mensaje: 'Hola' });
  ok('WhatsApp a Juan Gómez: ya salgo', { tipo: 'whatsapp', destinatario: 'Juan Gómez', mensaje: 'Ya salgo' });
  ok('Escribile a Juan Gómez hola cómo estás', { tipo: 'whatsapp', destinatario: 'Juan Gómez', mensaje: 'Hola cómo estás' });
  ok('escribile a juan hola como estas', { tipo: 'whatsapp', destinatario: 'juan', mensaje: 'Hola como estas' });
  ok('Mandale saludos a Pedrito', { tipo: 'whatsapp', destinatario: 'Pedrito', mensaje: 'Saludos' });
  ok('decile hola a mi mamá por WhatsApp', { tipo: 'whatsapp', destinatario: 'mi mamá', mensaje: 'Hola' });
  ok('Che, mandale un mensaje a mamá que ya llegué', { tipo: 'whatsapp', destinatario: 'mamá', mensaje: 'Ya llegué' });
  ok('envíale un whatsapp a Juan Gómez', { tipo: 'whatsapp', destinatario: 'Juan Gómez', mensaje: '' });
  ok('mandá un WhatsApp', { tipo: 'whatsapp', destinatario: '', mensaje: '' });
  ok('decile que llego tarde', { tipo: 'whatsapp', destinatario: '', mensaje: 'Llego tarde' });
  ok('avisale a Laura que la reunión se pasa para el jueves', { tipo: 'whatsapp', destinatario: 'Laura', mensaje: 'La reunión se pasa para el jueves' });
  ok('mandale un whatsapp al 11 2345 6789 que diga hola', { tipo: 'whatsapp', destinatario: '11 2345 6789', mensaje: 'Hola' });
  ok('preguntale a Juan Gómez si viene mañana', { tipo: 'whatsapp', destinatario: 'Juan Gómez', mensaje: '¿Viene mañana?' });
  ok('Por favor mandale un WhatsApp a Pedro que diga que la cena es a las 9', { tipo: 'whatsapp', destinatario: 'Pedro', mensaje: 'La cena es a las 9' });
  ok('abrí el chat de Juan Gómez', { tipo: 'whatsapp', destinatario: 'Juan Gómez', mensaje: '' });
  ok('Abrí WhatsApp con mamá', { tipo: 'whatsapp', destinatario: 'mamá', mensaje: '' });
  ok('mandale mi ubicación a mamá', { tipo: 'whatsapp', destinatario: 'mamá', ubicacion: true });
});

test('mensajes sin "que" separan por la agenda o por las mayúsculas', () => {
  ok('escribile a Laura Fernández nos vemos mañana', { destinatario: 'Laura Fernández', mensaje: 'Nos vemos mañana' });
  ok('mandale un whatsapp a Carlos Ruiz llego en 5', { destinatario: 'Carlos Ruiz', mensaje: 'Llego en 5' }, { ahora: AHORA });
});

test('SMS, mail y Telegram', () => {
  ok('mandale un SMS a Pedro diciendo que ya salgo', { tipo: 'sms', destinatario: 'Pedro', mensaje: 'Ya salgo' });
  ok('mandale un mensaje de texto a mamá: llego a las 8', { tipo: 'sms', destinatario: 'mamá', mensaje: 'Llego a las 8' });
  ok('mandale un mail a Laura con asunto reunión diciendo que confirmo', { tipo: 'email', destinatario: 'Laura', asunto: 'reunión', mensaje: 'Confirmo' });
  ok('enviá un correo a Laura que diga gracias por todo', { tipo: 'email', destinatario: 'Laura', mensaje: 'Gracias por todo' });
  ok('mandale un telegram a Pedro que diga hola', { tipo: 'telegram', destinatario: 'Pedro', mensaje: 'Hola' });
  ok('mandale un mensaje a Pedro que diga hola', { tipo: 'sms' }, { ...ctx, ajustes: { canalMensaje: 'sms' } });
});

test('llamadas', () => {
  ok('Llamá a Juan Gómez', { tipo: 'llamar', destinatario: 'Juan Gómez' });
  ok('llama a mamá por favor', { tipo: 'llamar', destinatario: 'mamá' });
  ok('llamar al 911', { tipo: 'llamar', destinatario: '911' });
  ok('hacé una llamada a Pedro', { tipo: 'llamar', destinatario: 'Pedro' });
  ok('llamá a Laura por WhatsApp', { tipo: 'llamar', destinatario: 'Laura', porWhatsapp: true });
  ok('videollamada con mamá', { tipo: 'llamar', destinatario: 'mamá', porWhatsapp: true });
  ok('llamá', { tipo: 'llamar', destinatario: '' });
});

test('agenda y recordatorios', () => {
  const r = ok('Recordame llamar al dentista mañana a las 10', { tipo: 'evento', titulo: 'Llamar al dentista', conHora: true });
  assert.equal(new Date(r.fecha).getTime(), new Date(2026, 10, 18, 10, 0).getTime());
  const r2 = ok('agendá reunión con Pedro el viernes a las 15:30', { tipo: 'evento', titulo: 'Reunión con Pedro', conHora: true });
  assert.equal(new Date(r2.fecha).getTime(), new Date(2026, 10, 20, 15, 30).getTime());
  const r3 = ok('tengo un turno con el médico el 25 de noviembre a las 9', { tipo: 'evento', titulo: 'Turno con el médico' });
  assert.equal(new Date(r3.fecha).getTime(), new Date(2026, 10, 25, 9, 0).getTime());
  const r4 = ok('recordame que tengo que pagar la luz', { tipo: 'evento', titulo: 'Tengo que pagar la luz', fecha: null });
  assert.equal(r4.conHora, false);
  const r5 = ok('avisame en 20 minutos que saque la pizza', { tipo: 'evento', titulo: 'Saque la pizza' });
  assert.equal(new Date(r5.fecha).getTime(), new Date(2026, 10, 17, 10, 20).getTime());
});

test('cosas que una web no puede hacer (y su alternativa)', () => {
  const r = ok('poné una alarma a las 7', { tipo: 'no_soportado' });
  assert.equal(r.alternativa.tipo, 'evento');
  assert.equal(new Date(r.alternativa.fecha).getTime(), new Date(2026, 10, 18, 7, 0).getTime());
  ok('prendé la linterna', { tipo: 'no_soportado' });
  ok('subí el volumen', { tipo: 'no_soportado' });
  ok('leeme los mensajes', { tipo: 'no_soportado' });
  const t = ok('poné un temporizador de 10 minutos', { tipo: 'no_soportado' });
  assert.equal(new Date(t.alternativa.fecha).getTime(), new Date(2026, 10, 17, 10, 10).getTime());
});

test('mapas y navegación', () => {
  ok('Llevame al Obelisco', { tipo: 'navegar', destino: 'Obelisco' });
  ok('¿Cómo llego a Av. Corrientes 1234?', { tipo: 'navegar', destino: 'Av. Corrientes 1234' });
  ok('llevame a casa', { tipo: 'navegar', lugar: 'casa' });
  ok('llevame al trabajo con Waze', { tipo: 'navegar', lugar: 'trabajo', app: 'waze' });
  ok('cómo llego a la terminal en colectivo', { tipo: 'navegar', destino: 'terminal', modo: 'transporte' });
  ok('con waze a Plaza de Mayo', { tipo: 'navegar', destino: 'Plaza de Mayo', app: 'waze' });
  ok('¿Dónde hay una farmacia?', { tipo: 'mapa', consulta: 'farmacia' });
  ok('farmacias cerca', { tipo: 'mapa', consulta: 'farmacias' });
  ok('dónde queda el Cerro Catedral', { tipo: 'mapa', consulta: 'Cerro Catedral' });
  ok('buscá heladerías en el mapa', { tipo: 'mapa', consulta: 'heladerías' });
});

test('YouTube y música', () => {
  ok('buscá recetas de pizza en YouTube', { tipo: 'youtube', consulta: 'recetas de pizza' });
  ok('poné un video de gatos', { tipo: 'youtube', consulta: 'gatos' });
  ok('abrí YouTube y buscá tutoriales de Excel', { tipo: 'youtube', consulta: 'tutoriales de Excel' });
  ok('Poné música de Soda Stereo', { tipo: 'musica', consulta: 'Soda Stereo' });
  ok('reproducí Cerati en Spotify', { tipo: 'musica', consulta: 'Cerati', app: 'spotify' });
  ok('quiero escuchar algo de rock nacional', { tipo: 'musica', consulta: 'rock nacional' });
  ok('poné música', { tipo: 'musica', consulta: '' });
  ok('Los Redondos en YouTube Music', { tipo: 'musica', consulta: 'Los Redondos', app: 'youtubemusic' });
});

test('abrir apps', () => {
  ok('Abrí Instagram', { tipo: 'abrir', appId: 'instagram' });
  ok('abrir mercado pago', { tipo: 'abrir', appId: 'mercadopago' });
  ok('abrí la app de Netflix', { tipo: 'abrir', appId: 'netflix' });
  ok('Spotify', { tipo: 'abrir', appId: 'spotify' });
  ok('abrí mis contactos', { tipo: 'interno', pantalla: 'contactos' });
  ok('abrí Fulanito App', { tipo: 'abrir', appId: null, nombre: 'Fulanito App' });
});

test('preguntas, hora, fecha, clima, ayuda', () => {
  ok('¿Qué hora es?', { tipo: 'hora' });
  ok('qué día es hoy', { tipo: 'fecha' });
  ok('¿Cómo está el clima?', { tipo: 'clima', cuando: 0, lugar: '' });
  ok('va a llover mañana?', { tipo: 'clima', cuando: 1 });
  ok('qué tiempo hace en Bariloche', { tipo: 'clima', lugar: 'Bariloche' });
  ok('ayuda', { tipo: 'ayuda' });
  ok('¿Qué podés hacer?', { tipo: 'ayuda' });
  ok('buscá cómo hacer pan casero', { tipo: 'buscar', consulta: 'cómo hacer pan casero' });
  ok('¿Quién ganó el partido de River?', { tipo: 'buscar', consulta: 'Quién ganó el partido de River' });
  ok('hola', { tipo: 'saludo' });
  ok('gracias', { tipo: 'gracias' });
  ok('', { tipo: 'vacio' });
  ok('asdf qwerty', { tipo: 'desconocido' });
});

test('audios, recordatorios sin verbo y alarmas a la mañana', () => {
  ok('mandale un audio a Juan Gómez', { tipo: 'whatsapp', destinatario: 'Juan Gómez', mensaje: '', audio: true });
  ok('mandale un mensaje de voz a mamá', { tipo: 'whatsapp', destinatario: 'mamá', audio: true });
  const r = ok('mandame un recordatorio el lunes a las 8', { tipo: 'evento', titulo: 'Recordatorio', duracion: 30 });
  assert.equal(new Date(r.fecha).getTime(), new Date(2026, 10, 23, 8, 0).getTime());
  const r2 = ok('esta noche a las 10 partido', { tipo: 'evento', titulo: 'Partido' });
  assert.equal(new Date(r2.fecha).getTime(), new Date(2026, 10, 17, 22, 0).getTime());
  const r3 = ok('poné el despertador a las 6 y media', { tipo: 'no_soportado' });
  assert.equal(new Date(r3.alternativa.fecha).getTime(), new Date(2026, 10, 18, 6, 30).getTime());
  ok('pasame la de Ciro', { tipo: 'musica', consulta: 'Ciro' });
});

test('contactos y comandos propios', () => {
  ok('agregá el contacto Juan Gómez con el número 11 2345 6789', { tipo: 'agregar_contacto', nombre: 'Juan Gómez', telefono: '11 2345 6789' });
  ok('guardá a Rosa López 2944 112233', { tipo: 'agregar_contacto', nombre: 'Rosa López', telefono: '2944 112233' });
  ok('Laura Fernández', { tipo: 'contacto', destinatario: 'Laura Fernández' });
  const comandos = [{ id: 'k1', nombre: 'Modo foco', frases: ['modo foco'], url: 'shortcuts://run-shortcut?name=Foco' },
    { id: 'k2', nombre: 'Nota en Keep', frases: ['anotá en keep'], url: 'https://keep.google.com/?q={texto}' }];
  ok('Modo foco', { tipo: 'personalizado', comandoId: 'k1', extra: '' }, { ...ctx, comandos });
  ok('anota en Keep comprar pan', { tipo: 'personalizado', comandoId: 'k2', extra: 'comprar pan' }, { ...ctx, comandos });
});

test('entre varias versiones del dictado elige la que tiene un contacto conocido', () => {
  const r = elegirMejor(['mandale un whatsapp a juan gomes que diga hola', 'mandale un whatsapp a juan gómez que diga hola'], ctx);
  assert.equal(r.intencion.tipo, 'whatsapp');
  const r2 = elegirMejor(['llama a la mamá', 'llamá a mamá'], ctx);
  assert.equal(r2.intencion.tipo, 'llamar');
});
