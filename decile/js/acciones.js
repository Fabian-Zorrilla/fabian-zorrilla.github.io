// acciones.js — Convierte la intención en una "tarjeta": lo que se muestra
// para confirmar, con los enlaces que abren cada app.
//
// Ninguna página web puede apretar "Enviar" dentro de otra app. Lo que sí
// puede es abrirla con todo listo (chat, mensaje, destino, búsqueda...). Por
// eso cada tarjeta tiene un botón principal que es un enlace, y a veces un
// enlace alternativo por si el primero no abre la app en ese teléfono.

import { buscarContacto, telefonoPrincipal, emailPrincipal } from './contactos.js';
import { paraWhatsApp, paraLlamar, mostrarNumero, numeroDudoso, esNumero } from './telefono.js';
import { describirFecha } from './fechas.js';
import { appPorId } from './apps.js';
import { capitalizar } from './texto.js';

const enc = encodeURIComponent;
const dos = (n) => String(n).padStart(2, '0');

/** 'ios' | 'android' | 'otro' */
export function detectarPlataforma(ua = globalThis.navigator?.userAgent || '', toques = globalThis.navigator?.maxTouchPoints || 0) {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && toques > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'otro';
}

/** Enlace "intent://" de Android: abre justo esa app, o la web si no está. */
export function intentAndroid(url, paquete, respaldo) {
  const m = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(url);
  if (!m || !paquete) return url;
  const fallback = respaldo ? `S.browser_fallback_url=${enc(respaldo)};` : '';
  return `intent://${m[2]}#Intent;scheme=${m[1]};package=${paquete};${fallback}end`;
}

// ---------------------------------------------------------------------------
// Enlaces
// ---------------------------------------------------------------------------
export function enlaceWhatsApp(numero, texto, plat) {
  const t = texto ? enc(texto) : '';
  const web = `https://wa.me/${numero || ''}${t ? `?text=${t}` : ''}`;
  const params = [numero ? `phone=${numero}` : '', t ? `text=${t}` : ''].filter(Boolean).join('&');
  const esquema = `whatsapp://send${params ? `?${params}` : ''}`;
  if (plat === 'ios') return { href: esquema, alt: web };
  if (plat === 'android') return { href: web, alt: intentAndroid(esquema, 'com.whatsapp', web) };
  return { href: web, alt: `https://web.whatsapp.com/send${params ? `?${params}` : ''}` };
}

export function enlaceSMS(numero, texto, plat) {
  const n = numero || '';
  const t = texto ? enc(texto) : '';
  const conPregunta = `sms:${n}${t ? `?body=${t}` : ''}`;
  const conAmp = `sms:${n}${t ? `&body=${t}` : ''}`;
  const [href, alt] = plat === 'ios' ? [conAmp, conPregunta] : [conPregunta, conAmp];
  return { href, alt: alt !== href ? alt : null };
}

export function enlaceMail(para, asunto, cuerpo, plat) {
  const q = [asunto ? `subject=${enc(asunto)}` : '', cuerpo ? `body=${enc(cuerpo)}` : ''].filter(Boolean).join('&');
  const href = `mailto:${para || ''}${q ? `?${q}` : ''}`;
  let alt;
  if (plat === 'ios') {
    alt = `googlegmail:///co?${[para ? `to=${enc(para)}` : '', q].filter(Boolean).join('&')}`;
  } else {
    const g = [para ? `to=${enc(para)}` : '', asunto ? `su=${enc(asunto)}` : '', cuerpo ? `body=${enc(cuerpo)}` : ''].filter(Boolean).join('&');
    alt = `https://mail.google.com/mail/?view=cm&fs=1${g ? `&${g}` : ''}`;
  }
  return { href, alt };
}

export function enlaceTelegram(texto) {
  const t = enc(texto || '');
  return { href: `tg://msg?text=${t}`, alt: `https://t.me/share/url?url=%20&text=${t}` };
}

const MODOS = {
  auto: { google: 'driving', apple: 'd', texto: 'en auto' },
  pie: { google: 'walking', apple: 'w', texto: 'caminando' },
  transporte: { google: 'transit', apple: 'r', texto: 'en transporte público' },
  bici: { google: 'bicycling', apple: 'w', texto: 'en bici' },
};

export function enlaceNavegar(destino, app, modo, plat) {
  const d = enc(destino);
  const m = MODOS[modo] || MODOS.auto;
  if (app === 'waze') return { href: `https://waze.com/ul?q=${d}&navigate=yes`, alt: `waze://?q=${d}&navigate=yes`, nombreApp: 'Waze' };
  if (app === 'apple') return { href: `https://maps.apple.com/?daddr=${d}&dirflg=${m.apple}`, alt: `maps://?daddr=${d}&dirflg=${m.apple}`, nombreApp: 'Apple Maps' };
  const web = `https://www.google.com/maps/dir/?api=1&destination=${d}&travelmode=${m.google}`;
  const alt = plat === 'ios' ? `comgooglemaps://?daddr=${d}&directionsmode=${m.google}`
    : plat === 'android' ? intentAndroid(web, 'com.google.android.apps.maps', web) : null;
  return { href: web, alt, nombreApp: 'Google Maps' };
}

export function enlaceMapa(consulta, app, plat) {
  if (!consulta) return { href: 'https://www.google.com/maps/@?api=1&map_action=map', alt: null, nombreApp: 'Google Maps' };
  const q = enc(consulta);
  if (app === 'apple') return { href: `https://maps.apple.com/?q=${q}`, alt: `maps://?q=${q}`, nombreApp: 'Apple Maps' };
  if (app === 'waze') return { href: `https://waze.com/ul?q=${q}`, alt: `waze://?q=${q}`, nombreApp: 'Waze' };
  const web = `https://www.google.com/maps/search/?api=1&query=${q}`;
  const alt = plat === 'ios' ? `comgooglemaps://?q=${q}` : plat === 'android' ? `geo:0,0?q=${q}` : null;
  return { href: web, alt, nombreApp: 'Google Maps' };
}

export function enlaceYoutube(consulta, plat) {
  const web = consulta ? `https://www.youtube.com/results?search_query=${enc(consulta)}` : 'https://www.youtube.com/';
  if (plat === 'ios') return { href: web, alt: consulta ? `youtube://www.youtube.com/results?search_query=${enc(consulta)}` : 'youtube://', nombreApp: 'YouTube' };
  if (plat === 'android') return { href: web, alt: intentAndroid(web, 'com.google.android.youtube', web), nombreApp: 'YouTube' };
  return { href: web, alt: null, nombreApp: 'YouTube' };
}

export function enlaceMusica(consulta, app, plat) {
  const q = enc(consulta || '');
  switch (app) {
    case 'youtubemusic': {
      const web = consulta ? `https://music.youtube.com/search?q=${q}` : 'https://music.youtube.com/';
      return { href: web, alt: plat === 'android' ? intentAndroid(web, 'com.google.android.apps.youtube.music', web) : null, nombreApp: 'YouTube Music' };
    }
    case 'youtube':
      return enlaceYoutube(consulta, plat);
    case 'deezer':
      return { href: consulta ? `https://www.deezer.com/search/${q}` : 'https://www.deezer.com/', alt: consulta ? `deezer://www.deezer.com/search/${q}` : 'deezer://', nombreApp: 'Deezer' };
    case 'applemusic':
      return { href: consulta ? `https://music.apple.com/search?term=${q}` : 'https://music.apple.com/', alt: null, nombreApp: 'Apple Music' };
    case 'soundcloud':
      return { href: consulta ? `https://soundcloud.com/search?q=${q}` : 'https://soundcloud.com/', alt: null, nombreApp: 'SoundCloud' };
    case 'amazonmusic':
      return { href: consulta ? `https://music.amazon.com/search/${q}` : 'https://music.amazon.com/', alt: null, nombreApp: 'Amazon Music' };
    default: {
      const web = consulta ? `https://open.spotify.com/search/${q}` : 'https://open.spotify.com/';
      return { href: web, alt: consulta ? `spotify:search:${q}` : 'spotify:', nombreApp: 'Spotify' };
    }
  }
}

export const enlaceBuscar = (consulta) => ({ href: `https://www.google.com/search?q=${enc(consulta)}`, alt: null });

export function enlaceAbrirApp(app, plat) {
  if (plat === 'android' && app.android) return { href: intentAndroid(app.web, app.android, app.web), alt: app.web };
  if (plat === 'ios' && app.ios) return { href: app.ios, alt: app.web };
  return { href: app.web, alt: null };
}

const fmtLocal = (d) => `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}T${dos(d.getHours())}${dos(d.getMinutes())}00`;
const fmtDia = (d) => `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}`;
const fmtUTC = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const diaSiguiente = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

/** Enlace a Google Calendar con el evento cargado (falta tocar "Guardar"). */
export function enlaceCalendario({ titulo, fecha, conHora, duracion = 60 }, zona = '') {
  let fechas = '';
  if (fecha) {
    const ini = new Date(fecha);
    fechas = conHora
      ? `&dates=${fmtLocal(ini)}/${fmtLocal(new Date(ini.getTime() + duracion * 60000))}${zona ? `&ctz=${enc(zona)}` : ''}`
      : `&dates=${fmtDia(ini)}/${fmtDia(diaSiguiente(ini))}`;
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${enc(titulo || 'Evento')}${fechas}&details=${enc('Creado con Decile')}`;
}

const escICS = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Archivo .ics (calendario del teléfono) con aviso 10 minutos antes. */
export function crearICS({ titulo, fecha, conHora, duracion = 60 }, ahora = new Date()) {
  const ini = fecha ? new Date(fecha) : ahora;
  const l = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Voy Avanzando//Decile//ES', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${ahora.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}@voyavanzando.com`,
    `DTSTAMP:${fmtUTC(ahora)}`,
  ];
  if (conHora || !fecha) {
    l.push(`DTSTART:${fmtLocal(ini)}`, `DTEND:${fmtLocal(new Date(ini.getTime() + duracion * 60000))}`);
  } else {
    l.push(`DTSTART;VALUE=DATE:${fmtDia(ini)}`, `DTEND;VALUE=DATE:${fmtDia(diaSiguiente(ini))}`);
  }
  l.push(
    `SUMMARY:${escICS(titulo || 'Evento')}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escICS(titulo || 'Evento')}`,
    `TRIGGER:${conHora || !fecha ? '-PT10M' : 'PT9H'}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR',
  );
  return l.join('\r\n');
}

// ---------------------------------------------------------------------------
// Tarjetas
// ---------------------------------------------------------------------------
const NOMBRE_CANAL = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'Mail', telegram: 'Telegram' };
const ICONO = {
  whatsapp: '💬', sms: '✉️', email: '📧', telegram: '✈️', llamar: '📞', navegar: '🧭', mapa: '🗺️',
  youtube: '▶️', musica: '🎵', buscar: '🔎', abrir: '📱', evento: '📅', hora: '🕐', fecha: '📆',
  clima: '⛅', agregar_contacto: '👤', contacto: '👤', personalizado: '⭐', no_soportado: '🚫',
  saludo: '👋', gracias: '😊', desconocido: '🤔', vacio: '🎙️', ayuda: '❓', interno: '⚙️',
};
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const resumenContacto = (c) => ({ id: c.id, nombre: c.nombre, detalle: telefonoPrincipal(c) || emailPrincipal(c) || '' });

/** ¿A quién? → { contacto } | { numero } | { elegir } */
export function resolverDestino(it, ctx) {
  if (it.contactoId) {
    const c = (ctx.contactos || []).find((x) => x.id === it.contactoId);
    if (c) return { contacto: c };
  }
  if (it.numero) return { numero: it.numero };
  const d = String(it.destinatario || '').trim();
  if (!d) return { elegir: { motivo: 'falta', consulta: '', candidatos: [] } };
  if (esNumero(d)) return { numero: d };
  const b = buscarContacto(d, ctx.contactos || []);
  if (b.estado === 'uno') return { contacto: b.contacto };
  return { elegir: { motivo: b.estado, consulta: d, candidatos: b.candidatos.map(resumenContacto) } };
}

function decirEleccion(elegir, canal) {
  if (elegir.motivo === 'falta') return `¿A quién le mando el ${canal}?`;
  if (elegir.motivo === 'varios') return `Tengo varios contactos parecidos a ${elegir.consulta}. ¿Cuál es?`;
  return `No encontré a ${elegir.consulta} en tus contactos.`;
}

function tarjetaMensaje(it, ctx) {
  const canal = it.tipo;
  const nombreCanal = NOMBRE_CANAL[canal];
  const plat = ctx.plataforma;
  const { contacto, numero, elegir } = resolverDestino(it, ctx);
  const nombre = contacto ? contacto.nombre : numero || '';
  const avisos = [];
  const mensaje = it.mensaje || '';
  const t = {
    tipo: canal, icono: ICONO[canal], titulo: nombre ? `${nombreCanal} para ${nombre}` : nombreCanal, detalle: '',
    editables: [{ campo: 'mensaje', etiqueta: 'Mensaje', valor: mensaje, multilinea: true }],
    botones: [], avisos, elegir: null, nota: '', decir: '',
  };
  let destino = '';
  if (canal === 'email') {
    destino = contacto ? emailPrincipal(contacto) : '';
    if (contacto && !destino) avisos.push(`${contacto.nombre} no tiene mail cargado: elegí el destinatario en la app de correo.`);
    t.detalle = destino;
    t.editables.unshift({ campo: 'asunto', etiqueta: 'Asunto', valor: it.asunto || '' });
  } else if (canal !== 'telegram') {
    const tel = contacto ? telefonoPrincipal(contacto) : numero;
    if (contacto && !tel) avisos.push(`${contacto.nombre} no tiene teléfono cargado. Agregalo en Contactos.`);
    if (tel) {
      destino = canal === 'whatsapp' ? paraWhatsApp(tel, ctx.ajustes) : paraLlamar(tel);
      if (canal === 'whatsapp' && numeroDudoso(destino)) avisos.push('Revisá el número: no parece completo (¿le falta el código de área?).');
      t.detalle = canal === 'whatsapp' ? mostrarNumero(destino) : tel;
    }
  }
  if (!contacto && !numero) t.elegir = elegir;
  if (it.ubicacion && !mensaje) t.pendiente = 'ubicacion';
  if (it.audio) avisos.push('Para mandar un audio, mantené apretado el micrófono dentro del chat.');

  let l;
  if (canal === 'whatsapp') l = enlaceWhatsApp(destino, mensaje, plat);
  else if (canal === 'sms') l = enlaceSMS(destino, mensaje, plat);
  else if (canal === 'email') l = enlaceMail(destino, it.asunto, mensaje, plat);
  else l = enlaceTelegram(mensaje);

  const listo = canal === 'telegram' || !!destino || (canal === 'email' && !!contacto);
  if (listo) {
    t.botones.push({ texto: mensaje ? `Enviar por ${nombreCanal}` : `Abrir ${nombreCanal}`, href: l.href, alt: l.alt, principal: true });
    t.nota = canal === 'telegram' ? 'Se abre Telegram: elegí el chat y mandalo.'
      : `Se abre ${nombreCanal === 'Mail' ? 'el correo' : nombreCanal} con todo listo: solo tocá enviar.`;
  } else {
    t.botones.push({ texto: `Elegir el destinatario en ${nombreCanal === 'Mail' ? 'el correo' : nombreCanal}`, href: l.href, alt: l.alt, principal: !(elegir && elegir.candidatos.length) });
  }
  if (t.elegir) t.decir = decirEleccion(t.elegir, nombreCanal);
  else if (mensaje) t.decir = `${nombreCanal} para ${nombre || 'elegir'}: ${mensaje}`;
  else t.decir = `${nombreCanal} para ${nombre}. ¿Qué le querés decir?`;
  return t;
}

function tarjetaLlamar(it, ctx) {
  const { contacto, numero, elegir } = resolverDestino(it, ctx);
  const tel = contacto ? telefonoPrincipal(contacto) : numero;
  const nombre = contacto ? contacto.nombre : numero || '';
  const t = { tipo: 'llamar', icono: ICONO.llamar, titulo: nombre ? `Llamar a ${nombre}` : 'Llamar', detalle: tel || '', botones: [], avisos: [], elegir: null, decir: '' };
  if (!contacto && !numero) {
    t.elegir = elegir;
    t.decir = decirEleccion(elegir, 'llamado').replace('¿A quién le mando el llamado?', '¿A quién llamo?');
    return t;
  }
  if (!tel) {
    t.avisos.push(`${nombre} no tiene teléfono cargado. Agregalo en Contactos.`);
    t.decir = `${nombre} no tiene teléfono cargado.`;
    return t;
  }
  if (it.porWhatsapp) {
    const l = enlaceWhatsApp(paraWhatsApp(tel, ctx.ajustes), '', ctx.plataforma);
    t.titulo = `Llamar a ${nombre} por WhatsApp`;
    t.botones.push({ texto: 'Abrir el chat', href: l.href, alt: l.alt, principal: true });
    t.nota = 'En el chat tocá el teléfono (o la cámara para videollamada).';
    t.decir = `Abro el chat de ${nombre} en WhatsApp.`;
    return t;
  }
  t.botones.push({ texto: 'Llamar', href: `tel:${paraLlamar(tel)}`, principal: true });
  t.decir = `Llamo a ${nombre}.`;
  return t;
}

function tarjetaNavegar(it, ctx) {
  let destino = it.destino || '';
  const t = { tipo: 'navegar', icono: ICONO.navegar, titulo: '', detalle: '', botones: [], avisos: [], editables: [], decir: '' };
  const nombreLugar = it.lugar === 'casa' ? 'tu casa' : it.lugar === 'trabajo' ? 'tu trabajo' : '';
  if (it.lugar) {
    const dir = String((ctx.ajustes || {})[it.lugar] || '').trim();
    if (dir) destino = dir;
    else {
      t.avisos.push(`Todavía no cargaste la dirección de ${nombreLugar}.`);
      t.botones.push({ texto: 'Cargarla en Ajustes', accion: { tipo: 'pantalla', pantalla: 'ajustes' } });
      destino = '';
    }
  }
  t.editables.push({ campo: 'destino', etiqueta: '¿A dónde?', valor: destino });
  if (!destino) {
    t.titulo = nombreLugar ? `Ir a ${nombreLugar}` : '¿A dónde vamos?';
    t.decir = nombreLugar ? `Todavía no cargaste la dirección de ${nombreLugar}.` : '¿A dónde querés ir?';
    return t;
  }
  const app = it.app || (ctx.ajustes || {}).appMapas || 'google';
  const l = enlaceNavegar(destino, app, it.modo, ctx.plataforma);
  t.titulo = `Cómo llegar a ${nombreLugar || destino}`;
  t.detalle = `${l.nombreApp} · ${(MODOS[it.modo] || MODOS.auto).texto}`;
  t.botones.unshift({ texto: `Abrir ${l.nombreApp}`, href: l.href, alt: l.alt, principal: true });
  t.decir = `Vamos a ${nombreLugar || destino}.`;
  return t;
}

function tarjetaEvento(it, ctx) {
  const fecha = it.fecha ? new Date(it.fecha) : null;
  const cuando = fecha ? describirFecha(fecha, it.conHora, ctx.ahora) : '';
  const ics = `data:text/calendar;charset=utf-8,${enc(crearICS(it, ctx.ahora))}`;
  return {
    tipo: 'evento', icono: ICONO.evento, titulo: it.titulo || 'Evento',
    detalle: cuando ? capitalizar(cuando) : 'Sin fecha: la elegís en el calendario',
    editables: [{ campo: 'titulo', etiqueta: 'Título', valor: it.titulo || '' }],
    botones: [
      { texto: 'Agregar a Google Calendar', href: enlaceCalendario(it, ctx.zona), principal: true },
      { texto: 'Agregar al calendario del teléfono', href: ics, descarga: 'evento.ics' },
    ],
    avisos: [], nota: 'Se abre el calendario con el evento cargado: tocá Guardar.',
    decir: `${it.titulo || 'Evento'}${cuando ? `, ${cuando}` : ''}. Tocá para agregarlo al calendario.`,
  };
}

function horaTexto(d) {
  const h = d.getHours();
  return `${h === 1 ? 'Es la' : 'Son las'} ${h}:${dos(d.getMinutes())}`;
}

const fechaTexto = (d) => `Hoy es ${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;

const ABRE_DIRECTO = new Set(['whatsapp', 'sms', 'email', 'telegram', 'llamar', 'navegar', 'mapa', 'youtube', 'musica', 'abrir', 'evento', 'personalizado']);
const MENSAJERIA = new Set(['whatsapp', 'sms', 'email', 'telegram']);

/**
 * Si el pedido está claro y completo, devuelve el enlace para abrir la app
 * DIRECTO (con el mensaje ya cargado: la persona solo toca «Enviar» ahí).
 * Devuelve null si conviene mostrar primero la tarjeta: falta elegir a quién,
 * falta el mensaje, hay un aviso para revisar o algo todavía se está buscando.
 */
export function enlaceDirecto(it, t) {
  if (!it || !t || !ABRE_DIRECTO.has(it.tipo) || t.elegir || t.pendiente) return null;
  if ((t.avisos || []).length && !it.audio) return null;
  if (it.tipo === 'abrir' && !it.appId) return null;
  if (MENSAJERIA.has(it.tipo) && !it.audio && !String(it.mensaje || '').trim()) return null;
  const b = (t.botones || []).find((x) => x.principal && x.href);
  return b ? b.href : null;
}

/**
 * Arma la tarjeta para una intención.
 * @param {object} it intención (de interpretar())
 * @param {{contactos, ajustes, plataforma, ahora, zona, comandos}} ctx
 */
export function armarTarjeta(it, ctx = {}) {
  const c = { contactos: [], ajustes: {}, plataforma: 'otro', ahora: new Date(), ...ctx };
  const plat = c.plataforma;
  const base = { tipo: it.tipo, icono: ICONO[it.tipo] || '✨', titulo: '', detalle: '', botones: [], avisos: [], editables: [], nota: '', respuesta: '', decir: '' };
  switch (it.tipo) {
    case 'whatsapp': case 'sms': case 'email': case 'telegram':
      return { ...base, ...tarjetaMensaje(it, c) };
    case 'llamar':
      return { ...base, ...tarjetaLlamar(it, c) };
    case 'navegar':
      return { ...base, ...tarjetaNavegar(it, c) };
    case 'evento':
      return { ...base, ...tarjetaEvento(it, c) };
    case 'mapa': {
      const l = enlaceMapa(it.consulta, c.ajustes.appMapas, plat);
      return { ...base, titulo: it.consulta ? `Buscar «${it.consulta}» en el mapa` : 'Dónde estoy', detalle: l.nombreApp,
        botones: [{ texto: `Abrir ${l.nombreApp}`, href: l.href, alt: l.alt, principal: true }],
        decir: it.consulta ? `Busco ${it.consulta} en el mapa.` : 'Abro el mapa.' };
    }
    case 'youtube': {
      const l = enlaceYoutube(it.consulta, plat);
      return { ...base, titulo: it.consulta ? `Buscar «${it.consulta}» en YouTube` : 'Abrir YouTube', detalle: 'YouTube',
        botones: [{ texto: 'Abrir YouTube', href: l.href, alt: l.alt, principal: true }],
        decir: it.consulta ? `Busco ${it.consulta} en YouTube.` : 'Abro YouTube.' };
    }
    case 'musica': {
      const l = enlaceMusica(it.consulta, it.app || c.ajustes.appMusica, plat);
      return { ...base, titulo: it.consulta ? `Poner «${it.consulta}»` : `Abrir ${l.nombreApp}`, detalle: l.nombreApp,
        botones: [{ texto: `Abrir ${l.nombreApp}`, href: l.href, alt: l.alt, principal: true }],
        nota: it.consulta ? 'Se abre la búsqueda: tocá play en lo que quieras escuchar.' : '',
        decir: it.consulta ? `Busco ${it.consulta} en ${l.nombreApp}.` : `Abro ${l.nombreApp}.` };
    }
    case 'buscar': {
      const l = enlaceBuscar(it.consulta);
      return { ...base, titulo: `Buscar «${it.consulta}»`, detalle: 'Google',
        botones: [{ texto: 'Buscar en Google', href: l.href, principal: true }], decir: `Busco ${it.consulta}.` };
    }
    case 'abrir': {
      const app = it.appId ? appPorId(it.appId) : null;
      if (!app) {
        return { ...base, titulo: `No conozco la app «${it.nombre}»`,
          botones: [{ texto: `Buscar «${it.nombre}» en Google`, href: enlaceBuscar(`${it.nombre} app`).href, principal: true }],
          nota: 'Podés agregarla en Ajustes → Mis comandos.', decir: `No conozco la app ${it.nombre}.` };
      }
      const l = enlaceAbrirApp(app, plat);
      return { ...base, titulo: `Abrir ${app.nombre}`, botones: [{ texto: `Abrir ${app.nombre}`, href: l.href, alt: l.alt, principal: true }], decir: `Abro ${app.nombre}.` };
    }
    case 'personalizado': {
      const cmd = (c.comandos || []).find((x) => x.id === it.comandoId) || { nombre: it.nombre, url: it.url };
      const url = String(cmd.url || '').replace(/\{texto\}/g, enc(it.extra || ''));
      return { ...base, titulo: cmd.nombre || 'Mi comando', detalle: it.extra || '',
        botones: url ? [{ texto: `Abrir: ${cmd.nombre || 'comando'}`, href: url, principal: true }] : [],
        decir: `${cmd.nombre || 'Tu comando'}.` };
    }
    case 'agregar_contacto': {
      const intl = paraWhatsApp(it.telefono, c.ajustes);
      return { ...base, titulo: `Guardar a ${it.nombre}`, detalle: it.telefono + (intl ? ` · WhatsApp ${mostrarNumero(intl)}` : ''),
        botones: [{ texto: 'Guardar contacto', accion: { tipo: 'guardarContacto', contacto: { nombre: it.nombre, telefonos: [it.telefono] } }, principal: true }],
        decir: `¿Guardo a ${it.nombre}?` };
    }
    case 'contacto': {
      const { contacto } = resolverDestino(it, c);
      if (!contacto) break;
      const tel = telefonoPrincipal(contacto);
      const mail = emailPrincipal(contacto);
      const botones = [];
      if (tel) {
        const w = enlaceWhatsApp(paraWhatsApp(tel, c.ajustes), '', plat);
        botones.push({ texto: 'WhatsApp', href: w.href, alt: w.alt, principal: true });
        botones.push({ texto: 'Llamar', href: `tel:${paraLlamar(tel)}` });
        botones.push({ texto: 'SMS', href: enlaceSMS(paraLlamar(tel), '', plat).href });
      }
      if (mail) botones.push({ texto: 'Mail', href: `mailto:${mail}` });
      return { ...base, titulo: contacto.nombre, detalle: [tel, mail].filter(Boolean).join(' · '), botones, decir: `${contacto.nombre}. ¿Qué hago?` };
    }
    case 'hora': {
      const r = horaTexto(c.ahora);
      return { ...base, titulo: 'La hora', respuesta: r, decir: r };
    }
    case 'fecha': {
      const r = fechaTexto(c.ahora);
      return { ...base, titulo: 'La fecha', respuesta: r, decir: r };
    }
    case 'clima':
      return { ...base, titulo: it.lugar ? `El clima en ${it.lugar}` : 'El clima', respuesta: 'Consultando el pronóstico…', pendiente: 'clima' };
    case 'no_soportado': {
      const t = { ...base, titulo: 'Eso no lo puedo hacer', respuesta: `Una app web no puede ${it.que}.`,
        nota: 'Por seguridad, el teléfono no deja que las páginas web cambien sus ajustes. Para eso usá el asistente del teléfono (Google o Siri).',
        decir: `Una app web no puede ${it.que}.` };
      if (it.alternativa) {
        const f = describirFecha(new Date(it.alternativa.fecha), it.alternativa.conHora, c.ahora);
        t.botones.push({ texto: `Crear un recordatorio para ${f}`, accion: { tipo: 'intencion', intencion: it.alternativa }, principal: true });
        t.decir += ` Te puedo crear un recordatorio en el calendario para ${f}.`;
      }
      return t;
    }
    case 'interno':
    case 'ayuda':
      return { ...base, titulo: 'Ayuda', accion: { tipo: 'pantalla', pantalla: it.pantalla || 'ayuda' } };
    case 'saludo':
      return { ...base, titulo: '¡Hola!', respuesta: '¡Hola! Decime qué necesitás.', decir: '¡Hola! Decime qué necesitás.', ejemplos: true };
    case 'gracias':
      return { ...base, titulo: '¡De nada!', respuesta: '¡De nada! 😊', decir: '¡De nada!' };
    case 'vacio':
      return { ...base, titulo: 'No escuché nada', respuesta: 'No escuché nada. Probá de nuevo, más cerca del micrófono.', decir: 'No te escuché.' };
    default:
      break;
  }
  return {
    ...base, tipo: 'desconocido', icono: ICONO.desconocido, titulo: 'No te entendí',
    respuesta: `No entendí «${it.texto || ''}».`,
    botones: it.texto ? [{ texto: 'Buscarlo en Google', href: enlaceBuscar(it.texto).href }] : [],
    decir: 'No te entendí. Mirá los ejemplos o buscalo en Google.', ejemplos: true,
  };
}
