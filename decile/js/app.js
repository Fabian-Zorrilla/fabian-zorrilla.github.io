// app.js — La pantalla de Decile: une el micrófono, el parser y las tarjetas.

import { interpretar, elegirMejor } from './parser.js';
import { armarTarjeta, detectarPlataforma, enlaceDirecto } from './acciones.js';
import { fusionarContactos, crearContacto, ordenarContactos, claveNombre, puntaje, telefonoPrincipal, emailPrincipal } from './contactos.js';
import { paraWhatsApp, mostrarNumero, numeroDudoso } from './telefono.js';
import { leerVCard } from './vcard.js';
import { capitalizar, normalizar } from './texto.js';
import { puedeEscuchar, escuchar, explicarError, hablar, callar, precargarVoces } from './voz.js';
import { consultarClima } from './clima.js';
import * as almacen from './almacen.js';

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

/** Crea un elemento: el('a', { href, text: 'hola', onclick }, hijos...) */
function el(tag, props = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const h of hijos.flat()) if (h != null && h !== false) e.append(h instanceof Node ? h : String(h));
  return e;
}

const iconoSVG = (id) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icono');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
};

const ZONA = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } })();

const estado = {
  ajustes: almacen.cargarAjustes(),
  contactos: almacen.cargarContactos(),
  comandos: almacen.cargarComandos(),
  historial: almacen.cargarHistorial(),
  plataforma: detectarPlataforma(),
  intencion: null,
  entendido: '',
  escucha: null,
  instalador: null,
};

const ctx = () => ({
  contactos: estado.contactos, comandos: estado.comandos, ajustes: estado.ajustes,
  plataforma: estado.plataforma, ahora: new Date(), zona: ZONA,
});

// ---------------------------------------------------------------------------
// Avisos y confirmaciones (en pantalla: los alert() se pierden en el celular)
// ---------------------------------------------------------------------------
let temporizadorAviso = null;
function avisar(texto, ms = 3200) {
  const a = $('#aviso');
  a.textContent = texto;
  a.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { a.hidden = true; }, ms);
}

function confirmar(texto) {
  const d = $('#dialogo-confirmar');
  $('#texto-confirmar').textContent = texto;
  return new Promise((resolver) => {
    d.addEventListener('close', () => resolver(d.returnValue === 'si'), { once: true });
    d.returnValue = '';
    d.showModal();
  });
}

function decir(texto) {
  if (estado.ajustes.hablar && texto) hablar(texto.replace(/°/g, ' grados'), estado.ajustes.idioma);
}

// ---------------------------------------------------------------------------
// Micrófono
// ---------------------------------------------------------------------------
const TEXTO_QUIETO = 'Tocá el micrófono y decime qué hago';

function ponerEstado(modo, texto) {
  const mic = $('#mic');
  mic.classList.toggle('escuchando', modo === 'escuchando');
  mic.classList.toggle('procesando', modo === 'procesando');
  mic.setAttribute('aria-pressed', String(modo === 'escuchando'));
  mic.setAttribute('aria-label', modo === 'escuchando' ? 'Dejar de escuchar' : 'Hablar');
  $('#estado').textContent = texto || (modo === 'escuchando' ? 'Te escucho…' : TEXTO_QUIETO);
}

function alTocarMic({ automatico = false } = {}) {
  if (estado.escucha) { estado.escucha.detener(); return; }
  if (!puedeEscuchar) {
    ponerEstado('quieto', explicarError('no-soportado'));
    $('#entrada').focus();
    return;
  }
  callar();
  $('#transcripcion').textContent = '';
  ponerEstado('escuchando');
  estado.escucha = escuchar({
    idioma: estado.ajustes.idioma,
    alParcial: (t) => { $('#transcripcion').textContent = t; },
    alFinal: (versiones) => {
      estado.escucha = null;
      ponerEstado('quieto');
      $('#transcripcion').textContent = '';
      procesar(versiones);
    },
    alError: (codigo) => {
      estado.escucha = null;
      ponerEstado('quieto', automatico && /allowed/.test(codigo) ? TEXTO_QUIETO : explicarError(codigo));
    },
    alTerminar: () => {
      estado.escucha = null;
      ponerEstado('quieto', automatico ? TEXTO_QUIETO : explicarError('no-speech'));
    },
  });
  if (!estado.escucha) ponerEstado('quieto', explicarError('no-arranca'));
}

/** Dictar solo el mensaje (botoncito 🎤 al lado del texto). */
function dictarEn(control, boton) {
  if (estado.escucha) { estado.escucha.detener(); return; }
  if (!puedeEscuchar) { control.focus(); return; }
  callar();
  const previo = control.value.trim();
  const unir = (t) => (previo ? `${previo} ${t}` : capitalizar(t));
  boton.classList.add('escuchando');
  const fin = () => { estado.escucha = null; boton.classList.remove('escuchando'); };
  estado.escucha = escuchar({
    idioma: estado.ajustes.idioma,
    alParcial: (t) => { control.value = unir(t); },
    alFinal: (versiones) => {
      fin();
      control.value = unir(versiones[0]);
      control.dispatchEvent(new Event('input'));
    },
    alError: (codigo) => { fin(); control.value = previo; avisar(explicarError(codigo)); },
    alTerminar: () => { fin(); control.value = previo; },
  });
  if (!estado.escucha) fin();
}

// ---------------------------------------------------------------------------
// Entender y mostrar
// ---------------------------------------------------------------------------
function procesar(versiones) {
  const lista = (Array.isArray(versiones) ? versiones : [versiones]).map((s) => String(s || '').trim()).filter(Boolean);
  if (!lista.length) return;
  if (!estado.escucha) ponerEstado('quieto');
  const mejor = elegirMejor(lista, ctx());
  estado.entendido = mejor.texto;
  mostrarIntencion(mejor.intencion, { guardar: true, directo: true });
}

// El navegador deja abrir otra app solo cerca de un toque (unos 5 segundos).
const hayToqueReciente = () => !!(navigator.userActivation && navigator.userActivation.isActive);

function abrirEnlace(href) {
  const web = /^https?:/i.test(href);
  const a = el('a', { href, target: web ? '_blank' : null, rel: web ? 'noopener' : null });
  document.body.append(a);
  a.click();
  a.remove();
}

function mostrarIntencion(intencion, { guardar = false, hablarlo = true, directo = false } = {}) {
  estado.intencion = intencion;
  const t = armarTarjeta(intencion, ctx());
  if (t.accion && t.accion.tipo === 'pantalla') {
    ir(t.accion.pantalla);
    return;
  }
  // Pedido claro → se abre la app directo con todo cargado: solo falta tocar «Enviar» ahí.
  // Si el dictado tardó (ya no hay toque reciente) o hay dudas, queda la tarjeta con su botón.
  const href = directo && estado.ajustes.abrirDirecto && hayToqueReciente() ? enlaceDirecto(intencion, t) : null;
  if (href) t.nota = 'Ya abrí la app con todo cargado: tocá Enviar ahí. Si no se abrió, usá el botón.';
  pintarTarjeta(t);
  if (guardar) sumarAlHistorial(intencion, t);
  if (href) {
    callar();
    abrirEnlace(href);
    return;
  }
  if (hablarlo) decir(t.decir);
  if (t.pendiente === 'clima') resolverClima(intencion);
  if (t.pendiente === 'ubicacion') resolverUbicacion(intencion);
}

function cerrarTarjeta() {
  callar();
  estado.intencion = null;
  estado.entendido = '';
  const caja = $('#tarjeta');
  caja.hidden = true;
  caja.replaceChildren();
  $('#ejemplos').hidden = false;
}

function pintarTarjeta(t) {
  const caja = $('#tarjeta');
  caja.replaceChildren();
  caja.hidden = false;
  caja.dataset.tipo = t.tipo;
  if (estado.entendido) caja.append(el('p', { class: 'entendi' }, 'Entendí: ', el('q', { text: estado.entendido })));
  caja.append(el('div', { class: 'tarjeta-cabeza' },
    el('span', { class: 'tarjeta-icono', 'aria-hidden': 'true', text: t.icono }),
    el('div', { class: 'tarjeta-textos' },
      el('h2', { class: 'tarjeta-titulo', text: t.titulo }),
      el('p', { class: 'tarjeta-detalle', text: t.detalle, hidden: !t.detalle })),
    el('button', { class: 'cerrar', type: 'button', 'aria-label': 'Cerrar', text: '×', onclick: cerrarTarjeta })));
  if (t.respuesta) caja.append(el('p', { class: 'respuesta', text: t.respuesta }));
  for (const a of t.avisos || []) caja.append(el('p', { class: 'aviso-tarjeta', text: a }));
  if (t.elegir) caja.append(pintarEleccion(t.elegir));
  for (const ed of t.editables || []) caja.append(pintarCampo(ed));
  if (t.botones && t.botones.length) caja.append(pintarBotones(t.botones));
  if (t.nota) caja.append(el('p', { class: 'nota', text: t.nota }));
  $('#ejemplos').hidden = !t.ejemplos;
  caja.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

const esWeb = (url) => /^https?:/i.test(url);

function pintarBotones(botones) {
  const fila = el('div', { class: 'tarjeta-botones' });
  botones.forEach((b, i) => {
    const clase = `boton${b.principal ? ' principal' : ''}`;
    if (b.href && b.descarga) {
      // Archivo .ics: en iPhone se ABRE (muestra «Agregar al calendario»);
      // en Android se descarga y se abre con la app de calendario.
      const a = el('a', { class: clase, href: b.href, text: b.texto, dataset: { i: String(i) }, download: estado.plataforma === 'ios' ? null : b.descarga });
      a.addEventListener('click', () => {
        callar();
        try {
          if (a.href.startsWith('data:')) a.dataset.datos = a.href.slice(a.href.indexOf(',') + 1);
          const datos = decodeURIComponent(a.dataset.datos || '');
          if (!datos) return;
          const url = URL.createObjectURL(new Blob([datos], { type: 'text/calendar;charset=utf-8' }));
          a.href = url;
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch { /* queda el enlace data: */ }
      });
      fila.append(a);
    } else if (b.href) {
      fila.append(el('a', {
        class: clase, href: b.href, text: b.texto, dataset: { i: String(i) },
        target: esWeb(b.href) ? '_blank' : null, rel: esWeb(b.href) ? 'noopener' : null,
        onclick: () => callar(),
      }));
      if (b.alt) {
        fila.append(el('a', {
          class: 'alternativa', href: b.alt, dataset: { alt: String(i) },
          target: esWeb(b.alt) ? '_blank' : null, rel: esWeb(b.alt) ? 'noopener' : null,
          text: '¿No se abrió? Probá de esta otra forma',
        }));
      }
    } else if (b.accion) {
      fila.append(el('button', { class: clase, type: 'button', text: b.texto, onclick: () => ejecutarAccion(b.accion) }));
    }
  });
  return fila;
}

function pintarCampo(ed) {
  const id = `campo-${ed.campo}`;
  const control = ed.multilinea
    ? el('textarea', { id, rows: '3', enterkeyhint: 'done' })
    : el('input', { id, type: 'text', enterkeyhint: 'done', autocomplete: 'off' });
  control.value = ed.valor || '';
  control.addEventListener('input', () => {
    if (!estado.intencion) return;
    estado.intencion[ed.campo] = control.value;
    if (ed.campo === 'destino') delete estado.intencion.lugar;
    refrescarTarjeta(id);
  });
  const caja = el('div', { class: 'campo' }, el('label', { for: id, text: ed.etiqueta }), control);
  if (ed.multilinea && puedeEscuchar) {
    const b = el('button', { class: 'mini-mic', type: 'button', 'aria-label': 'Dictar el mensaje' }, iconoSVG('i-mic'));
    b.addEventListener('click', () => dictarEn(control, b));
    caja.append(b);
  }
  return caja;
}

/** Al editar un campo: actualiza los enlaces sin perder el foco. */
function refrescarTarjeta(idCampo) {
  const t = armarTarjeta(estado.intencion, ctx());
  const caja = $('#tarjeta');
  const actuales = $$('.tarjeta-botones > .boton', caja).map((b) => b.textContent);
  const nuevos = (t.botones || []).map((b) => b.texto);
  const mismos = actuales.length === nuevos.length && $$('.tarjeta-botones a.boton', caja).length === (t.botones || []).filter((b) => b.href).length;
  if (!mismos) {
    const campo = document.getElementById(idCampo);
    const pos = campo ? [campo.selectionStart, campo.selectionEnd] : null;
    pintarTarjeta(t);
    const nuevo = document.getElementById(idCampo);
    if (nuevo) {
      nuevo.focus({ preventScroll: true });
      if (pos) try { nuevo.setSelectionRange(pos[0], pos[1]); } catch { /* campo sin selección */ }
    }
    return;
  }
  (t.botones || []).forEach((b, i) => {
    const a = caja.querySelector(`a[data-i="${i}"]`);
    if (a && b.href) { a.href = b.href; a.textContent = b.texto; }
    const alt = caja.querySelector(`a[data-alt="${i}"]`);
    if (alt && b.alt) alt.href = b.alt;
  });
  const titulo = $('.tarjeta-titulo', caja);
  if (titulo) titulo.textContent = t.titulo;
  const detalle = $('.tarjeta-detalle', caja);
  if (detalle) { detalle.textContent = t.detalle; detalle.hidden = !t.detalle; }
}

function contactosParecidos(q) {
  const n = claveNombre(q);
  return estado.contactos
    .map((c) => ({ c, p: claveNombre([c.nombre, ...(c.alias || [])].join(' ')).includes(n) ? 90 : puntaje(q, c) }))
    .filter((x) => x.p >= 55)
    .sort((a, b) => b.p - a.p)
    .slice(0, 8)
    .map(({ c }) => ({ id: c.id, nombre: c.nombre, detalle: telefonoPrincipal(c) || emailPrincipal(c) }));
}

function pintarEleccion(elegir) {
  const caja = el('div', { class: 'elegir' });
  const titulo = elegir.motivo === 'varios' ? `¿Cuál de estos es «${elegir.consulta}»?`
    : elegir.motivo === 'ninguno' ? `No encontré a «${elegir.consulta}» en tus contactos.`
      : '¿A quién?';
  caja.append(el('p', { class: 'elegir-titulo', text: titulo }));
  const lista = el('div', { class: 'elegir-lista' });
  const pintar = (candidatos) => lista.replaceChildren(...candidatos.map((c) => el('button', {
    type: 'button', class: 'contacto-opcion', onclick: () => elegirContacto(c.id),
  }, el('strong', { text: c.nombre }), c.detalle ? el('span', { text: c.detalle }) : null)));
  pintar(elegir.candidatos || []);
  if (estado.contactos.length) {
    const buscador = el('input', { type: 'search', placeholder: 'Buscar en tus contactos…', 'aria-label': 'Buscar contacto' });
    buscador.addEventListener('input', () => {
      const q = buscador.value.trim();
      pintar(q ? contactosParecidos(q) : elegir.candidatos || []);
    });
    caja.append(buscador);
  } else {
    caja.append(el('p', { class: 'nota' }, 'Todavía no cargaste contactos. ', el('a', { href: '#/contactos', text: 'Cargalos acá' }), '.'));
  }
  caja.append(lista);
  if (elegir.motivo === 'ninguno' && elegir.consulta) {
    caja.append(el('button', {
      type: 'button', class: 'boton chico', text: `➕ Agregar a «${elegir.consulta}»`,
      onclick: () => abrirDialogoContacto(null, { nombre: capitalizar(elegir.consulta) }),
    }));
  }
  return caja;
}

function elegirContacto(id) {
  if (!estado.intencion) return;
  estado.intencion.contactoId = id;
  mostrarIntencion(estado.intencion, { directo: true });
}

function ejecutarAccion(accion) {
  if (accion.tipo === 'pantalla') ir(accion.pantalla);
  else if (accion.tipo === 'intencion') mostrarIntencion(accion.intencion, { directo: true });
  else if (accion.tipo === 'guardarContacto') {
    const r = fusionarContactos(estado.contactos, [accion.contacto]);
    guardarContactos(r.lista);
    avisar(r.agregados ? `Guardé a ${accion.contacto.nombre}.` : `Actualicé a ${accion.contacto.nombre}.`);
    mostrarIntencion({ tipo: 'contacto', destinatario: accion.contacto.nombre, texto: '' }, { hablarlo: false });
  }
}

// ----- Pedidos que necesitan internet o permisos -----
function obtenerPosicion(precisa) {
  return new Promise((ok, mal) => {
    if (!navigator.geolocation) { mal(new Error('sin-ubicacion')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const dec = precisa ? 5 : 2; // para el clima alcanza con la zona (~1 km)
        ok({ lat: +p.coords.latitude.toFixed(dec), lon: +p.coords.longitude.toFixed(dec) });
      },
      mal,
      { enableHighAccuracy: !!precisa, timeout: 15000, maximumAge: precisa ? 60000 : 30 * 60000 },
    );
  });
}

async function resolverClima(intencion) {
  try {
    const texto = await consultarClima({ lugar: intencion.lugar, cuando: intencion.cuando, posicion: () => obtenerPosicion(false) });
    if (estado.intencion !== intencion) return;
    const r = $('#tarjeta .respuesta');
    if (r) r.textContent = texto;
    decir(texto);
  } catch (e) {
    if (estado.intencion !== intencion) return;
    const msg = e && e.message === 'lugar' ? `No encontré «${intencion.lugar}».`
      : e && e.code === 1 ? 'Necesito permiso de ubicación para ver el clima de tu zona.'
        : 'No pude consultar el clima ahora.';
    const r = $('#tarjeta .respuesta');
    if (r) r.textContent = msg;
    const cuando = ['hoy', 'mañana', 'pasado mañana'][intencion.cuando || 0];
    const q = encodeURIComponent(`clima ${intencion.lugar || ''} ${cuando}`.replace(/\s+/g, ' ').trim());
    $('#tarjeta').append(pintarBotones([{ texto: 'Ver el clima en Google', href: `https://www.google.com/search?q=${q}`, principal: true }]));
    decir(msg);
  }
}

async function resolverUbicacion(intencion) {
  const caja = $('#tarjeta');
  const nota = el('p', { class: 'nota', text: '📍 Buscando tu ubicación…' });
  caja.append(nota);
  try {
    const p = await obtenerPosicion(true);
    if (estado.intencion !== intencion) return;
    intencion.mensaje = `Estoy acá: https://maps.google.com/?q=${p.lat},${p.lon}`;
    mostrarIntencion(intencion, { hablarlo: false });
    decir('Listo, tu ubicación ya está en el mensaje.');
  } catch {
    nota.textContent = 'No pude saber dónde estás (¿diste permiso de ubicación?). Podés escribir la dirección en el mensaje.';
  }
}

// ---------------------------------------------------------------------------
// Historial
// ---------------------------------------------------------------------------
const NO_GUARDAR = ['vacio', 'saludo', 'gracias', 'ayuda', 'interno', 'desconocido'];

function sumarAlHistorial(intencion, t) {
  const texto = estado.entendido || intencion.texto;
  if (!texto || NO_GUARDAR.includes(intencion.tipo)) return;
  estado.historial = [{ texto, icono: t.icono, cuando: Date.now() }, ...estado.historial.filter((h) => h.texto !== texto)].slice(0, 12);
  almacen.guardarHistorial(estado.historial);
  pintarHistorial();
}

function horaCorta(ms) {
  const d = new Date(ms);
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : `${d.getDate()}/${d.getMonth() + 1}`;
}

function pintarHistorial() {
  const lista = $('#lista-historial');
  lista.replaceChildren(...estado.historial.map((h) => el('li', {}, el('button', {
    type: 'button', onclick: () => { $('#entrada').value = h.texto; procesar([h.texto]); },
  }, el('span', { 'aria-hidden': 'true', text: h.icono || '•' }), el('span', { class: 'h-texto', text: h.texto }), el('span', { class: 'h-hora', text: horaCorta(h.cuando) })))));
  $('#historial').hidden = !estado.historial.length;
}

// ---------------------------------------------------------------------------
// Pantallas (con #/ruta, así el botón "atrás" del teléfono funciona)
// ---------------------------------------------------------------------------
const PANTALLAS = ['inicio', 'contactos', 'ajustes', 'ayuda'];

function ir(p) {
  location.hash = p === 'inicio' ? '#/' : `#/${p}`;
}

function alCambiarRuta() {
  const p = location.hash.replace(/^#\/?/, '') || 'inicio';
  const actual = PANTALLAS.includes(p) ? p : 'inicio';
  for (const s of $$('.pantalla')) s.hidden = s.dataset.pantalla !== actual;
  if (actual === 'contactos') pintarContactos();
  if (actual === 'ajustes') pintarAjustes();
  if (actual === 'inicio') pintarBienvenida();
  window.scrollTo(0, 0);
  const h1 = $(`[data-pantalla="${actual}"] h1`);
  if (h1) h1.focus({ preventScroll: true });
}

function pintarBienvenida() {
  $('#bienvenida').hidden = estado.contactos.length > 0;
}

// ---------------------------------------------------------------------------
// Contactos
// ---------------------------------------------------------------------------
function guardarContactos(lista) {
  estado.contactos = ordenarContactos(lista);
  almacen.guardarContactos(estado.contactos);
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { /* opcional */ }
  pintarBienvenida();
}

function pintarContactos() {
  const q = normalizar($('#buscar-contacto').value.trim());
  const lista = estado.contactos.filter((c) => !q || normalizar([c.nombre, ...(c.alias || []), ...(c.telefonos || [])].join(' ')).includes(q));
  $('#cuenta-contactos').textContent = estado.contactos.length
    ? `${estado.contactos.length} contacto${estado.contactos.length === 1 ? '' : 's'}${q ? ` · ${lista.length} encontrado${lista.length === 1 ? '' : 's'}` : ''}`
    : 'Todavía no hay contactos.';
  const visibles = lista.slice(0, 300);
  $('#lista-contactos').replaceChildren(...visibles.map((c) => {
    const tel = telefonoPrincipal(c);
    const dudoso = tel && numeroDudoso(paraWhatsApp(tel, estado.ajustes));
    return el('li', {}, el('button', { type: 'button', onclick: () => abrirDialogoContacto(c) },
      el('span', { class: 'c-nombre', text: c.nombre }),
      el('span', { class: 'c-dato', text: [tel, emailPrincipal(c)].filter(Boolean).join(' · ') || 'Sin teléfono' }),
      c.alias && c.alias.length ? el('span', { class: 'c-dato', text: `Apodos: ${c.alias.join(', ')}` }) : null,
      dudoso ? el('span', { class: 'c-alerta', text: '⚠️ Revisá el número (¿falta el código de área?)' }) : null));
  }));
  if (lista.length > visibles.length) $('#lista-contactos').append(el('li', { class: 'texto-suave', text: `…y ${lista.length - visibles.length} más. Usá el buscador.` }));
}

function vistaWhatsApp() {
  const tel = $('#form-contacto').elements.telefono.value.trim();
  const intl = paraWhatsApp(tel, estado.ajustes);
  $('#vista-whatsapp').textContent = !tel ? ''
    : !intl ? 'Ese número parece incompleto.'
      : `Para WhatsApp: ${mostrarNumero(intl)}${numeroDudoso(intl) ? ' ⚠️ revisalo (¿falta el código de área?)' : ' ✓'}`;
}

function abrirDialogoContacto(contacto, previo = {}) {
  const d = $('#dialogo-contacto');
  const f = $('#form-contacto');
  f.reset();
  const c = contacto || previo;
  f.elements.cid.value = contacto ? contacto.id : '';
  f.elements.nombre.value = c.nombre || '';
  f.elements.telefono.value = (c.telefonos && c.telefonos[0]) || c.telefono || '';
  f.elements.email.value = (c.emails && c.emails[0]) || '';
  f.elements.alias.value = (c.alias || []).join(', ');
  $('#titulo-dialogo-contacto').textContent = contacto ? 'Editar contacto' : 'Nuevo contacto';
  $('#btn-borrar-contacto').hidden = !contacto;
  vistaWhatsApp();
  d.returnValue = '';
  d.showModal();
}

async function alCerrarDialogoContacto() {
  const d = $('#dialogo-contacto');
  const f = $('#form-contacto');
  const id = f.elements.cid.value;
  if (d.returnValue === 'borrar' && id) {
    const c = estado.contactos.find((x) => x.id === id);
    if (c && await confirmar(`¿Borrar a ${c.nombre}?`)) {
      guardarContactos(estado.contactos.filter((x) => x.id !== id));
      avisar(`Borré a ${c.nombre}.`);
      pintarContactos();
    }
    return;
  }
  if (d.returnValue !== 'guardar') return;
  const nombre = f.elements.nombre.value.trim();
  if (!nombre) return;
  const previo = estado.contactos.find((x) => x.id === id);
  const telefonos = [f.elements.telefono.value.trim(), ...((previo && previo.telefonos) || []).slice(1)].filter(Boolean);
  const emails = [f.elements.email.value.trim(), ...((previo && previo.emails) || []).slice(1)].filter(Boolean);
  const nuevo = crearContacto({ id: id || undefined, nombre, telefonos, emails, alias: f.elements.alias.value.split(',') });
  guardarContactos(id ? estado.contactos.map((x) => (x.id === id ? nuevo : x)) : [...estado.contactos, nuevo]);
  avisar(id ? 'Contacto actualizado.' : `Guardé a ${nombre}.`);
  pintarContactos();
  if (estado.intencion && !id && location.hash.replace(/^#\/?/, '') === '') {
    estado.intencion.contactoId = nuevo.id;  // venía de "No encontré a…": seguir con el pedido
    mostrarIntencion(estado.intencion);
  }
}

function sumarContactos(nuevos) {
  const r = fusionarContactos(estado.contactos, nuevos);
  guardarContactos(r.lista);
  pintarContactos();
  avisar(r.agregados || r.actualizados
    ? `Listo: ${r.agregados} nuevo${r.agregados === 1 ? '' : 's'}${r.actualizados ? ` y ${r.actualizados} actualizado${r.actualizados === 1 ? '' : 's'}` : ''}.`
    : 'No había contactos nuevos.');
}

async function traerDelTelefono() {
  try {
    const disponibles = await navigator.contacts.getProperties();
    const props = ['name', 'tel', 'email'].filter((p) => disponibles.includes(p));
    const elegidos = await navigator.contacts.select(props, { multiple: true });
    sumarContactos(elegidos.map((c) => ({
      nombre: (c.name && c.name[0]) || '', telefonos: c.tel || [], emails: c.email || [],
    })));
  } catch (e) {
    if (!e || e.name !== 'AbortError') avisar('No pude traer los contactos del teléfono.');
  }
}

async function importarVCF(archivo) {
  if (!archivo) return;
  try {
    const leidos = leerVCard(await archivo.text());
    if (!leidos.length) { avisar('No encontré contactos con teléfono o mail en ese archivo.'); return; }
    sumarContactos(leidos);
  } catch {
    avisar('No pude leer ese archivo.');
  }
}

// ---------------------------------------------------------------------------
// Ajustes y comandos
// ---------------------------------------------------------------------------
function pintarAjustes() {
  const f = $('#form-ajustes');
  for (const [k, v] of Object.entries(estado.ajustes)) {
    const campo = f.elements[k];
    if (!campo) continue;
    if (campo.type === 'checkbox') campo.checked = !!v;
    else campo.value = v;
  }
  pintarComandos();
}

function alCambiarAjuste(e) {
  const c = e.target;
  if (!c.name) return;
  estado.ajustes[c.name] = c.type === 'checkbox' ? c.checked : c.value.trim();
  almacen.guardarAjustes(estado.ajustes);
  pintarBotonVoz();
  avisar('Guardado.', 1400);
}

function pintarBotonVoz() {
  const b = $('#btn-voz');
  b.setAttribute('aria-pressed', String(!!estado.ajustes.hablar));
  b.setAttribute('aria-label', estado.ajustes.hablar ? 'Respuestas en voz alta: activadas' : 'Respuestas en voz alta: desactivadas');
  b.replaceChildren(iconoSVG(estado.ajustes.hablar ? 'i-parlante' : 'i-mudo'));
}

function pintarComandos() {
  const lista = $('#lista-comandos');
  lista.replaceChildren(...estado.comandos.map((c) => el('li', {}, el('button', { type: 'button', onclick: () => editarComando(c) },
    el('span', { class: 'c-nombre', text: `⭐ ${c.nombre}` }),
    el('span', { class: 'c-dato', text: `Decí: ${c.frases.join(' · ')}` }),
    el('span', { class: 'c-dato', text: c.url })))));
  if (!estado.comandos.length) lista.append(el('li', { class: 'texto-suave', text: 'Todavía no creaste comandos.' }));
}

function editarComando(c) {
  const f = $('#form-comando');
  f.elements.cid.value = c.id;
  f.elements.nombre.value = c.nombre;
  f.elements.frases.value = c.frases.join(', ');
  f.elements.url.value = c.url;
  let borrar = $('#btn-borrar-comando');
  if (!borrar) {
    borrar = el('button', { id: 'btn-borrar-comando', type: 'button', class: 'boton peligro chico', text: 'Borrar comando' });
    borrar.addEventListener('click', async () => {
      const id = f.elements.cid.value;
      const cmd = estado.comandos.find((x) => x.id === id);
      if (cmd && await confirmar(`¿Borrar el comando «${cmd.nombre}»?`)) {
        estado.comandos = estado.comandos.filter((x) => x.id !== id);
        almacen.guardarComandos(estado.comandos);
        f.reset();
        pintarComandos();
      }
    });
    $('.botonera', f).append(borrar);
  }
  f.elements.nombre.focus();
}

function guardarComando(e) {
  e.preventDefault();
  const f = e.target;
  const url = f.elements.url.value.trim();
  if (/^\s*javascript:/i.test(url)) { avisar('Ese enlace no está permitido.'); return; }
  const cmd = {
    id: f.elements.cid.value || `k${Date.now().toString(36)}`,
    nombre: f.elements.nombre.value.trim(),
    frases: f.elements.frases.value.split(',').map((s) => s.trim()).filter(Boolean),
    url,
  };
  if (!cmd.nombre || !cmd.frases.length || !cmd.url) return;
  estado.comandos = f.elements.cid.value ? estado.comandos.map((x) => (x.id === cmd.id ? cmd : x)) : [...estado.comandos, cmd];
  almacen.guardarComandos(estado.comandos);
  f.reset();
  f.elements.cid.value = '';
  pintarComandos();
  avisar(`Listo: decí «${cmd.frases[0]}».`);
}

function bajarCopia() {
  const texto = almacen.exportar(estado);
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = el('a', { href: url, download: `decile-copia-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function cargarCopia(archivo) {
  if (!archivo) return;
  try {
    const d = almacen.importar(await archivo.text());
    if (!await confirmar(`La copia tiene ${d.contactos.length} contactos y ${d.comandos.length} comandos. ¿Los sumo a los que ya tenés?`)) return;
    estado.ajustes = d.ajustes;
    almacen.guardarAjustes(estado.ajustes);
    estado.comandos = [...estado.comandos.filter((c) => !d.comandos.some((x) => x.id === c.id)), ...d.comandos];
    almacen.guardarComandos(estado.comandos);
    sumarContactos(d.contactos);
    pintarAjustes();
    pintarBotonVoz();
  } catch {
    avisar('Ese archivo no es una copia de Decile.');
  }
}

async function borrarTodo() {
  if (!await confirmar('¿Borrar contactos, comandos, ajustes e historial de este teléfono?')) return;
  almacen.borrarTodo();
  Object.assign(estado, {
    ajustes: almacen.cargarAjustes(), contactos: [], comandos: [], historial: [],
  });
  pintarAjustes();
  pintarHistorial();
  pintarBotonVoz();
  avisar('Listo, borré todo.');
}

// ---------------------------------------------------------------------------
// Instalar como app
// ---------------------------------------------------------------------------
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function prepararInstalacion() {
  if (instalada() || almacen.leer('noInstalar', false)) return;
  if (estado.plataforma === 'ios') {
    $('#instalar-texto').textContent = 'Para tenerla como app: tocá Compartir (el cuadrado con la flecha) → «Agregar a inicio».';
    $('#btn-instalar').hidden = true;
    $('#instalar').hidden = false;
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    estado.instalador = e;
    $('#instalar').hidden = false;
  });
  $('#btn-instalar').addEventListener('click', async () => {
    if (!estado.instalador) return;
    estado.instalador.prompt();
    await estado.instalador.userChoice.catch(() => null);
    estado.instalador = null;
    $('#instalar').hidden = true;
  });
  $('#btn-instalar-no').addEventListener('click', () => {
    almacen.guardar('noInstalar', true);
    $('#instalar').hidden = true;
  });
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const habiaControlador = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline: sigue andando */ });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (habiaControlador) avisar('Decile se actualizó. Cerrala y abrila para ver lo nuevo.', 5000);
  });
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
function iniciar() {
  $('#mic').addEventListener('click', () => alTocarMic());
  $('#form-texto').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = $('#entrada').value.trim();
    if (!t) { $('#entrada').focus(); return; }
    procesar([t]);
    $('#entrada').blur();
  });
  $$('#ejemplos .chip').forEach((c) => c.addEventListener('click', () => {
    $('#entrada').value = c.textContent;
    procesar([c.textContent]);
  }));
  $('#btn-voz').addEventListener('click', () => {
    estado.ajustes.hablar = !estado.ajustes.hablar;
    almacen.guardarAjustes(estado.ajustes);
    if (!estado.ajustes.hablar) callar();
    pintarBotonVoz();
    avisar(estado.ajustes.hablar ? 'Voy a responder en voz alta.' : 'Respuestas solo en pantalla.', 1800);
  });
  $('#btn-limpiar-historial').addEventListener('click', () => {
    estado.historial = [];
    almacen.guardarHistorial([]);
    pintarHistorial();
  });

  // Contactos
  if ('contacts' in navigator && 'select' in navigator.contacts) {
    $('#btn-importar-telefono').hidden = false;
    $('#btn-importar-telefono').addEventListener('click', traerDelTelefono);
  }
  $('#archivo-vcf').addEventListener('change', (e) => { importarVCF(e.target.files[0]); e.target.value = ''; });
  $('#btn-nuevo-contacto').addEventListener('click', () => abrirDialogoContacto(null));
  $('#buscar-contacto').addEventListener('input', pintarContactos);
  $('#dialogo-contacto').addEventListener('close', alCerrarDialogoContacto);
  $('#form-contacto').elements.telefono.addEventListener('input', vistaWhatsApp);

  // Ajustes
  $('#form-ajustes').addEventListener('change', alCambiarAjuste);
  $('#form-ajustes').addEventListener('submit', (e) => e.preventDefault());
  $('#form-comando').addEventListener('submit', guardarComando);
  $('#form-comando').addEventListener('reset', () => { setTimeout(() => { $('#form-comando').elements.cid.value = ''; $('#btn-borrar-comando')?.remove(); }); });
  $('#btn-exportar').addEventListener('click', bajarCopia);
  $('#archivo-copia').addEventListener('change', (e) => { cargarCopia(e.target.files[0]); e.target.value = ''; });
  $('#btn-borrar-todo').addEventListener('click', borrarTodo);

  window.addEventListener('hashchange', alCambiarRuta);
  alCambiarRuta();
  pintarHistorial();
  pintarBotonVoz();
  precargarVoces();
  prepararInstalacion();
  registrarServiceWorker();

  // ?q=texto → hacerlo directo (para atajos). ?escuchar=1 → escuchar apenas abre.
  const params = new URLSearchParams(location.search);
  if (params.get('q')) {
    $('#entrada').value = params.get('q');
    procesar([params.get('q')]);
  } else if ((params.get('escuchar') === '1' || estado.ajustes.escucharAlAbrir) && puedeEscuchar && !location.hash.replace(/^#\/?/, '')) {
    setTimeout(() => alTocarMic({ automatico: true }), 350);
  }
  document.documentElement.dataset.listo = '1';
}

iniciar();

// Para las pruebas automáticas y para depurar desde la consola.
window.decile = { procesar, interpretar: (t) => interpretar(t, ctx()), estado };
