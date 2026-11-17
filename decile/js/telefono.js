// telefono.js — Números de teléfono: limpiarlos y pasarlos al formato de cada app.
//
// WhatsApp pide el número internacional sin "+" ni espacios. En Argentina,
// además, los celulares llevan un 9 después del 54 y NO llevan el 15:
//   0294 15 412-3456  →  5492944123456

/** Solo los dígitos. */
export function digitos(s) {
  return String(s ?? '').replace(/\D/g, '');
}

/** ¿Parece un número de teléfono? (solo dígitos y signos de número). */
export function esNumero(s) {
  const t = String(s ?? '').trim();
  const d = digitos(t);
  if (d.length < 3) return false;
  if (t.replace(/[\d\s\-+().\/]/g, '').length) return false;
  return d.length >= 6 || d.length === 3; // 3 cifras: 911, 107, 100...
}

/** Parte argentina: devuelve área + número con el 9 de celular adelante. */
function argentina(n, area) {
  let r = n.replace(/^0+/, '');                 // 0 de larga distancia
  if (/^9\d{10}$/.test(r)) r = r.slice(1);       // ya traía el 9
  const a = digitos(area).replace(/^0+/, '');
  if (a) {
    if (r.startsWith('15') && a.length + r.length - 2 === 10) r = a + r.slice(2); // 15 + número, sin área
    else if (a.length + r.length === 10) r = a + r;                               // número sin área
  }
  if (r.length === 12) {                          // área + 15 + número
    for (const largo of [2, 3, 4]) {
      if (r.substr(largo, 2) === '15') { r = r.slice(0, largo) + r.slice(largo + 2); break; }
    }
  }
  return r.length === 10 ? '9' + r : r;
}

/** Número internacional SIN "+", como lo usa WhatsApp (wa.me/5492944123456).
 *  Devuelve '' si no alcanza para ser un número. */
export function paraWhatsApp(numero, { codigoPais = '54', codigoArea = '' } = {}) {
  const crudo = String(numero ?? '').trim();
  const d = digitos(crudo);
  if (d.length < 6) return '';
  const cp = digitos(codigoPais) || '54';
  if (crudo.startsWith('+') || d.startsWith('00')) {
    const intl = crudo.startsWith('+') ? d : d.slice(2);
    return intl.startsWith('54') ? '54' + argentina(intl.slice(2), '') : intl;
  }
  if (cp === '54') {
    if (/^549?\d{10}$/.test(d)) return '54' + argentina(d.slice(2), ''); // ya venía con 54
    return '54' + argentina(d, codigoArea);
  }
  if (d.startsWith(cp) && d.length >= cp.length + 8) return d;  // ya venía con el código
  return cp + d.replace(/^0+/, '');
}

/** Para llamar o mandar SMS: se respeta el número como está guardado
 *  (así marca bien desde el propio país), solo se limpia. */
export function paraLlamar(numero) {
  const t = String(numero ?? '').trim();
  const d = digitos(t);
  if (!d) return '';
  if (t.startsWith('+')) return '+' + d;
  if (d.startsWith('00')) return '+' + d.slice(2);
  return d;
}

/** ¿El número para WhatsApp quedó con un largo raro? (para avisar al usuario) */
export function numeroDudoso(intl) {
  if (!intl) return true;
  if (intl.startsWith('54')) return !/^549\d{10}$/.test(intl);
  return intl.length < 10 || intl.length > 15;
}

/** Lindo para mostrar: 5492944123456 → "+54 9 294 412-3456". */
export function mostrarNumero(intl) {
  if (!intl) return '';
  if (/^549\d{10}$/.test(intl)) {
    const r = intl.slice(3);
    const area = r.startsWith('11') ? 2 : 3;
    const loc = r.slice(area);
    return `+54 9 ${r.slice(0, area)} ${loc.slice(0, loc.length - 4)}-${loc.slice(-4)}`;
  }
  return '+' + intl;
}
