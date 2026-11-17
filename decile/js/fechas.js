// fechas.js — Entiende fechas y horas dichas en castellano:
// "mañana a las 10", "el viernes a las 5 y media", "el 25 de diciembre",
// "en 20 minutos", "esta noche", "a la una de la tarde"...
//
// Trabaja sobre texto normalizado (sin tildes, minúsculas) y devuelve también
// los tramos que usó, para poder sacarlos del título del evento.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DIAS_LINDOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const NUMEROS = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
  nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30,
};
const NUM = '(\\d{1,2}|una|uno|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta)';
const H = '(?<h>\\d{1,2}|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)';
const AMPM = 'a\\.?\\s?m\\.?|p\\.?\\s?m\\.?';
const COLA =
  '(?:\\s*(?::|\\.|h)\\s*(?<mm>\\d{2}))?' +                 // :30
  '(?:\\s*(?:hs|h|horas|hrs)\\b\\.?)?' +                     // hs
  '(?:\\s+y\\s+(?<y>media|cuarto|\\d{1,2}|cinco|diez|veinte))?' +
  '(?:\\s+menos\\s+(?<menos>cuarto|\\d{1,2}|cinco|diez|veinte))?' +
  `(?:\\s*(?<ampm>${AMPM}))?`;

// "a las 5", "para las 17:30", "a la una y media"
const RE_HORA_A = new RegExp(`\\b(?:a|para|desde|tipo|como\\s+a|cerca\\s+de|hasta|antes\\s+de)\\s+las?\\s+${H}${COLA}`);
// "las 5 y media", "las 17 hs" (sin "a" adelante: exige algo que diga que es hora)
const RE_HORA_B = new RegExp(`\\blas?\\s+${H}(?=\\s*(?::|\\.\\d|h\\b|hs\\b|horas\\b|y\\s+(?:media|cuarto)|menos\\s+cuarto|${AMPM}))${COLA}`);
// "17:30", "5 pm"
const RE_HORA_C = new RegExp(`\\b(?<h>\\d{1,2})(?::|\\.)(?<mm>\\d{2})\\b(?:\\s*(?:hs|h)\\b\\.?)?(?:\\s*(?<ampm>${AMPM}))?|\\b(?<h2>\\d{1,2})\\s*(?<ampm2>${AMPM})`);

const aNumero = (s) => (/^\d+$/.test(s) ? parseInt(s, 10) : NUMEROS[s]);
const sumarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
const dos = (n) => String(n).padStart(2, '0');

/** → { fecha: Date|null, conHora: boolean, tramos: [[desde, hasta], ...] } */
export function extraerFechaHora(norm, ahora = new Date(), { preferirManana = false } = {}) {
  let txt = String(norm ?? '');
  const tramos = [];
  const buscar = (re) => {
    const m = re.exec(txt);
    if (m) {
      tramos.push([m.index, m.index + m[0].length]);
      txt = txt.slice(0, m.index) + ' '.repeat(m[0].length) + txt.slice(m.index + m[0].length);
    }
    return m;
  };

  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  let dia = null;
  let hora = null;
  let minuto = 0;
  let franja = null;
  let ampm = null;
  let exacta = null;
  let m;

  // 1) Momento del día: "esta noche", "a la mañana", "de la tarde", "al mediodía"
  if ((m = buscar(/\besta\s+(manana|tarde|noche)\b/))) { dia = hoy; franja = m[1]; }
  if ((m = buscar(/\b(?:de|a|por|en|durante)\s+la\s+(manana|madrugada|tarde|noche)\b/))) franja = m[1];
  if (buscar(/\b(?:(?:al|para\s+el|a\s+las?)\s+)?mediodia\b/)) { hora = 12; minuto = 0; }
  if (buscar(/\b(?:a\s+la\s+)?medianoche\b/)) { hora = 0; minuto = 0; }

  // 2) Relativo: "en media hora", "en 20 minutos", "dentro de 2 horas", "en 3 días"
  if (buscar(/\b(?:en|dentro\s+de)\s+media\s+hora\b/)) exacta = new Date(ahora.getTime() + 30 * 60000);
  if (!exacta && (m = buscar(new RegExp(`\\b(?:en|dentro\\s+de)\\s+${NUM}\\s+(minutos?|horas?|dias?|semanas?)\\b`)))) {
    const n = aNumero(m[1]);
    if (m[2].startsWith('min')) exacta = new Date(ahora.getTime() + n * 60000);
    else if (m[2].startsWith('hora')) exacta = new Date(ahora.getTime() + n * 3600000);
    else dia = sumarDias(hoy, n * (m[2].startsWith('semana') ? 7 : 1));
  }

  // 3) Día
  if (!dia && !exacta) {
    if (buscar(/\bpasado\s+manana\b/)) dia = sumarDias(hoy, 2);
    else if (buscar(/\bmanana\b/)) dia = sumarDias(hoy, 1);
    else if (buscar(/\bhoy\b/)) dia = hoy;
    else if ((m = buscar(new RegExp(`\\b(?:el\\s+)?(\\d{1,2}|primero)\\s+de\\s+(${MESES.join('|')}|setiembre)(?:\\s+(?:de|del)\\s+(\\d{4}))?\\b`)))) {
      const d = m[1] === 'primero' ? 1 : parseInt(m[1], 10);
      const mes = m[2] === 'setiembre' ? 8 : MESES.indexOf(m[2]);
      const anio = m[3] ? parseInt(m[3], 10) : hoy.getFullYear();
      let f = new Date(anio, mes, d);
      if (!m[3] && f < hoy) f = new Date(anio + 1, mes, d);
      dia = f;
    } else if ((m = buscar(/\b(?:el\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
      const d = parseInt(m[1], 10);
      const mes = parseInt(m[2], 10) - 1;
      let anio = m[3] ? parseInt(m[3], 10) : hoy.getFullYear();
      if (anio < 100) anio += 2000;
      let f = new Date(anio, mes, d);
      if (!m[3] && f < hoy) f = new Date(anio + 1, mes, d);
      if (mes >= 0 && mes < 12 && d >= 1 && d <= 31) dia = f;
    } else if ((m = buscar(/\b(?:(el|este|esta)\s+)?(?:proximo\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?:\s+(?:que\s+viene|proximo))?\b/))) {
      let delta = (DIAS.indexOf(m[2]) - hoy.getDay() + 7) % 7;
      if (delta === 0 && m[1] !== 'este' && m[1] !== 'esta') delta = 7;
      dia = sumarDias(hoy, delta);
    } else if (buscar(/\b(?:la\s+semana\s+que\s+viene|la\s+proxima\s+semana|la\s+semana\s+proxima)\b/)) {
      dia = sumarDias(hoy, 7);
    } else if ((m = buscar(/\bel\s+(\d{1,2})\b(?!\s*(?:de\s+(?:la|el)\b|:|\.\d|hs\b|h\b|horas|y\s+(?:media|cuarto)|minutos))/))) {
      const d = parseInt(m[1], 10);
      if (d >= 1 && d <= 31) {
        let f = new Date(hoy.getFullYear(), hoy.getMonth(), d);
        if (f < hoy) f = new Date(hoy.getFullYear(), hoy.getMonth() + 1, d);
        dia = f;
      }
    }
  }

  // 4) Hora
  if (!exacta && (m = buscar(RE_HORA_A) || buscar(RE_HORA_B) || buscar(RE_HORA_C))) {
    const g = m.groups;
    let h = aNumero(g.h ?? g.h2);
    let mi = g.mm ? parseInt(g.mm, 10) : 0;
    if (g.y) mi = g.y === 'media' ? 30 : g.y === 'cuarto' ? 15 : aNumero(g.y);
    if (g.menos) {
      const resta = g.menos === 'cuarto' ? 15 : aNumero(g.menos);
      h -= 1;
      mi = 60 - resta;
      if (h < 0) h = 23;
    }
    const ap = g.ampm || g.ampm2;
    if (ap) ampm = ap.startsWith('p') ? 'pm' : 'am';
    if (h >= 0 && h <= 23 && mi >= 0 && mi < 60) { hora = h; minuto = mi; }
  }

  // 5) ¿Mañana o tarde? "a las 5" casi siempre es 17:00; "a las 8", 8:00.
  if (hora !== null && !exacta) {
    if (ampm === 'pm' && hora < 12) hora += 12;
    else if (ampm === 'am' && hora === 12) hora = 0;
    else if (!ampm && hora <= 12) {
      if (franja === 'tarde' || franja === 'noche') {
        if (hora === 12 && franja === 'noche') { hora = 0; dia = sumarDias(dia || hoy, 1); }
        else if (hora < 12) hora += 12;
      } else if (franja === 'manana' || franja === 'madrugada') {
        if (hora === 12) hora = 0;
      } else if (hora >= 1 && hora <= 6 && !preferirManana) {
        hora += 12;                                     // (para alarmas se prefiere la mañana)
      }
    }
  }

  let fecha = null;
  let conHora = false;
  if (exacta) {
    fecha = exacta;
    conHora = true;
  } else {
    if (hora === null && franja) hora = { manana: 9, madrugada: 6, tarde: 16, noche: 21 }[franja];
    if (hora !== null) {
      const base = dia || hoy;
      fecha = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hora, minuto);
      conHora = true;
      if (!dia && fecha <= ahora) fecha = sumarDias(fecha, 1); // esa hora ya pasó hoy: mañana
    } else if (dia) {
      fecha = dia;
    }
  }
  return { fecha, conHora, tramos };
}

/** "hoy a las 15:30", "mañana a las 10:00", "el viernes 21 de noviembre". */
export function describirFecha(fecha, conHora, ahora = new Date()) {
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const dia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const dif = Math.round((dia - hoy) / 86400000);
  let txt;
  if (dif === 0) txt = 'hoy';
  else if (dif === 1) txt = 'mañana';
  else txt = `el ${DIAS_LINDOS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
  if (dif > 1 && fecha.getFullYear() !== ahora.getFullYear()) txt += ` de ${fecha.getFullYear()}`;
  if (conHora) {
    const h = fecha.getHours();
    txt += `${h === 1 ? ' a la ' : ' a las '}${h}:${dos(fecha.getMinutes())}`;
  }
  return txt;
}

export function horaLinda(fecha) {
  return `${fecha.getHours()}:${dos(fecha.getMinutes())}`;
}
