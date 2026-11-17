// vcard.js — Lee archivos de contactos .vcf (vCard), el formato que exportan
// el iPhone, Android y Google Contacts.

function unirLineas(texto) {
  const crudas = String(texto ?? '').replace(/\r\n?/g, '\n').split('\n');
  const lineas = [];
  for (const l of crudas) {
    const ultima = lineas.length - 1;
    if (ultima >= 0 && /^[ \t]/.test(l)) {
      lineas[ultima] += l.slice(1);                       // línea "plegada"
    } else if (ultima >= 0 && /QUOTED-PRINTABLE/i.test(lineas[ultima]) && lineas[ultima].endsWith('=')) {
      lineas[ultima] = lineas[ultima].slice(0, -1) + l;   // salto blando de quoted-printable
    } else {
      lineas.push(l);
    }
  }
  return lineas;
}

function quotedPrintable(valor) {
  const bytes = [];
  for (let i = 0; i < valor.length; i++) {
    const c = valor[i];
    if (c === '=' && /^[0-9A-F]{2}$/i.test(valor.slice(i + 1, i + 3))) {
      bytes.push(parseInt(valor.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(...new TextEncoder().encode(c));
    }
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
}

const desescapar = (s) => s.replace(/\\n/gi, ' ').replace(/\\([,;:\\])/g, '$1').trim();

/** Devuelve una lista de { nombre, telefonos, emails }. */
export function leerVCard(texto) {
  const contactos = [];
  let actual = null;
  for (const linea of unirLineas(texto)) {
    if (/^BEGIN:VCARD/i.test(linea)) { actual = { fn: '', n: '', org: '', telefonos: [], emails: [] }; continue; }
    if (/^END:VCARD/i.test(linea)) {
      if (actual) contactos.push(actual);
      actual = null;
      continue;
    }
    if (!actual) continue;
    const dosPuntos = linea.indexOf(':');
    if (dosPuntos < 0) continue;
    const cabecera = linea.slice(0, dosPuntos).replace(/^[^.;:]+\./, ''); // saca "item1."
    const partes = cabecera.split(';');
    const prop = partes[0].toUpperCase();
    const params = partes.slice(1).join(';');
    let valor = linea.slice(dosPuntos + 1);
    if (/QUOTED-PRINTABLE/i.test(params)) valor = quotedPrintable(valor);
    if (prop === 'FN') actual.fn = desescapar(valor);
    else if (prop === 'N') actual.n = valor;
    else if (prop === 'ORG') actual.org = desescapar(valor.split(';')[0] || '');
    else if (prop === 'TEL') {
      const tel = valor.replace(/^tel:/i, '').trim();
      if (tel) actual.telefonos.push(tel);
    } else if (prop === 'EMAIL') {
      const mail = valor.replace(/^mailto:/i, '').trim();
      if (mail) actual.emails.push(mail);
    }
  }
  return contactos
    .map((c) => {
      let nombre = c.fn;
      if (!nombre && c.n) {
        const [apellido = '', pila = '', segundo = ''] = c.n.split(';').map(desescapar);
        nombre = [pila, segundo, apellido].filter(Boolean).join(' ');
      }
      nombre = nombre || c.org || c.emails[0] || c.telefonos[0] || '';
      return { nombre: nombre.replace(/\s+/g, ' ').trim(), telefonos: c.telefonos, emails: c.emails };
    })
    .filter((c) => c.nombre && (c.telefonos.length || c.emails.length));
}
