// Pruebas de números de teléfono, agenda, archivos .vcf y fechas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paraWhatsApp, paraLlamar, mostrarNumero, numeroDudoso, esNumero } from '../js/telefono.js';
import { buscarContacto, fusionarContactos } from '../js/contactos.js';
import { leerVCard } from '../js/vcard.js';
import { extraerFechaHora, describirFecha } from '../js/fechas.js';
import { alinear, recortar, quitarTramos } from '../js/texto.js';

test('números para WhatsApp (Argentina y otros países)', () => {
  assert.equal(paraWhatsApp('+54 9 11 2345-6789'), '5491123456789');
  assert.equal(paraWhatsApp('011 15 2345-6789'), '5491123456789');
  assert.equal(paraWhatsApp('0294 15 412-3456'), '5492944123456');
  assert.equal(paraWhatsApp('11 2345 6789'), '5491123456789');
  assert.equal(paraWhatsApp('+54 11 2345 6789'), '5491123456789');
  assert.equal(paraWhatsApp('5491123456789'), '5491123456789');
  assert.equal(paraWhatsApp('2945 15 45-6789'), '5492945456789');
  assert.equal(paraWhatsApp('15 412 3456', { codigoArea: '294' }), '5492944123456');
  assert.equal(paraWhatsApp('412-3456', { codigoArea: '0294' }), '5492944123456');
  assert.equal(paraWhatsApp('099 123 456', { codigoPais: '598' }), '59899123456');
  assert.equal(paraWhatsApp('+34 612 34 56 78'), '34612345678');
  assert.equal(paraWhatsApp('612 34 56 78', { codigoPais: '34' }), '34612345678');
  assert.equal(paraWhatsApp('123'), '');
});

test('números para llamar y para mostrar', () => {
  assert.equal(paraLlamar('0294 15 412-3456'), '0294154123456');
  assert.equal(paraLlamar('+54 9 11 2345-6789'), '+5491123456789');
  assert.equal(paraLlamar('0054 9 11 2345 6789'), '+5491123456789');
  assert.equal(mostrarNumero('5492944123456'), '+54 9 294 412-3456');
  assert.equal(mostrarNumero('5491123456789'), '+54 9 11 2345-6789');
  assert.equal(mostrarNumero('34612345678'), '+34612345678');
  assert.equal(numeroDudoso('544123456'), true);
  assert.equal(numeroDudoso('5491123456789'), false);
  assert.equal(esNumero('911'), true);
  assert.equal(esNumero('11 2345-6789'), true);
  assert.equal(esNumero('Juan'), false);
  assert.equal(esNumero('10'), false);
});

const AGENDA = [
  { id: 'a', nombre: 'Juan Gómez', alias: [], telefonos: ['1'], emails: [] },
  { id: 'b', nombre: 'Juan Pérez', alias: [], telefonos: ['2'], emails: [] },
  { id: 'c', nombre: 'Mamá', alias: ['La Vieja'], telefonos: ['3'], emails: [] },
  { id: 'd', nombre: 'María de los Ángeles Ruiz', alias: ['Marita'], telefonos: ['4'], emails: [] },
];

test('buscar contactos aunque el dictado se equivoque', () => {
  assert.equal(buscarContacto('juan gomes', AGENDA).contacto.id, 'a');
  assert.equal(buscarContacto('Yuan Gómez', AGENDA).contacto.id, 'a');
  assert.equal(buscarContacto('gómez', AGENDA).contacto.id, 'a');
  assert.equal(buscarContacto('Juan', AGENDA).estado, 'varios');
  assert.equal(buscarContacto('Juan', AGENDA).candidatos.length, 2);
  assert.equal(buscarContacto('a mi mamá', AGENDA).contacto.id, 'c');
  assert.equal(buscarContacto('la vieja', AGENDA).contacto.id, 'c');
  assert.equal(buscarContacto('marita', AGENDA).contacto.id, 'd');
  assert.equal(buscarContacto('María Ruiz', AGENDA).contacto.id, 'd');
  assert.equal(buscarContacto('Roberto', AGENDA).estado, 'ninguno');
});

test('juntar contactos importados sin duplicar', () => {
  const r = fusionarContactos(
    [{ id: 'a', nombre: 'Juan Gómez', telefonos: ['+54 9 11 2345-6789'] }],
    [
      { nombre: 'juan gomez', telefonos: ['011 15 2345-6789', '+54 9 11 9999-0000'] }, // el 1.º es el mismo número
      { nombre: 'Ana', telefonos: ['2944000000'], emails: ['ana@x.com'] },
      { nombre: '', telefonos: ['123456'] },
    ],
  );
  assert.equal(r.agregados, 1);
  assert.equal(r.actualizados, 1);
  assert.deepEqual(r.lista.map((c) => c.nombre), ['Ana', 'Juan Gómez']);
  assert.equal(r.lista[1].telefonos.length, 2);
  assert.equal(r.lista[1].id, 'a');
});

test('leer archivos .vcf (iPhone, Android, Google)', () => {
  const vcf = [
    'BEGIN:VCARD', 'VERSION:3.0', 'N:Gómez;Juan;;;', 'FN:Juan Gómez',
    'item1.TEL;type=CELL;type=VOICE;type=pref:+54 9 11 2345-6789', 'EMAIL;type=INTERNET:juan@example.com', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:2.1', 'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:P=C3=A9rez;Jos=C3=A9;;;',
    'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Jos=C3=A9 P=C3=A9rez', 'TEL;CELL:0294 15 412-3456', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:4.0', 'N:Fernández;Laura;;;', 'TEL;VALUE=uri;TYPE=cell:tel:+54-11-3333-4444',
    'NOTE:Una nota muy larga que', '  sigue en otra línea', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:3.0', 'FN:Sin datos', 'END:VCARD',
  ].join('\r\n');
  const r = leerVCard(vcf);
  assert.deepEqual(r.map((c) => c.nombre), ['Juan Gómez', 'José Pérez', 'Laura Fernández']);
  assert.deepEqual(r[0].telefonos, ['+54 9 11 2345-6789']);
  assert.deepEqual(r[0].emails, ['juan@example.com']);
  assert.deepEqual(r[2].telefonos, ['+54-11-3333-4444']);
});

// Martes 17/11/2026 10:00
const AHORA = new Date(2026, 10, 17, 10, 0);
const cuando = (frase, ahora = AHORA) => {
  const r = extraerFechaHora(alinear(frase).n, ahora);
  return r.fecha ? [r.fecha.getMonth() + 1, r.fecha.getDate(), r.conHora ? r.fecha.getHours() : null, r.conHora ? r.fecha.getMinutes() : null] : null;
};

test('fechas y horas en castellano', () => {
  assert.deepEqual(cuando('a las 5'), [11, 17, 17, 0]);
  assert.deepEqual(cuando('a las 8'), [11, 18, 8, 0]);               // las 8 ya pasaron: mañana
  assert.deepEqual(cuando('el 25/12'), [12, 25, null, null]);
  assert.deepEqual(cuando('el viernes que viene'), [11, 20, null, null]);
  assert.deepEqual(cuando('el lunes'), [11, 23, null, null]);
  assert.deepEqual(cuando('el martes'), [11, 24, null, null]);
  assert.deepEqual(cuando('este martes a las 18'), [11, 17, 18, 0]);
  assert.deepEqual(cuando('mañana a la una y media de la tarde'), [11, 18, 13, 30]);
  assert.deepEqual(cuando('mañana a las 8 menos cuarto'), [11, 18, 7, 45]);
  assert.deepEqual(cuando('17:30'), [11, 17, 17, 30]);
  assert.deepEqual(cuando('a las 5 pm'), [11, 17, 17, 0]);
  assert.deepEqual(cuando('a las 7 de la mañana'), [11, 18, 7, 0]);
  assert.deepEqual(cuando('pasado mañana al mediodía'), [11, 19, 12, 0]);
  assert.deepEqual(cuando('en 2 horas'), [11, 17, 12, 0]);
  assert.deepEqual(cuando('dentro de media hora'), [11, 17, 10, 30]);
  assert.deepEqual(cuando('en 3 días'), [11, 20, null, null]);
  assert.deepEqual(cuando('el 3 de marzo'), [3, 3, null, null]);
  assert.deepEqual(cuando('a las 12 de la noche'), [11, 18, 0, 0]);
  assert.deepEqual(cuando('mañana a la mañana'), [11, 18, 9, 0]);
  assert.deepEqual(cuando('a las 17 hs'), [11, 17, 17, 0]);
  assert.equal(cuando('comprar las 2 pizzas'), null);               // "las 2" no es una hora
  assert.equal(cuando('llamar a Juan'), null);
});

test('el título del evento queda sin la fecha', () => {
  const t = alinear('reunión con Pedro el viernes a las 15:30 en la oficina');
  const { tramos } = extraerFechaHora(t.n, AHORA);
  assert.equal(recortar(quitarTramos(t, tramos)).o, 'reunión con Pedro en la oficina');
});

test('describir la fecha en lindo', () => {
  assert.equal(describirFecha(new Date(2026, 10, 17, 15, 30), true, AHORA), 'hoy a las 15:30');
  assert.equal(describirFecha(new Date(2026, 10, 18, 10, 0), true, AHORA), 'mañana a las 10:00');
  assert.equal(describirFecha(new Date(2026, 10, 20, 1, 5), true, AHORA), 'el viernes 20 de noviembre a la 1:05');
  assert.equal(describirFecha(new Date(2027, 2, 3), false, AHORA), 'el miércoles 3 de marzo de 2027');
});
