// almacen.js — Guarda contactos, ajustes, comandos e historial SOLO en este
// teléfono (localStorage). Nada sale a internet.

const PREFIJO = 'decile.';

export function leer(clave, porDefecto) {
  try {
    const v = localStorage.getItem(PREFIJO + clave);
    return v == null ? porDefecto : JSON.parse(v);
  } catch {
    return porDefecto;
  }
}

export function guardar(clave, valor) {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export function borrarTodo() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIJO)).forEach((k) => localStorage.removeItem(k));
  } catch { /* sin almacenamiento: nada que borrar */ }
}

export const AJUSTES_BASE = {
  idioma: 'es-AR',
  codigoPais: '54',
  codigoArea: '',
  canalMensaje: 'whatsapp', // qué usar cuando se dice solo "mensaje"
  appMapas: 'google',
  appMusica: 'spotify',
  hablar: true,             // responder en voz alta
  abrirDirecto: true,       // pedido claro → abrir la app con todo cargado (solo falta tocar Enviar)
  escucharAlAbrir: false,
  casa: '',
  trabajo: '',
};

export const cargarAjustes = () => ({ ...AJUSTES_BASE, ...leer('ajustes', {}) });
export const guardarAjustes = (a) => guardar('ajustes', a);
export const cargarContactos = () => (Array.isArray(leer('contactos', [])) ? leer('contactos', []) : []);
export const guardarContactos = (l) => guardar('contactos', l);
export const cargarComandos = () => (Array.isArray(leer('comandos', [])) ? leer('comandos', []) : []);
export const guardarComandos = (l) => guardar('comandos', l);
export const cargarHistorial = () => (Array.isArray(leer('historial', [])) ? leer('historial', []) : []);
export const guardarHistorial = (l) => guardar('historial', l.slice(0, 20));

/** Copia de seguridad en texto (JSON) para bajar o pasar a otro teléfono. */
export function exportar({ ajustes, contactos, comandos }) {
  return JSON.stringify({ app: 'decile', version: 1, fecha: new Date().toISOString(), ajustes, contactos, comandos }, null, 2);
}

/** Lee una copia de seguridad. Tira error si el archivo no es de Decile. */
export function importar(texto) {
  const d = JSON.parse(texto);
  if (!d || d.app !== 'decile') throw new Error('No es una copia de Decile');
  return {
    ajustes: { ...AJUSTES_BASE, ...(d.ajustes || {}) },
    contactos: Array.isArray(d.contactos) ? d.contactos : [],
    comandos: Array.isArray(d.comandos) ? d.comandos : [],
  };
}
