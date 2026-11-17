// texto.js — Herramientas de texto en castellano.
//
// Idea clave: para ENTENDER el pedido buscamos palabras sin tildes y en
// minúsculas ("gomez"), pero para MOSTRAR y MANDAR queremos el texto original
// ("Gómez", "Hola amigo."). Por eso se trabaja con pares {o, n}: `o` es el
// original y `n` su versión normalizada, letra por letra en la misma posición.
// Lo que se encuentra en `n` se recorta igual en `o`.

const MARCAS_G = /[̀-ͯ]/g;
const ES_MARCA = /^[̀-ͯ]$/;

/** "Gómez" → "gomez" (sin tildes y en minúsculas). La ñ queda como n. */
export function normalizar(s) {
  return String(s ?? '').normalize('NFD').replace(MARCAS_G, '').toLowerCase();
}

/** Arma el par {o, n} con las letras alineadas (mismo largo). */
export function alinear(original) {
  const o = String(original ?? '').normalize('NFC');
  let n = '';
  for (let i = 0; i < o.length; i++) {
    const c = o[i];
    const cod = c.charCodeAt(0);
    if (cod >= 0xd800 && cod <= 0xdfff) { n += ' '; continue; } // emojis: cuentan como espacio
    let x = c.normalize('NFD').replace(MARCAS_G, '').toLowerCase();
    if (x.length !== 1) {
      const y = c.toLowerCase();
      x = y.length === 1 ? y : ' ';
    }
    if (ES_MARCA.test(x)) x = ' ';
    n += x;
  }
  return { o, n };
}

/** Recorta el par entre dos posiciones. */
export function cortar(t, desde = 0, hasta = t.n.length) {
  return { o: t.o.slice(desde, hasta), n: t.n.slice(desde, hasta) };
}

/** Une dos pedazos (agrega un espacio si hace falta). */
export function unir(a, b) {
  const sep = a.n && b.n && !/\s$/.test(a.n) && !/^\s/.test(b.n) ? ' ' : '';
  return { o: a.o + sep + b.o, n: a.n + sep + b.n };
}

const BORDE_INI = /^[\s,.;:!?¡¿"'«»“”‘’()\-–—…]*/;
const BORDE_FIN = /[\s,.;:!?¡¿"'«»“”‘’()\-–—…]*$/;

/** Saca espacios y signos de los bordes. Con `mantenerFinal` deja el signo
 *  final (para mensajes: "Hola amigo." conserva el punto). */
export function recortar(t, { mantenerFinal = false } = {}) {
  const a = t.n.match(BORDE_INI)[0].length;
  const resto = t.n.slice(a);
  const fin = mantenerFinal ? resto.match(/\s*$/)[0].length : resto.match(BORDE_FIN)[0].length;
  return cortar(t, a, Math.max(a, t.n.length - fin));
}

/** Si `re` (que empieza con ^) coincide al principio, lo quita. */
export function quitarInicio(t, re) {
  const m = re.exec(t.n);
  if (!m || m.index !== 0 || m[0].length === 0) return t;
  return cortar(t, m[0].length);
}

/** Si `re` (que termina con $) coincide al final, lo quita. */
export function quitarFinal(t, re) {
  const m = re.exec(t.n);
  if (!m || m[0].length === 0 || m.index + m[0].length !== t.n.length) return t;
  return cortar(t, 0, m.index);
}

/** Quita varios tramos [desde, hasta) y deja un espacio en su lugar. */
export function quitarTramos(t, tramos) {
  let o = '', n = '', pos = 0;
  for (const [a, b] of [...tramos].sort((x, y) => x[0] - y[0])) {
    if (a < pos) continue;
    o += t.o.slice(pos, a) + ' ';
    n += t.n.slice(pos, a) + ' ';
    pos = b;
  }
  o += t.o.slice(pos);
  n += t.n.slice(pos);
  return compactar({ o, n });
}

/** Junta espacios repetidos sin perder la alineación. */
export function compactar(t) {
  let o = '', n = '';
  for (let i = 0; i < t.n.length; i++) {
    if (/\s/.test(t.n[i]) && (n.endsWith(' ') || n === '')) continue;
    o += /\s/.test(t.n[i]) ? ' ' : t.o[i];
    n += /\s/.test(t.n[i]) ? ' ' : t.n[i];
  }
  return { o: o.trimEnd(), n: n.trimEnd() };
}

/** Pone en mayúscula la primera letra ("hola" → "Hola"). */
export function capitalizar(s) {
  return String(s ?? '').replace(/^([\s¿¡"'«“‘(]*)(\p{Ll})/u, (_, a, b) => a + b.toUpperCase());
}

/** Cuántos cambios de letras hay entre dos palabras (distancia de Levenshtein). */
export function distancia(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Parecido entre 0 (nada que ver) y 1 (iguales). */
export function similitud(a, b) {
  if (!a || !b) return 0;
  return 1 - distancia(a, b) / Math.max(a.length, b.length);
}

/** Para usar un texto cualquiera dentro de una expresión regular. */
export function escaparRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
