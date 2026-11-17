// parser.js — Entiende el pedido y lo convierte en una "intención". Ejemplo:
//   "Enviale un WhatsApp a Juan Gómez qué diga. Hola amigo."
//   → { tipo: 'whatsapp', destinatario: 'Juan Gómez', mensaje: 'Hola amigo.' }
//
// Funciona con reglas (sin IA): se prueban "reconocedores" en orden y gana el
// primero que entiende. Acepta voseo y tuteo ("mandale"/"mándale"/"envíale"),
// tildes o no, y la puntuación que agrega el dictado.

import {
  alinear, cortar, unir, recortar, quitarInicio, quitarFinal, quitarTramos,
  capitalizar, escaparRegex,
} from './texto.js';
import { buscarContacto, claveNombre } from './contactos.js';
import { esNumero } from './telefono.js';
import { extraerFechaHora } from './fechas.js';
import { buscarApp } from './apps.js';

// ---------------------------------------------------------------------------
// Piezas (sobre el texto normalizado: sin tildes, en minúsculas)
// ---------------------------------------------------------------------------
const MODAL = '(?:(?:quiero|quisiera|queria|necesito|me\\s+gustaria|podes|podrias|puedes|podria|me\\s+podes|me\\s+podrias|me\\s+puedes|vas\\s+a|hay\\s+que|tenes\\s+que|por\\s+favor)\\s+)?';
// "mandale", "enviá", "escribile", "decile", "avisale"... pero NO "mandame",
// "decime", "avisame" (esos son para uno mismo: "avisame mañana" es un recordatorio).
const V_MENSAJE = '(?:(?:envi|mand|escrib|deci|avis|contest|respond|pregunt)(?!\\w*me\\b)\\w*|dile|dig(?:a|ale|ales|anle)|pasale|pasales)';
const V_LLAMAR = '(?:llam(?!\\w*me\\b)\\w*|telefone\\w*|disca(?:r|le)?|marca(?:r|le)?|hace(?:me|r)?\\s+una\\s+(?:llamada|videollamada)|comunica(?:me|r)?\\s+con|videollam\\w*)';

const WA = '(?:wh?ats?\\s?s?ap+s?|wass?ap+|guass?ap+|wpp|wsp|whats|wasa|uasap)';
const SMS = '(?:sms|mensajes?\\s+de\\s+texto|mensajito\\s+de\\s+texto|texto)';
const MAIL = '(?:e-?mail|mail|meil|imeil|correo(?:\\s+electronico)?)';
const TG = '(?:telegram|telegran)';
const GEN = '(?:mensajes?|mensajito|msj|msg)';
const CANALES = `(?:(${WA})|(${SMS})|(${MAIL})|(${TG})|(${GEN}))`;

const RE_CANAL_INI = new RegExp(`^(?:(?:un|una|el|la|unos)\\s+)?(?:(?:mensaje|mensajito|msj)\\s+(?:de|por|en|al|via)\\s+)?${CANALES}\\b[\\s,.:]*`);
const RE_CANAL_MEDIO = new RegExp(`\\s+(?:por\\s+el|a\\s+su|al\\s+su|por|en|al|via|x|un|una|el|de)\\s+(?:(?:mensaje|mensajito|msj)\\s+(?:de|por|en|al|via)\\s+)?${CANALES}\\b`);
const RE_POR_CANAL_INI = new RegExp(`^(?:por|en|via|x)\\s+(?:el\\s+)?${CANALES}\\b[\\s,]*`);
const RE_MSG_VERBO = new RegExp(`^${MODAL}(${V_MENSAJE})\\b[\\s,]*`);
const RE_MSG_SIN_VERBO = new RegExp(`^(?:(?:un|una|el|nuevo)\\s+)?${CANALES}\\s+(?:a|al|para|pa)\\s+`);
const RE_INTRO = /^(?:a|al|para|pa|hacia)\s+/;
const RE_AUDIO_INI = /^(?:(?:un|una|el)\s+)?(?:audios?|nota\s+de\s+voz|mensajes?\s+de\s+voz|mensajito\s+de\s+voz)\b[\s,.:]*/;

// Dónde termina "a quién" y empieza el mensaje.
const SEP_FUERTE = /[\s,]*(?:\b(?:que\s+(?:le\s+|les\s+)?(?:diga|digas|dice|ponga|pongas|escriba|escribas|mande)|diciendo(?:le|les)?|diciendole|diciendoles|con\s+(?:el\s+)?(?:mensaje|texto)|el\s+(?:mensaje|texto)|y\s+(?:decile|dile|ponele|ponle|escribile|preguntale)|preguntandole)\b|:)[\s,.:;]*/;
const SEP_DEBIL = /\s+que\s+/;

const CORTESIA_INI = /^(?:(?:hola|hey|ey|oye|oi|oime|che|ok|okey|okay|bueno|a\s+ver|por\s+favor|porfa|porfis|disculpa|perdon)(?:\s+|[,.!¡:;]\s*)+)+/;
const RE_SALUDO = /^(?:hola|holis|buen(?:os|as)?\s+(?:dias|tardes|noches)|buen\s+dia|buenas|hey|que\s+tal|como\s+(?:estas|andas|va|te\s+va)|que\s+onda)$/;
const RE_GRACIAS = /^(?:gracias|muchas\s+gracias|mil\s+gracias|genial|perfecto|excelente|buenisimo|joya|barbaro|ok\s+gracias|listo\s+gracias)$/;

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------
function canalDe(m) {
  if (m[1]) return 'whatsapp';
  if (m[2]) return 'sms';
  if (m[3]) return 'email';
  if (m[4]) return 'telegram';
  if (m[5]) return 'mensaje';
  return null;
}

const mejorCanal = (actual, nuevo) => (!nuevo ? actual : !actual || actual === 'mensaje' ? nuevo : actual);

function limpiarDestinatario(t) {
  let d = recortar(t);
  for (let i = 0; i < 2; i++) {
    d = quitarFinal(d, /\s+(?:por\s+favor|porfa|porfis|ahora|ya|urgente|rapido)$/);
    d = quitarInicio(d, /^(?:a|al|para)\s+/);
    d = recortar(d);
  }
  return d.o;
}

/** Posiciones de cada palabra en el texto normalizado. */
function palabrasDe(t) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(t.n))) out.push([m.index, m.index + m[0].length]);
  return out;
}

const mayuscula = (s) => /^\p{Lu}/u.test(s);

/** "Juan Gómez hola cómo estás" (sin "que") → separa usando la agenda; si no,
 *  las mayúsculas del dictado ("Juan Gómez") y, como último recurso, la 1.ª palabra. */
function separarDestinatario(dest, c) {
  const pal = palabrasDe(dest);
  if (pal.length < 2) return null;
  const num = /^[+(]?\d[\d\s\-().]{4,}\d/.exec(dest.n);
  if (num && num[0].replace(/\D/g, '').length >= 6) {
    return { dest: cortar(dest, 0, num[0].length), msg: cortar(dest, num[0].length) };
  }
  if (c.contactos.length) {
    const todo = buscarContacto(dest.o, c.contactos);
    if (todo.estado !== 'ninguno' && todo.puntaje >= 85) return null; // todo es el nombre ("Juan Gómez")
    for (let k = Math.min(5, pal.length - 1); k >= 1; k--) {
      const cand = cortar(dest, 0, pal[k - 1][1]);
      const b = buscarContacto(cand.o, c.contactos);
      if (b.estado !== 'ninguno' && b.puntaje >= 85) return { dest: cand, msg: cortar(dest, pal[k][0]) };
    }
  }
  if (mayuscula(dest.o.slice(pal[0][0]))) {
    let k = 1;
    while (k < pal.length && k < 4 && mayuscula(dest.o.slice(pal[k][0]))) k++;
    if (k < pal.length) return { dest: cortar(dest, 0, pal[k - 1][1]), msg: cortar(dest, pal[k][0]) };
  }
  if (pal.length > 3) return { dest: cortar(dest, 0, pal[0][1]), msg: cortar(dest, pal[1][0]) };
  return null;
}

const esUbicacion = (s) => /^(?:mi|la|tu)?\s*(?:ubicacion(?:\s+actual)?|posicion|donde\s+estoy)$/.test(claveNombre(s));

function resultadoMensaje(canal, c, destinatario, mensaje, extra = {}) {
  const tipo = !canal || canal === 'mensaje' ? (c.ajustes.canalMensaje || 'whatsapp') : canal;
  const r = { tipo, destinatario, mensaje };
  if (esUbicacion(mensaje)) { r.mensaje = ''; r.ubicacion = true; }
  return Object.assign(r, extra);
}

function armarMensaje(resto, canal, c, verbo) {
  let dest = resto;
  let msg = null;
  let pregunta = false;
  let asunto = '';
  if (/^que\s/.test(resto.n)) {                    // "decile que llego tarde" (sin a quién)
    dest = cortar(resto, 0, 0);
    msg = cortar(resto, 4);
  } else {
    const sf = SEP_FUERTE.exec(resto.n);
    const sd = SEP_DEBIL.exec(resto.n);
    const ss = /^pregunt/.test(verbo || '') ? /\s+si\s+/.exec(resto.n) : null;
    const sep = [sf, sd, ss].filter(Boolean).sort((a, b) => a.index - b.index || (a === sf ? -1 : 1))[0];
    if (sep) {
      dest = cortar(resto, 0, sep.index);
      msg = cortar(resto, sep.index + sep[0].length);
      pregunta = sep === ss;
    }
  }
  const k = RE_CANAL_MEDIO.exec(dest.n);
  if (k) {
    canal = mejorCanal(canal, canalDe(k));
    dest = unir(cortar(dest, 0, k.index), cortar(dest, k.index + k[0].length));
  }
  if (canal === 'email') {
    const a = /\s+(?:con\s+(?:el\s+)?)?asunto\s+/.exec(dest.n);
    if (a) { asunto = recortar(cortar(dest, a.index + a[0].length)).o; dest = cortar(dest, 0, a.index); }
    const b = msg && /\s+(?:con\s+(?:el\s+)?)?asunto\s+/.exec(msg.n);
    if (b) { asunto = recortar(cortar(msg, b.index + b[0].length)).o; msg = cortar(msg, 0, b.index); }
  }
  if (!msg && dest.n.trim()) {
    const p = separarDestinatario(recortar(dest), c);
    if (p) { dest = p.dest; msg = p.msg; }
  }
  let mensaje = '';
  if (msg) {
    msg = recortar(quitarInicio(recortar(msg, { mantenerFinal: true }), /^(?:que|q)\s+/), { mantenerFinal: true });
    mensaje = capitalizar(msg.o);
    if (pregunta && mensaje) mensaje = '¿' + mensaje.replace(/[?.!]+$/, '') + '?';
  }
  return resultadoMensaje(canal, c, limpiarDestinatario(dest), mensaje, asunto ? { asunto } : {});
}

/** "mandale hola a Juan" (primero el mensaje, después a quién). */
function mensajePrimero(resto, canal, c) {
  const re = /\s(?:a|al|para|pa)\s/g;
  let ultimo = null;
  let m;
  while ((m = re.exec(resto.n))) ultimo = m;
  if (!ultimo) return null;
  let dest = cortar(resto, ultimo.index + ultimo[0].length);
  const msg = cortar(resto, 0, ultimo.index);
  const k = RE_CANAL_MEDIO.exec(' ' + dest.n);
  if (k) {
    canal = mejorCanal(canal, canalDe(k));
    dest = unir(cortar(dest, 0, Math.max(0, k.index - 1)), cortar(dest, k.index - 1 + k[0].length));
  }
  const d = limpiarDestinatario(dest);
  if (!d || !recortar(msg).n) return null;
  const conocido = c.contactos.length && buscarContacto(d, c.contactos).estado !== 'ninguno';
  if (!(conocido || esNumero(d) || (mayuscula(d) && d.split(/\s+/).length <= 4))) return null;
  return resultadoMensaje(canal, c, d, capitalizar(recortar(msg, { mantenerFinal: true }).o));
}

// ---------------------------------------------------------------------------
// Reconocedores (en orden)
// ---------------------------------------------------------------------------
function rPersonalizado(t, c) {
  for (const cmd of c.comandos) {
    for (const frase of cmd.frases || []) {
      const f = claveNombre(frase);
      if (!f) continue;
      const re = new RegExp('^' + f.split(' ').map(escaparRegex).join('[\\s,.;:!?¡¿"\']+') + '(?=$|[\\s,.;:!?])');
      const m = re.exec(t.n);
      if (m) {
        return { tipo: 'personalizado', comandoId: cmd.id, nombre: cmd.nombre, url: cmd.url, extra: recortar(cortar(t, m[0].length)).o };
      }
    }
  }
  return null;
}

const RE_ABRIR_CHAT = new RegExp(`^(?:abri\\w*|abre|abra|entra\\s+(?:a|al|en))\\s+(?:el\\s+|la\\s+)?(?:chat|conversacion|${WA})\\s+(?:de|con|del|a)\\s+`);
function rAbrirChat(t, c) {
  const m = RE_ABRIR_CHAT.exec(t.n);
  if (!m) return null;
  return { tipo: 'whatsapp', destinatario: limpiarDestinatario(cortar(t, m[0].length)), mensaje: '' };
}

function rMensaje(t, c) {
  const m = RE_MSG_VERBO.exec(t.n);
  if (!m) {
    const s = RE_MSG_SIN_VERBO.exec(t.n);
    if (!s) return null;
    return armarMensaje(cortar(t, s[0].length), canalDe(s), c, '');
  }
  const verbo = m[1];
  let resto = quitarInicio(cortar(t, m[0].length), /^(?:le|les)\s+/);
  let canal = null;
  const au = RE_AUDIO_INI.exec(resto.n);
  if (au) {
    const d = quitarInicio(cortar(resto, au[0].length), RE_INTRO);
    const r = { tipo: 'whatsapp', destinatario: limpiarDestinatario(d), mensaje: '', audio: true };
    return r;
  }
  let k = RE_CANAL_INI.exec(resto.n);
  if (k) { canal = canalDe(k); resto = cortar(resto, k[0].length); }
  k = RE_POR_CANAL_INI.exec(resto.n);
  if (k) { canal = mejorCanal(canal, canalDe(k)); resto = cortar(resto, k[0].length); }
  const intro = RE_INTRO.exec(resto.n);
  if (intro) return armarMensaje(cortar(resto, intro[0].length), canal, c, verbo);
  if (/^que\s/.test(resto.n) || !resto.n.trim()) return armarMensaje(resto, canal, c, verbo);
  return mensajePrimero(resto, canal, c) || armarMensaje(resto, canal, c, verbo);
}

const RE_LLAMAR = new RegExp(`^${MODAL}(${V_LLAMAR})\\b[\\s,]*(?:(?:a\\s+la|a|al|con|para)\\s+)?`);
const RE_LLAMAR_WA = new RegExp(`\\s*(?:(?:por|en|al|via|x|con|de)\\s+)?(?:el\\s+)?${WA}\\b`);
function rLlamada(t) {
  const m = RE_LLAMAR.exec(t.n);
  if (!m) return null;
  let resto = cortar(t, m[0].length);
  let porWhatsapp = /videollam/.test(m[1]);
  const w = RE_LLAMAR_WA.exec(resto.n);
  if (w) {
    porWhatsapp = true;
    resto = unir(cortar(resto, 0, w.index), cortar(resto, w.index + w[0].length));
  }
  resto = quitarFinal(recortar(resto), /\s+(?:por\s+(?:telefono|celular)|al\s+(?:celular|telefono|fijo|movil))$/);
  const r = { tipo: 'llamar', destinatario: limpiarDestinatario(resto) };
  if (porWhatsapp) r.porWhatsapp = true;
  return r;
}

const RE_CONTACTO_A = /^(?:agreg\w*|guard\w*|agend\w*|anot\w*|cre\w*|carg\w*|sum\w*)\s+(?:(?:a|el|un|al)\s+)?(?:nuevo\s+)?(?:contacto|numero|telefono|celular)(?:\s+(?:de|del|a|para))?\s+/;
const RE_CONTACTO_B = /^(?:agreg\w*|guard\w*|carg\w*)\s+(?:(?:a|al)\s+)?/;
function rAgregarContacto(t) {
  const m = RE_CONTACTO_A.exec(t.n) || RE_CONTACTO_B.exec(t.n);
  if (!m) return null;
  const resto = recortar(cortar(t, m[0].length));
  const num = /([+(]?\d[\d\s\-().]{4,}\d)$/.exec(resto.n);
  if (!num || num[1].replace(/\D/g, '').length < 6) return null;
  let nombre = cortar(resto, 0, num.index);
  for (let i = 0; i < 3; i++) {
    nombre = quitarFinal(recortar(nombre), /\s*(?:con\s+(?:el\s+)?(?:numero|telefono|celular|cel)|(?:numero|telefono|celular|cel)|al|es|que\s+es|y\s+el\s+numero\s+es)$/);
  }
  const n = recortar(nombre).o;
  if (!n) return null;
  return { tipo: 'agregar_contacto', nombre: capitalizar(n), telefono: recortar(cortar(resto, num.index)).o };
}

const RE_AGENDA = new RegExp(
  `^${MODAL}(?:(recorda(?:me|rme|nos|le)|recuerdame|recordarme|acordame|avisa(?:me|rme)|(?:manda|hace|pone|deja|crea|agrega)me\\s+(?:un\\s+)?recordatorio|agenda(?:me|r|lo|la)?|` +
  'anota(?:me|r)?\\s+en\\s+(?:la\\s+|el\\s+|mi\\s+)?(?:agenda|calendario)|pone(?:me|r)?\\s+en\\s+(?:la\\s+|el\\s+|mi\\s+)?(?:agenda|calendario)|' +
  'crea(?:me|r)?\\s+(?:un\\s+|una\\s+)?(?:evento|recordatorio|cita|reunion)|agrega(?:me|r)?\\s+(?:un\\s+|una\\s+)?(?:evento|recordatorio|cita)|' +
  'agrega(?:r)?\\s+(?:al|a\\s+la|en\\s+el|en\\s+la)\\s+(?:agenda|calendario)|programa(?:me|r)?|nuevo\\s+(?:evento|recordatorio)|nueva\\s+cita)|' +
  '(tengo|tenemos)\\s+(?=(?:un|una)\\s+(?:turno|reunion|cita|evento|cumple|cumpleanos|clase|entrevista|partido|cena|almuerzo|consulta|vuelo|examen|parcial|control)\\b))\\b[\\s,]*',
);
/** Saca la fecha/hora del texto y deja un título prolijo. */
function tituloEvento(resto, tramos) {
  let titulo = quitarTramos(resto, tramos);
  for (let i = 0; i < 4; i++) {
    titulo = recortar(titulo);
    titulo = quitarInicio(titulo, /^(?:que|de|para|el|la|un|una|a|y|evento|recordatorio|cita|con\s+el\s+titulo|titulo)\s+/);
    titulo = quitarFinal(titulo, /\s+(?:el|la|a|para|de|y|que|a\s+las?|las?|del|al|en|desde|hasta)$/);
  }
  return capitalizar(recortar(titulo).o);
}

function rAgenda(t, c) {
  const m = RE_AGENDA.exec(t.n);
  if (!m) return null;
  const resto = cortar(t, m[0].length);
  const recordatorio = /^(?:recor|recuer|acord|avis)|recordatorio/.test(m[1] || '');
  const { fecha, conHora, tramos } = extraerFechaHora(resto.n, c.ahora);
  return {
    tipo: 'evento',
    titulo: tituloEvento(resto, tramos) || (recordatorio ? 'Recordatorio' : 'Evento'),
    fecha: fecha ? fecha.toISOString() : null,
    conHora,
    duracion: recordatorio ? 30 : 60,
  };
}

/** "mañana a las 10 dentista" (sin verbo): si hay fecha u hora, es un evento. */
function rEventoSuelto(t, c) {
  const { fecha, conHora, tramos } = extraerFechaHora(t.n, c.ahora);
  if (!fecha) return null;
  const titulo = tituloEvento(t, tramos);
  return titulo ? { tipo: 'evento', titulo, fecha: fecha.toISOString(), conHora, duracion: 60 } : null;
}

const RE_VERBO_DISPOSITIVO = /^(?:prend|encend|apag|activ|desactiv|pon|sub|baj|cambi|abri|abre|conect|desconect|silenci|configur|despert|lee|leer|sac|tom|bloque|reinici|habilit|deshabilit|ajust|quit)\w*/;
const NO_SOPORTADO = [
  { re: /\b(?:alarmas?|despertador|despertame|despertarme)\b/, que: 'poner alarmas', titulo: 'Alarma', siempre: true },
  { re: /\b(?:temporizador|timer|cronometro|cuenta\s+regresiva)\b/, que: 'usar el temporizador', titulo: 'Temporizador', siempre: true },
  { re: /\b(?:linterna|flash)\b/, que: 'prender o apagar la linterna' },
  { re: /\b(?:volumen|modo\s+silencio|silencio|vibrador|modo\s+vibrar)\b/, que: 'cambiar el volumen' },
  { re: /\bbrillo\b/, que: 'cambiar el brillo' },
  { re: /\b(?:wi\s*-?\s*fi|wifi|bluetooth|datos(?:\s+moviles)?|modo\s+avion|no\s+molestar|hotspot|gps)\b/, que: 'cambiar la configuración del teléfono' },
  { re: /\b(?:captura\s+de\s+pantalla|screenshot|grabar\s+(?:la\s+)?pantalla)\b/, que: 'sacar capturas de pantalla', siempre: true },
  { re: /\b(?:apaga\w*|reinicia\w*|bloquea\w*)\s+(?:el\s+)?(?:telefono|celular|cel|movil|pantalla)\b/, que: 'apagar o bloquear el teléfono', siempre: true },
  { re: /\b(?:lee(?:me)?|leer)\s+(?:los\s+|mis\s+|el\s+|las\s+|un\s+)?(?:ultimos?\s+)?(?:mensajes?|whats\w*|mails?|correos?|notificaciones|chats?)\b/, que: 'leer tus mensajes o notificaciones', siempre: true },
  { re: /\b(?:saca(?:me|r)?|toma(?:me|r)?)\s+una\s+(?:foto|selfie)\b|\babri\w*\s+(?:la\s+)?camara\b/, que: 'usar la cámara', siempre: true },
  { re: /\bbateria\b/, que: 'ver la batería' },
];
function rNoSoportado(t, c) {
  const corto = t.n.split(/\s+/).length <= 3;
  for (const x of NO_SOPORTADO) {
    if (!x.re.test(t.n)) continue;
    if (!x.siempre && !corto && !RE_VERBO_DISPOSITIVO.test(t.n)) continue;
    const r = { tipo: 'no_soportado', que: x.que };
    if (x.titulo) {
      let { fecha, conHora } = extraerFechaHora(t.n, c.ahora, { preferirManana: x.titulo === 'Alarma' });
      const dur = /\bde\s+(\d{1,3}|un|una|dos|tres|cinco|diez|quince|veinte|treinta)\s+(minutos?|horas?)\b/.exec(t.n);
      if (!fecha && dur) {
        const n = /^\d+$/.test(dur[1]) ? parseInt(dur[1], 10) : { un: 1, una: 1, dos: 2, tres: 3, cinco: 5, diez: 10, quince: 15, veinte: 20, treinta: 30 }[dur[1]];
        fecha = new Date(c.ahora.getTime() + n * (dur[2].startsWith('hora') ? 3600000 : 60000));
        conHora = true;
      }
      if (fecha) r.alternativa = { tipo: 'evento', titulo: x.titulo, fecha: fecha.toISOString(), conHora, duracion: 15 };
    }
    return r;
  }
  return null;
}

const RE_HORA = /^(?:(?:me\s+)?(?:decis|deci(?:me)?|dime|sabes)\s+(?:la\s+hora|que\s+hora\s+es)|que\s+hora\s+es|que\s+hora\s+tenes|que\s+horas\s+son|la\s+hora|hora|tenes\s+hora)(?:\s+(?:ahora|por\s+favor|porfa))?$/;
const RE_FECHA = /^(?:(?:me\s+)?(?:decis|decime|dime)\s+)?(?:que\s+(?:dia|fecha)\s+(?:es|estamos|tenemos)(?:\s+hoy)?|a\s+que\s+(?:dia|fecha)\s+estamos|en\s+que\s+(?:dia|fecha)\s+estamos|la\s+fecha(?:\s+de\s+hoy)?|fecha|que\s+dia\s+de\s+la\s+semana\s+es(?:\s+hoy)?|hoy\s+que\s+(?:dia|fecha)\s+es)$/;
const RE_CLIMA = /\b(?:clima|pronostico)\b|\b(?:que|como|cuanta|cuantos)\s+(?:tiempo|clima|temperatura|grados)\b|\bel\s+tiempo\b|\bhace\s+(?:frio|calor)\b|\b(?:va\s+a|esta)\s+(?:llover|lloviendo|nevar|nevando|hacer\s+(?:frio|calor))\b|\bllueve\b|\b(?:hay|va\s+a\s+haber)\s+(?:lluvia|tormenta|nieve|viento)\b|\btemperatura\s+(?:hay|hace|afuera)\b/;
const RE_AYUDA = /^(?:ayuda|ayudame|help|que\s+(?:podes|puedes|sabes)\s+hacer|que\s+haces|que\s+sabes\s+hacer|comandos|como\s+(?:funciona(?:s)?|te\s+uso|se\s+usa|funciona\s+esto)|instrucciones|opciones)\b/;

function rInfo(t) {
  const s = recortar(t).n;
  if (RE_HORA.test(s)) return { tipo: 'hora' };
  if (RE_FECHA.test(s)) return { tipo: 'fecha' };
  if (RE_AYUDA.test(s)) return { tipo: 'ayuda' };
  return null;
}

function rClima(t) {
  if (/^(?:busca|googlea|investiga|averigua)/.test(t.n) || !RE_CLIMA.test(t.n)) return null;
  const sinFranja = t.n.replace(/\b(?:a|de|por|en|durante)\s+la\s+manana\b/g, ' ');
  const cuando = /\bpasado\s+manana\b/.test(sinFranja) ? 2 : /\bmanana\b/.test(sinFranja) ? 1 : 0;
  let lugar = '';
  const m = /\b(?:en|de|para)\s+(?!(?:hoy|manana|pasado|ahora|la\s+semana|esta|este|la\s+tarde|la\s+noche|el\s+fin|afuera)\b)([a-z][a-z\s.]*?)(?:\s+(?:hoy|manana|pasado\s+manana|ahora|esta\s+semana|el\s+fin\s+de\s+semana))?\s*[?.!]*$/.exec(t.n);
  if (m) {
    const desde = m.index + m[0].indexOf(m[1]);
    lugar = recortar(cortar(t, desde, desde + m[1].length)).o;
  }
  return { tipo: 'clima', cuando, lugar };
}

const RE_NAV = new RegExp(
  `^${MODAL}(?:llevame|llevarme|llevanos|guiame|guia(?:me|nos)?|navega(?:r|me)?|` +
  'como\\s+(?:llego|llegar|voy|ir|hago\\s+para\\s+(?:llegar|ir)|se\\s+llega|se\\s+va|puedo\\s+(?:llegar|ir))|' +
  'indicaciones|direcciones|ruta|el\\s+camino|camino|(?:quiero|tengo\\s+que|necesito|hay\\s+que)\\s+ir|' +
  'dame\\s+(?:la\\s+ruta|indicaciones|el\\s+camino)|abri\\w*\\s+(?:waze|google\\s+maps|maps|el\\s+mapa)\\s+(?:y\\s+)?(?:llevame|navega(?:r)?|ir))\\b[\\s,]*' +
  '(?:(?:a\\s+la|al|a|hasta\\s+(?:el|la)|hasta|hacia|para\\s+(?:ir|llegar)\\s+(?:a\\s+la|al|a)|para|de\\s+como\\s+llegar\\s+(?:a\\s+la|al|a))\\s+)?',
);
const RE_NAV_WAZE = /^(?:(?:con|en|abri\w*)\s+)?waze\s+(?:y\s+)?(?:llevame\s+|navega\s+)?(?:a\s+la|al|a|hasta)\s+/;
const RE_NAV_APP = /\s*(?:(?:con|en|por|usando|via|x)\s+)?(?:el\s+)?(waze|google\s+maps|maps|apple\s+maps|mapas\s+de\s+apple)$/;
const RE_NAV_MODO = /\s*(?:(caminando|a\s+pie|andando)|(?:en\s+)?(colectivo|bondi|subte|tren|transporte(?:\s+publico)?|micro|omnibus|bus)|(?:en\s+)?(bici|bicicleta)|(?:en\s+)?(auto|coche|carro|moto|taxi|remis))\s*$/;
function rNavegar(t, c) {
  let m = RE_NAV_WAZE.exec(t.n);
  let app = m ? 'waze' : null;
  if (!m) m = RE_NAV.exec(t.n);
  if (!m) return null;
  if (!app) app = /waze/.test(m[0]) ? 'waze' : /maps|mapa/.test(m[0]) ? 'google' : null;
  let dest = recortar(cortar(t, m[0].length));
  let modo = null;
  for (let i = 0; i < 2; i++) {
    const a = RE_NAV_APP.exec(dest.n);
    if (a) { app = /waze/.test(a[1]) ? 'waze' : /apple/.test(a[1]) ? 'apple' : 'google'; dest = recortar(cortar(dest, 0, a.index)); }
    const mo = RE_NAV_MODO.exec(dest.n);
    if (mo) { modo = mo[1] ? 'pie' : mo[2] ? 'transporte' : mo[3] ? 'bici' : 'auto'; dest = recortar(cortar(dest, 0, mo.index)); }
  }
  const destino = limpiarDestinatario(dest);
  const clave = claveNombre(destino);
  const lugar = /^(?:mi\s+)?casa$/.test(clave) ? 'casa' : /^(?:mi\s+|el\s+)?(?:trabajo|laburo|oficina)$/.test(clave) ? 'trabajo' : null;
  const r = { tipo: 'navegar', destino };
  if (app) r.app = app;
  if (modo) r.modo = modo;
  if (lugar) r.lugar = lugar;
  return r;
}

function rMapa(t) {
  let m;
  let q = null;
  if (/^(?:donde\s+estoy|mi\s+ubicacion|mostra(?:me)?\s+(?:donde\s+estoy|mi\s+ubicacion))\s*[?.!]*$/.test(t.n)) {
    return { tipo: 'mapa', consulta: '', aqui: true };
  }
  if ((m = /^(?:a\s+)?donde\s+(?:queda|quedan|esta|estan|hay|habra|encuentro|consigo|compro|como|puedo\s+(?:comprar|encontrar|conseguir|comer))\s+/.exec(t.n))) {
    q = cortar(t, m[0].length);
  } else if ((m = /^(?:busca(?:me|r)?|mostra(?:me|r)?|encontra(?:me|r)?|ubica(?:me|r)?)\s+en\s+(?:el\s+)?(?:mapa|maps|google\s+maps)\s+/.exec(t.n))) {
    q = cortar(t, m[0].length);
  } else if ((m = /\s+en\s+(?:el\s+)?(?:mapa|maps|google\s+maps)\s*[?.!]*$/.exec(t.n)) && /^(?:busca|mostra|encontra|ubica)\w*\s+/.test(t.n)) {
    q = quitarInicio(cortar(t, 0, m.index), /^(?:busca|mostra|encontra|ubica)\w*\s+/);
  } else if ((m = /\s+(?:cerca(?:\s+(?:de\s+)?(?:aca|aqui|mio|mi|mi\s+casa))?|cercan[oa]s?|por\s+aca|por\s+aqui|por\s+la\s+zona)\s*[?.!]*$/.exec(t.n))) {
    q = quitarInicio(cortar(t, 0, m.index), /^(?:busca(?:me|r)?|mostra(?:me|r)?|hay|necesito|quiero|encontra(?:me|r)?|donde\s+hay)\s+/);
  } else {
    return null;
  }
  q = quitarInicio(recortar(q), /^(?:un|una|el|la|los|las|algun|alguna|algunos|algunas)\s+/);
  const consulta = recortar(q).o;
  return consulta ? { tipo: 'mapa', consulta } : null;
}

const RE_YT_FIN = /\s+(?:en|por|de|del)\s+(?:el\s+)?youtube\s*[?.!]*$/;
const RE_YT_VERBO = new RegExp(`^${MODAL}(?:busca(?:me|r)?|pone(?:me|r)?|reproduci(?:me|r)?|mostra(?:me|r)?|quiero\\s+ver|ver|abri(?:me|r)?|mira(?:r)?)\\s+`);
const RE_YT_INI = /^(?:(?:abri(?:me|r)?|abre|entra\s+a)\s+youtube\s+(?:y\s+)?(?:busca(?:me|r)?|pone(?:me|r)?|reproduci(?:me|r)?)|(?:busca(?:me|r)?|pone(?:me|r)?)\s+en\s+youtube|youtube(?!\s+music))\s+/;
const RE_VIDEO = new RegExp(`^${MODAL}(?:quiero\\s+ver|mostra(?:me|r)?|pone(?:me|r)?|busca(?:me|r)?|ver|mira(?:r)?)\\s+(?:un\\s+|el\\s+|los\\s+|unos\\s+|algun\\s+)?videos?\\s+(?:de\\s+|del\\s+|sobre\\s+|con\\s+)?`);
function rYoutube(t) {
  let m;
  let q = null;
  if ((m = RE_YT_FIN.exec(t.n))) q = quitarInicio(cortar(t, 0, m.index), RE_YT_VERBO);
  else if ((m = RE_YT_INI.exec(t.n))) q = cortar(t, m[0].length);
  else if ((m = RE_VIDEO.exec(t.n))) q = cortar(t, m[0].length);
  if (!q) return null;
  q = quitarInicio(recortar(q), /^(?:un\s+|el\s+|los\s+|unos\s+)?videos?\s+(?:de\s+|del\s+|sobre\s+)?/);
  return { tipo: 'youtube', consulta: recortar(q).o };
}

const APP_MUSICA = '(spotify|espotifai|youtube\\s+music|yt\\s+music|deezer|apple\\s+music|soundcloud|amazon\\s+music)';
const RE_MUSICA_FIN = new RegExp(`\\s+(?:en|por|de|con|desde)\\s+(?:el\\s+)?${APP_MUSICA}\\s*[?.!]*$`);
const RE_MUSICA_VERBO = new RegExp(`^${MODAL}(?:pone(?:me|r|nos)?|reproduci(?:me|r)?|toca(?:me|r)?|escuchar|quiero\\s+escuchar|tengo\\s+ganas\\s+de\\s+escuchar|pasa(?:me|r)?|play|escucha(?:r)?)\\s+`);
const RE_MUSICA_ABRIR = new RegExp(`^(?:abri(?:me|r)?|abre)\\s+${APP_MUSICA}\\s+(?:y\\s+)?(?:pone(?:me|r)?|reproduci(?:me|r)?|busca(?:me|r)?)\\s+`);
const RE_MUSICA_SOLA = /^(?:musica|canciones|temas|el\s+tema|la\s+cancion)\s+(?:de\s+los|de\s+las|de\s+la|del|de)\s+/;
const appMusica = (s) => (/spotify|espotifai/.test(s) ? 'spotify' : /music/.test(s) && /youtube|yt/.test(s) ? 'youtubemusic' : /deezer/.test(s) ? 'deezer' : /apple/.test(s) ? 'applemusic' : /soundcloud/.test(s) ? 'soundcloud' : /amazon/.test(s) ? 'amazonmusic' : null);
function rMusica(t) {
  let m;
  let q = null;
  let app = null;
  if ((m = RE_MUSICA_ABRIR.exec(t.n))) { app = appMusica(m[1]); q = cortar(t, m[0].length); }
  else if ((m = RE_MUSICA_VERBO.exec(t.n))) q = cortar(t, m[0].length);
  else if ((m = RE_MUSICA_SOLA.exec(t.n))) q = cortar(t, m[0].length);
  else if (RE_MUSICA_FIN.test(t.n)) q = t;
  if (!q) return null;
  const a = RE_MUSICA_FIN.exec(q.n);
  if (a) { app = appMusica(a[1]); q = cortar(q, 0, a.index); }
  q = quitarInicio(recortar(q), /^(?:la|las|lo|el|los)\s+de\s+(?=\S)/);
  q = quitarInicio(recortar(q), /^(?:(?:un\s+poco\s+de|algo\s+de|musica|la\s+musica|canciones|temas|la\s+cancion|el\s+tema|el\s+disco|el\s+album|la\s+playlist|una\s+playlist|playlist|la\s+lista|el\s+podcast|podcast|un\s+tema|una\s+cancion|algo)\s*(?:de\s+los\b|de\s+las\b|de\s+la\b|del\b|de\b|que\s+se\s+llama\b)?\s*)+/);
  const r = { tipo: 'musica', consulta: recortar(q).o };
  if (app) r.app = app;
  return r;
}

const RE_ABRIR = /^(?:abri(?:me|r|te)?|abre|abra|entra(?:r)?\s+(?:a|en|al)|inicia(?:r)?|ejecuta(?:r)?|lanza(?:r)?|arranca(?:r)?|open|anda\s+(?:a|al)|ir\s+(?:a|al)|ve\s+(?:a|al)|vamos\s+(?:a|al))\s+(?:(?:el|la|los|las|mi|mis)\s+)?(?:(?:app|aplicacion|programa)\s+(?:de\s+|del\s+)?)?/;
function rAbrir(t) {
  const m = RE_ABRIR.exec(t.n);
  if (!m) return null;
  const nombreT = recortar(cortar(t, m[0].length));
  if (!nombreT.n) return null;
  if (/^(?:mis\s+)?contactos$/.test(nombreT.n)) return { tipo: 'interno', pantalla: 'contactos' };
  if (/^(?:los\s+)?(?:ajustes|configuracion|opciones|preferencias)$/.test(nombreT.n)) return { tipo: 'interno', pantalla: 'ajustes' };
  if (/^(?:la\s+)?ayuda$/.test(nombreT.n)) return { tipo: 'interno', pantalla: 'ayuda' };
  const app = buscarApp(nombreT.o);
  if (app) return { tipo: 'abrir', appId: app.id, nombre: app.nombre };
  if (/^(?:anda|ir|ve|vamos)\s/.test(m[0])) return { tipo: 'navegar', destino: nombreT.o };
  return { tipo: 'abrir', appId: null, nombre: nombreT.o };
}

const RE_BUSCAR = /^(?:busca(?:me|r|lo)?|googlea(?:me|r)?|guglea(?:r)?|averigua(?:me|r)?|investiga(?:me|r)?|fijate|mostra(?:me|r)?|encontra(?:me|r)?)\s+(?:en\s+(?:google|internet|la\s+web)\s+)?(?:(?:sobre|acerca\s+de|informacion\s+(?:de|sobre)|info\s+(?:de|sobre))\s+)?/;
function rBuscar(t) {
  const m = RE_BUSCAR.exec(t.n);
  if (!m) return null;
  const q = recortar(quitarFinal(recortar(cortar(t, m[0].length)), /\s+en\s+(?:google|internet|la\s+web)$/));
  return q.o ? { tipo: 'buscar', consulta: q.o } : null;
}

const RE_PREGUNTA = /^(?:que|quien|quienes|cual|cuales|cuando|cuanto|cuanta|cuantos|cuantas|como|por\s+que|porque|para\s+que|donde|adonde|a\s+que|de\s+que|en\s+que|con\s+quien|es\s+verdad|sabes)\b/;
function rPregunta(t) {
  if (!RE_PREGUNTA.test(t.n) && !/\?\s*$/.test(t.o)) return null;
  return { tipo: 'buscar', consulta: recortar(t).o, pregunta: true };
}

function rAppSola(t) {
  const app = buscarApp(recortar(t).o);
  return app ? { tipo: 'abrir', appId: app.id, nombre: app.nombre } : null;
}

function rContactoSolo(t, c) {
  if (!c.contactos.length) return null;
  const b = buscarContacto(recortar(t).o, c.contactos);
  return b.estado === 'uno' && b.puntaje >= 85 ? { tipo: 'contacto', destinatario: recortar(t).o } : null;
}

const RECONOCEDORES = [
  rPersonalizado, rAbrirChat, rMensaje, rLlamada, rAgregarContacto, rAgenda, rNoSoportado,
  rInfo, rClima, rNavegar, rMapa, rYoutube, rMusica, rAbrir, rBuscar, rPregunta, rAppSola, rContactoSolo,
  rEventoSuelto,
];

/**
 * Entiende un pedido.
 * @param {string} texto lo que dijo o escribió el usuario
 * @param {{contactos?: object[], comandos?: object[], ajustes?: object, ahora?: Date}} ctx
 */
export function interpretar(texto, ctx = {}) {
  const original = String(texto ?? '').replace(/\s+/g, ' ').trim();
  let t = recortar(alinear(original), { mantenerFinal: true });
  if (!t.n.trim() || !/[a-z0-9]/.test(t.n)) return { tipo: 'vacio', texto: original };
  const limpio = recortar(t).n;
  if (RE_SALUDO.test(limpio)) return { tipo: 'saludo', texto: original };
  if (RE_GRACIAS.test(limpio)) return { tipo: 'gracias', texto: original };
  t = recortar(quitarInicio(t, CORTESIA_INI), { mantenerFinal: true });
  if (!t.n.trim()) return { tipo: 'saludo', texto: original };
  const c = {
    contactos: ctx.contactos || [],
    comandos: ctx.comandos || [],
    ajustes: ctx.ajustes || {},
    ahora: ctx.ahora || new Date(),
  };
  for (const reconocer of RECONOCEDORES) {
    const r = reconocer(t, c);
    if (r) return { ...r, texto: original };
  }
  return { tipo: 'desconocido', texto: original };
}

/** El dictado a veces da varias versiones posibles de lo que se dijo.
 *  Elige la que mejor se entiende (preferentemente con un contacto conocido). */
export function elegirMejor(alternativas, ctx = {}) {
  let mejor = null;
  let puntos = -1;
  (alternativas || []).filter(Boolean).forEach((texto, i) => {
    const r = interpretar(texto, ctx);
    let p = i === 0 ? 0.5 : 0;
    if (r.tipo === 'buscar' && r.pregunta) p += 1;
    else if (r.tipo !== 'desconocido' && r.tipo !== 'vacio') p += 2;
    if (r.destinatario && ctx.contactos && ctx.contactos.length) {
      const b = buscarContacto(r.destinatario, ctx.contactos);
      p += b.estado === 'uno' ? 2 : b.estado === 'varios' ? 1 : 0;
    }
    if (p > puntos) { puntos = p; mejor = { texto, intencion: r }; }
  });
  return mejor;
}
