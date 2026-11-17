// clima.js — Pronóstico con Open-Meteo (gratis y sin claves).
// Se usa la ubicación aproximada del teléfono (solo cuando se pide el clima).

const CODIGOS = [
  [[0], 'despejado'], [[1], 'mayormente despejado'], [[2], 'parcialmente nublado'], [[3], 'nublado'],
  [[45, 48], 'con niebla'], [[51, 53, 55], 'con llovizna'], [[56, 57], 'con llovizna helada'],
  [[61], 'con lluvia débil'], [[63], 'con lluvia'], [[65], 'con lluvia fuerte'], [[66, 67], 'con lluvia helada'],
  [[71, 73], 'con nieve'], [[75], 'con nevadas fuertes'], [[77], 'con granizo fino'],
  [[80, 81], 'con chaparrones'], [[82], 'con chaparrones fuertes'], [[85, 86], 'con nevadas'],
  [[95], 'con tormentas'], [[96, 99], 'con tormentas y granizo'],
];

export function describirCodigo(codigo) {
  const f = CODIGOS.find(([lista]) => lista.includes(Number(codigo)));
  return f ? f[1] : 'variable';
}

export const urlPronostico = (lat, lon) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
  '&current=temperature_2m,apparent_temperature,weather_code' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
  '&timezone=auto&forecast_days=3';

export const urlLugar = (nombre) =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nombre)}&count=1&language=es&format=json`;

/** Arma la frase: "Ahora hay 22°, parcialmente nublado. Hoy, máxima de 27°..." */
export function textoClima(datos, cuando = 0, lugar = '') {
  const r = Math.round;
  const d = datos.daily || {};
  const donde = lugar ? ` en ${lugar}` : '';
  const lluvia = (i) => {
    const p = d.precipitation_probability_max && d.precipitation_probability_max[i];
    return p == null ? '' : `, ${r(p)}% de probabilidad de lluvia`;
  };
  if (cuando === 0 && datos.current) {
    const a = datos.current;
    let s = `Ahora${donde} hay ${r(a.temperature_2m)}°, ${describirCodigo(a.weather_code)}`;
    if (a.apparent_temperature != null && Math.abs(a.apparent_temperature - a.temperature_2m) >= 3) {
      s += ` (sensación de ${r(a.apparent_temperature)}°)`;
    }
    if (d.temperature_2m_max) s += `. Hoy, máxima de ${r(d.temperature_2m_max[0])}° y mínima de ${r(d.temperature_2m_min[0])}°${lluvia(0)}`;
    return `${s}.`;
  }
  const i = Math.min(cuando, (d.time || []).length - 1);
  const dia = cuando === 1 ? 'Mañana' : 'Pasado mañana';
  return `${dia}${donde}: ${describirCodigo(d.weather_code[i]).replace(/^con /, '')}, máxima de ${r(d.temperature_2m_max[i])}° y mínima de ${r(d.temperature_2m_min[i])}°${lluvia(i)}.`;
}

/**
 * @param {{lugar?: string, cuando?: number, posicion: () => Promise<{lat:number, lon:number}>, fetchFn?: Function}} p
 */
export async function consultarClima({ lugar = '', cuando = 0, posicion, fetchFn = globalThis.fetch }) {
  let lat;
  let lon;
  let nombre = '';
  if (lugar) {
    const g = await (await fetchFn(urlLugar(lugar))).json();
    const res = g && g.results && g.results[0];
    if (!res) throw new Error('lugar');
    ({ latitude: lat, longitude: lon, name: nombre } = res);
  } else {
    ({ lat, lon } = await posicion());
  }
  const resp = await fetchFn(urlPronostico(lat, lon));
  if (!resp.ok) throw new Error('pronostico');
  return textoClima(await resp.json(), cuando, nombre);
}
