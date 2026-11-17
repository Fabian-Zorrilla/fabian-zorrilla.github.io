// voz.js — Escuchar (dictado del navegador) y hablar (voz sintética).
//
// Reglas aprendidas en Amigo:
//  - UNA frase por toque (continuous = false) y NUNCA reiniciar el dictado
//    solo: en Android eso hace que repita palabras.
//  - Siempre se muestra el texto para revisarlo antes de hacer nada.

const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const puedeEscuchar = !!SR;
export const puedeHablar = typeof globalThis.speechSynthesis !== 'undefined';

/**
 * Escucha una frase.
 * alParcial(texto) mientras habla · alFinal([versiones]) al terminar ·
 * alError(codigo) si falla · alTerminar() si no se escuchó nada.
 * Devuelve { detener(), cancelar() } o null si no se pudo empezar.
 */
export function escuchar({ idioma = 'es-AR', alParcial, alFinal, alError, alTerminar } = {}) {
  if (!SR) {
    alError?.('no-soportado');
    return null;
  }
  const rec = new SR();
  rec.lang = idioma;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 5;

  let finales = null;
  let parcial = '';
  let error = null;
  let cancelado = false;
  let terminado = false;

  rec.onresult = (e) => {
    const fin = [];
    let interino = '';
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) fin.push(r);
      else interino += r[0].transcript;
    }
    if (fin.length === 1) finales = Array.from(fin[0], (a) => a.transcript.trim()).filter(Boolean);
    else if (fin.length > 1) finales = [fin.map((r) => r[0].transcript.trim()).join(' ')];
    const vista = `${fin.map((r) => r[0].transcript).join(' ')} ${interino}`.replace(/\s+/g, ' ').trim();
    if (vista) {
      parcial = vista;
      alParcial?.(vista);
    }
  };
  rec.onerror = (e) => { error = e.error || 'error'; };
  rec.onend = () => {
    if (terminado) return;
    terminado = true;
    if (cancelado) return alTerminar?.();
    if (finales && finales.length) return alFinal?.(finales);
    if (parcial && (!error || error === 'no-speech')) return alFinal?.([parcial]); // iPhone a veces no marca "final"
    if (error && error !== 'aborted') return alError?.(error);
    return alTerminar?.();
  };

  try {
    rec.start();
  } catch {
    terminado = true;
    alError?.('no-arranca');
    return null;
  }
  return {
    detener: () => { try { rec.stop(); } catch { /* ya estaba detenido */ } },
    cancelar: () => { cancelado = true; try { rec.abort(); } catch { /* ya estaba detenido */ } },
  };
}

/** Mensaje en castellano para cada error del dictado. */
export function explicarError(codigo) {
  switch (codigo) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'No tengo permiso para usar el micrófono. Habilitalo en los permisos del navegador, o escribí el pedido.';
    case 'no-speech':
      return 'No te escuché. Tocá el micrófono y hablá.';
    case 'audio-capture':
      return 'No encuentro el micrófono del teléfono.';
    case 'network':
      return 'El dictado necesita internet. Probá de nuevo o escribí el pedido.';
    case 'language-not-supported':
      return 'Ese idioma de dictado no está disponible. Cambialo en Ajustes.';
    case 'no-soportado':
      return 'Este navegador no tiene dictado. Tocá el micrófono del teclado para dictar, o escribí el pedido.';
    default:
      return 'No pude escuchar. Probá de nuevo.';
  }
}

function elegirVoz(idioma) {
  const voces = (puedeHablar && speechSynthesis.getVoices()) || [];
  const n = (l) => String(l || '').replace('_', '-').toLowerCase();
  const id = idioma.toLowerCase();
  return voces.find((v) => n(v.lang) === id)
    || voces.find((v) => ['es-419', 'es-us', 'es-mx', 'es-uy', 'es-cl', 'es-co'].includes(n(v.lang)))
    || voces.find((v) => n(v.lang).startsWith('es'))
    || null;
}

/** Las voces se cargan de a poco en algunos navegadores: pedirlas temprano. */
export function precargarVoces() {
  if (!puedeHablar) return;
  try {
    speechSynthesis.getVoices();
    speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices());
  } catch { /* sin voces */ }
}

export function hablar(texto, idioma = 'es-AR') {
  if (!puedeHablar || !texto) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(texto).replace(/[«»"“”]/g, '').replace(/https?:\/\/\S+/g, 'el enlace'));
    u.lang = idioma;
    const v = elegirVoz(idioma);
    if (v) u.voice = v;
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch { /* sin voz: no pasa nada */ }
}

export function callar() {
  try { if (puedeHablar) speechSynthesis.cancel(); } catch { /* nada */ }
}
