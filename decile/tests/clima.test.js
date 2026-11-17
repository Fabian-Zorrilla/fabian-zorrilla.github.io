// Pruebas del clima (con respuestas simuladas de Open-Meteo: sin internet).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoClima, consultarClima, describirCodigo, urlPronostico } from '../js/clima.js';

const DATOS = {
  current: { temperature_2m: 21.6, apparent_temperature: 18.2, weather_code: 2 },
  daily: {
    time: ['2026-11-17', '2026-11-18', '2026-11-19'],
    weather_code: [2, 61, 0],
    temperature_2m_max: [24.4, 19.1, 26],
    temperature_2m_min: [9.8, 8.2, 11.4],
    precipitation_probability_max: [10, 80, 0],
  },
};

test('arma la frase del clima', () => {
  assert.equal(textoClima(DATOS, 0), 'Ahora hay 22°, parcialmente nublado (sensación de 18°). Hoy, máxima de 24° y mínima de 10°, 10% de probabilidad de lluvia.');
  assert.equal(textoClima(DATOS, 1, 'Bariloche'), 'Mañana en Bariloche: lluvia débil, máxima de 19° y mínima de 8°, 80% de probabilidad de lluvia.');
  assert.equal(textoClima(DATOS, 2), 'Pasado mañana: despejado, máxima de 26° y mínima de 11°, 0% de probabilidad de lluvia.');
  assert.equal(describirCodigo(95), 'con tormentas');
  assert.equal(describirCodigo(1234), 'variable');
});

test('consulta por ubicación o por ciudad', async () => {
  const pedidos = [];
  const fetchFalso = async (url) => {
    pedidos.push(url);
    if (url.includes('geocoding')) return { ok: true, json: async () => ({ results: [{ name: 'Córdoba', latitude: -31.4, longitude: -64.18 }] }) };
    return { ok: true, json: async () => DATOS };
  };
  const t1 = await consultarClima({ cuando: 0, posicion: async () => ({ lat: -41.13, lon: -71.31 }), fetchFn: fetchFalso });
  assert.match(t1, /^Ahora hay 22°/);
  assert.equal(pedidos[0], urlPronostico(-41.13, -71.31));
  const t2 = await consultarClima({ lugar: 'Córdoba', cuando: 1, posicion: async () => { throw new Error('no debería pedir ubicación'); }, fetchFn: fetchFalso });
  assert.match(t2, /^Mañana en Córdoba:/);
  assert.match(pedidos[1], /name=C%C3%B3rdoba/);
  const sinLugar = async () => ({ ok: true, json: async () => ({ results: [] }) });
  await assert.rejects(consultarClima({ lugar: 'Ningunlado', posicion: async () => ({}), fetchFn: sinLugar }), /lugar/);
});
