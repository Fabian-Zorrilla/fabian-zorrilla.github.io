// contactos.js — La agenda de Decile: buscar contactos aunque el nombre llegue
// con errores del dictado ("Juan Gomes" ≈ "Juan Gómez") y juntar listas
// importadas sin duplicar.
//
// Un contacto: { id, nombre, alias: [], telefonos: [], emails: [] }

import { normalizar, similitud } from './texto.js';
import { digitos } from './telefono.js';

/** Nombre comparable: sin tildes, minúsculas, solo letras/números y espacios. */
export function claveNombre(s) {
  return normalizar(s).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

const RELLENO_INI = /^(?:(?:a|al|a la|a mi|mi|mis|el|la|los|las|para|con|de|del|tu)\s+)+/;
const RELLENO_FIN = /(?:\s+(?:por favor|porfa|porfis|ahora|ya|urgente|rapido|de nuevo|otra vez|por whatsapp|por wpp))+$/;

/** "a mi mamá por favor" → "mama". */
export function limpiarConsulta(s) {
  let q = claveNombre(s);
  const sinIni = q.replace(RELLENO_INI, '');
  if (sinIni) q = sinIni;
  return q.replace(RELLENO_FIN, '').trim();
}

function puntajeNombre(q, n) {
  if (!q || !n) return 0;
  if (q === n) return 100;
  const qt = q.split(' ');
  const nt = n.split(' ');
  if (qt.every((w) => nt.includes(w))) {
    if (qt.length >= 2) return 92;          // "juan gomez" en "juan carlos gomez"
    return nt[0] === qt[0] ? 85 : 78;        // nombre de pila / apellido solo
  }
  // Parecido, por errores del dictado ("gomes" ≈ "gomez", "yuan" ≈ "juan").
  let suma = 0;
  for (const w of qt) {
    let mejor = 0;
    for (const v of nt) {
      let s = similitud(w, v);
      if (w.length >= 3 && v.startsWith(w)) s = Math.max(s, 0.85); // "juanci" → "juancito"
      mejor = Math.max(mejor, s);
    }
    suma += mejor;
  }
  const total = Math.max(suma / qt.length, similitud(q, n));
  return Math.round(total * 80);
}

/** De 0 a 100: cuánto se parece lo dicho al nombre (o apodos) del contacto. */
export function puntaje(consulta, contacto) {
  const q = limpiarConsulta(consulta);
  if (!q) return 0;
  const qCrudo = claveNombre(consulta);
  let mejor = 0;
  for (const nombre of [contacto.nombre, ...(contacto.alias || [])]) {
    const n = claveNombre(nombre);
    if (!n) continue;
    const nLimpio = limpiarConsulta(nombre) || n;
    mejor = Math.max(mejor, puntajeNombre(q, nLimpio), puntajeNombre(qCrudo, n));
  }
  return mejor;
}

/** Busca en la agenda.
 *  → { estado: 'uno', contacto } si hay uno claro,
 *    { estado: 'varios', candidatos } si hay que elegir,
 *    { estado: 'ninguno', candidatos: [] } si no aparece. */
export function buscarContacto(consulta, contactos) {
  const lista = (contactos || [])
    .map((c) => ({ c, p: puntaje(consulta, c) }))
    .filter((x) => x.p >= 56)
    .sort((a, b) => b.p - a.p);
  if (!lista.length) return { estado: 'ninguno', candidatos: [] };
  const [a, b] = lista;
  const candidatos = lista.slice(0, 6).map((x) => x.c);
  if (a.p >= 70 && (!b || a.p - b.p >= 8)) return { estado: 'uno', contacto: a.c, puntaje: a.p, candidatos };
  return { estado: 'varios', candidatos, puntaje: a.p };
}

export function nuevoId() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function unicos(lista, clave) {
  const vistos = new Set();
  const out = [];
  for (const x of lista) {
    const v = String(x ?? '').trim();
    const k = clave(v);
    if (!v || !k || vistos.has(k)) continue;
    vistos.add(k);
    out.push(v);
  }
  return out;
}

const claveTel = (t) => digitos(t).slice(-8);
const claveMail = (m) => m.toLowerCase();

/** Arma un contacto prolijo (sin vacíos ni repetidos). */
export function crearContacto({ id, nombre = '', alias = [], telefonos = [], emails = [] } = {}) {
  return {
    id: id || nuevoId(),
    nombre: String(nombre).trim().replace(/\s+/g, ' '),
    alias: unicos(alias, claveNombre),
    telefonos: unicos(telefonos, claveTel),
    emails: unicos(emails, claveMail),
  };
}

/** Suma contactos nuevos a la agenda. Si el nombre ya existe, junta los datos.
 *  → { lista, agregados, actualizados } */
export function fusionarContactos(existentes, nuevos) {
  const lista = existentes.map((c) => crearContacto(c));
  const porNombre = new Map(lista.map((c) => [claveNombre(c.nombre), c]));
  let agregados = 0;
  let actualizados = 0;
  for (const n of nuevos) {
    const nuevo = crearContacto(n);
    if (!nuevo.nombre) continue;
    const previo = porNombre.get(claveNombre(nuevo.nombre));
    if (!previo) {
      lista.push(nuevo);
      porNombre.set(claveNombre(nuevo.nombre), nuevo);
      agregados++;
      continue;
    }
    const antes = JSON.stringify(previo);
    const unido = crearContacto({
      ...previo,
      alias: [...previo.alias, ...nuevo.alias],
      telefonos: [...previo.telefonos, ...nuevo.telefonos],
      emails: [...previo.emails, ...nuevo.emails],
    });
    Object.assign(previo, unido);
    if (JSON.stringify(previo) !== antes) actualizados++;
  }
  return { lista: ordenarContactos(lista), agregados, actualizados };
}

export function ordenarContactos(lista) {
  return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
}

export const telefonoPrincipal = (c) => (c && c.telefonos && c.telefonos[0]) || '';
export const emailPrincipal = (c) => (c && c.emails && c.emails[0]) || '';
