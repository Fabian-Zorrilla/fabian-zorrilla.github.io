// Prueba de punta a punta: abre Decile en Chromium (como un teléfono), carga
// contactos, simula el micrófono y revisa que los botones abran lo correcto.
//
// Uso:  node tests/e2e.mjs            (desde la carpeta decile/)
//       CAPTURAS=/ruta node tests/e2e.mjs   → guarda capturas de pantalla ahí
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'); // raíz del sitio
const PUERTO = 8765 + Math.floor(Math.random() * 200);
const BASE = `http://localhost:${PUERTO}/decile/`;
const CAPTURAS = process.env.CAPTURAS || '';

let fallas = 0;
let pasos = 0;
async function paso(nombre, fn) {
  pasos++;
  try {
    await fn();
    console.log(`  ✔ ${nombre}`);
  } catch (e) {
    fallas++;
    console.log(`  ✘ ${nombre}\n      ${String(e && e.message || e).split('\n').join('\n      ')}`);
  }
}
function igual(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg}\n esperaba: ${JSON.stringify(b)}\n      vino: ${JSON.stringify(a)}`);
}
function verdad(v, msg) { if (!v) throw new Error(msg); }

// Micrófono falso: devuelve lo que diga window.__dictado.
function microfonoFalso() {
  class ReconocimientoFalso {
    constructor() { this.lang = ''; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; }
    start() {
      window.__ultimoIdioma = this.lang;
      const texto = window.__dictado || '';
      const demora = window.__demora || 120;
      setTimeout(() => {
        if (!texto) { this.onerror && this.onerror({ error: 'no-speech' }); this.onend && this.onend(); return; }
        const alt = (t) => ({ transcript: t, confidence: 0.9 });
        const parcial = [alt(texto.split(' ').slice(0, 2).join(' '))];
        parcial.isFinal = false;
        this.onresult && this.onresult({ resultIndex: 0, results: [parcial] });
        const final = [alt(texto), alt(texto.toLowerCase())];
        final.isFinal = true;
        this.onresult && this.onresult({ resultIndex: 0, results: [final] });
        this.onend && this.onend();
      }, demora);
    }
    stop() {}
    abort() { this.onend && this.onend(); }
  }
  window.SpeechRecognition = ReconocimientoFalso;
  window.webkitSpeechRecognition = ReconocimientoFalso;
}

const VCF = [
  'BEGIN:VCARD', 'VERSION:3.0', 'FN:Mamá', 'TEL;TYPE=CELL:0294 15 412-3456', 'END:VCARD',
  'BEGIN:VCARD', 'VERSION:3.0', 'FN:Juan Pérez', 'TEL;TYPE=CELL:011 15 4444-5555', 'END:VCARD',
].join('\r\n');

async function main() {
  const servidor = spawn('python3', ['-m', 'http.server', String(PUERTO), '--bind', '127.0.0.1'], { cwd: RAIZ, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));
  const navegador = await chromium.launch();
  try {
    const contexto = await navegador.newContext({ ...devices['Pixel 7'], locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
    await contexto.addInitScript(microfonoFalso);
    // Sin internet de verdad: lo de afuera (WhatsApp, Maps…) se anota y se responde vacío.
    const afuera = [];
    await contexto.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|fonts\.)/, (r) => { afuera.push(r.request().url()); r.fulfill({ status: 200, contentType: 'text/html', body: '<title>afuera</title>' }); });
    await contexto.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const p = await contexto.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to launch/.test(m.text())) errores.push(`console: ${m.text()}`); });
    const captura = async (nombre) => { if (CAPTURAS) await p.waitForTimeout(350); if (CAPTURAS) await p.screenshot({ path: path.join(CAPTURAS, `${nombre}.png`), fullPage: true }); };
    const pedir = async (texto) => {
      await p.fill('#entrada', texto);
      await p.press('#entrada', 'Enter');
      await p.waitForSelector('#tarjeta:not([hidden])');
    };
    const hrefPrincipal = () => p.getAttribute('#tarjeta .boton.principal', 'href');

    console.log('Decile — prueba en el navegador');
    await p.goto(BASE);
    await p.waitForSelector('html[data-listo="1"]');

    await paso('abre sin errores y pide cargar contactos', async () => {
      verdad(await p.isVisible('#bienvenida'), 'falta el aviso de bienvenida');
      igual(await p.textContent('#estado'), 'Tocá el micrófono y decime qué hago');
      await captura('01-inicio');
    });

    await paso('agregar un contacto a mano (y ver el número para WhatsApp)', async () => {
      await p.click('a[href="#/contactos"]');
      await p.click('#btn-nuevo-contacto');
      await p.fill('#form-contacto [name=nombre]', 'Juan Gómez');
      await p.fill('#form-contacto [name=telefono]', '11 2345-6789');
      igual(await p.textContent('#vista-whatsapp'), 'Para WhatsApp: +54 9 11 2345-6789 ✓');
      await captura('02-contacto-nuevo');
      await p.click('#form-contacto button[value=guardar]');
      await p.waitForSelector('#lista-contactos li');
      igual((await p.textContent('#lista-contactos .c-nombre')).trim(), 'Juan Gómez');
    });

    await paso('importar un archivo .vcf', async () => {
      await p.setInputFiles('#archivo-vcf', { name: 'contactos.vcf', mimeType: 'text/vcard', buffer: Buffer.from(VCF) });
      await p.waitForFunction(() => document.querySelectorAll('#lista-contactos li').length === 3);
      igual(await p.textContent('#aviso'), 'Listo: 2 nuevos.');
      igual(await p.textContent('#cuenta-contactos'), '3 contactos');
      await captura('03-contactos');
    });

    await paso('el ejemplo pedido: WhatsApp a Juan Gómez «Hola amigo.»', async () => {
      await p.click('.marca');
      verdad(!(await p.isVisible('#bienvenida')), 'la bienvenida no debería verse con contactos');
      await pedir('Enviale un WhatsApp a Juan Gómez qué diga. Hola amigo.');
      igual(await p.textContent('.tarjeta-titulo'), 'WhatsApp para Juan Gómez');
      igual(await p.textContent('.tarjeta-detalle'), '+54 9 11 2345-6789');
      igual(await p.inputValue('#campo-mensaje'), 'Hola amigo.');
      igual(await hrefPrincipal(), 'https://wa.me/5491123456789?text=Hola%20amigo.');
      igual(await p.textContent('#tarjeta .boton.principal'), 'Enviar por WhatsApp');
      await p.waitForFunction(() => true);
      verdad(afuera.includes('https://wa.me/5491123456789?text=Hola%20amigo.'), `no abrió WhatsApp directo: ${afuera}`);
      verdad((await p.textContent('#tarjeta .nota')).startsWith('Ya abrí la app con todo cargado'), 'falta el aviso de que ya se abrió');
      await captura('04-tarjeta-whatsapp');
    });

    await paso('corregir el mensaje actualiza el enlace', async () => {
      await p.fill('#campo-mensaje', 'Hola amigo, ¿cómo andás?');
      igual(await hrefPrincipal(), 'https://wa.me/5491123456789?text=Hola%20amigo%2C%20%C2%BFc%C3%B3mo%20and%C3%A1s%3F');
    });

    await paso('por voz: «llamá a mamá» (micrófono simulado)', async () => {
      await p.evaluate(() => { window.__dictado = 'Llamá a mamá'; });
      await p.click('#mic');
      await p.waitForFunction(() => document.querySelector('.tarjeta-titulo')?.textContent === 'Llamar a Mamá');
      igual(await hrefPrincipal(), 'tel:0294154123456');
      igual(await p.evaluate(() => window.__ultimoIdioma), 'es-AR');
      igual(await p.textContent('.entendi q'), 'Llamá a mamá');
    });

    await paso('si no escucha nada, lo dice en pantalla', async () => {
      await p.evaluate(() => { window.__dictado = ''; });
      await p.click('#mic');
      await p.waitForFunction(() => document.querySelector('#estado').textContent.startsWith('No te escuché'));
    });

    await paso('dos «Juan»: pregunta cuál (sin abrir nada) y usa el elegido', async () => {
      const antes = afuera.length;
      await pedir('mandale un whatsapp a Juan que diga hola');
      igual(await p.locator('.contacto-opcion').count(), 2);
      await p.waitForTimeout(400);
      igual(afuera.length, antes, 'con dudas no debería abrir WhatsApp');
      await captura('05-elegir-contacto');
      await p.click('.contacto-opcion:has-text("Juan Pérez")');
      igual(await p.textContent('.tarjeta-titulo'), 'WhatsApp para Juan Pérez');
      igual(await hrefPrincipal(), 'https://wa.me/5491144445555?text=Hola');
    });

    await paso('si el dictado tarda más de 5 s, queda la tarjeta con el botón', async () => {
      const antes = afuera.length;
      await p.evaluate(() => { window.__dictado = 'Mandale un WhatsApp a Juan Gómez que diga ya salgo'; window.__demora = 5600; });
      await p.click('#mic');
      await p.waitForFunction(() => document.querySelector('.tarjeta-titulo')?.textContent === 'WhatsApp para Juan Gómez' && document.querySelector('#campo-mensaje')?.value === 'Ya salgo', null, { timeout: 15000 });
      await p.waitForTimeout(400);
      igual(afuera.length, antes, 'sin un toque reciente el navegador no deja abrir otra app');
      igual(await p.getAttribute('#tarjeta .boton.principal', 'href'), 'https://wa.me/5491123456789?text=Ya%20salgo');
      await p.evaluate(() => { window.__demora = 0; });
    });

    await paso('se puede apagar en Ajustes («abrir la app directo»)', async () => {
      await p.click('a[href="#/ajustes"]');
      await p.uncheck('#form-ajustes [name=abrirDirecto]');
      await p.click('.marca');
      const antes = afuera.length;
      await pedir('Enviale un WhatsApp a Juan Gómez qué diga. Hola amigo.');
      await p.waitForTimeout(400);
      igual(afuera.length, antes, 'apagado no debería abrir solo');
      await p.click('a[href="#/ajustes"]');
      await p.check('#form-ajustes [name=abrirDirecto]');
      await p.click('.marca');
    });

    await paso('contacto desconocido: agregarlo y seguir con el pedido', async () => {
      await pedir('mandale un whatsapp a Roberto que diga nos vemos');
      verdad((await p.textContent('.elegir-titulo')).includes('No encontré a «Roberto»'), 'no avisó que no lo encontró');
      igual(await hrefPrincipal(), 'https://wa.me/?text=Nos%20vemos');
      await p.click('text=➕ Agregar a «Roberto»');
      igual(await p.inputValue('#form-contacto [name=nombre]'), 'Roberto');
      await p.fill('#form-contacto [name=telefono]', '+54 9 351 555-1234');
      await p.click('#form-contacto button[value=guardar]');
      await p.waitForFunction(() => document.querySelector('.tarjeta-titulo')?.textContent === 'WhatsApp para Roberto');
      igual(await hrefPrincipal(), 'https://wa.me/5493515551234?text=Nos%20vemos');
    });

    await paso('ajustes: casa guardada → «llevame a casa»', async () => {
      await p.click('a[href="#/ajustes"]');
      await p.fill('#form-ajustes [name=casa]', 'Mitre 100, Bariloche');
      await p.press('#form-ajustes [name=casa]', 'Tab');
      await captura('06-ajustes');
      await p.click('.marca');
      await pedir('llevame a casa');
      igual(await p.textContent('.tarjeta-titulo'), 'Cómo llegar a tu casa');
      igual(await hrefPrincipal(), 'https://www.google.com/maps/dir/?api=1&destination=Mitre%20100%2C%20Bariloche&travelmode=driving');
    });

    await paso('mis comandos: crear uno y usarlo', async () => {
      await p.click('a[href="#/ajustes"]');
      await p.fill('#form-comando [name=nombre]', 'Buscar en Mercado Libre');
      await p.fill('#form-comando [name=frases]', 'buscá en meli, mercado libre');
      await p.fill('#form-comando [name=url]', 'https://listado.mercadolibre.com.ar/{texto}');
      await p.click('#form-comando button[type=submit]');
      await p.waitForSelector('#lista-comandos li button');
      await p.click('.marca');
      await pedir('buscá en Meli zapatillas');
      igual(await hrefPrincipal(), 'https://listado.mercadolibre.com.ar/zapatillas');
    });

    await paso('respuestas directas: la hora y alarmas no soportadas', async () => {
      await pedir('¿Qué hora es?');
      verdad(/^Son las \d{1,2}:\d{2}$|^Es la 1:\d{2}$/.test(await p.textContent('.respuesta')), 'no dijo la hora');
      await pedir('poné una alarma a las 7');
      igual(await p.textContent('.tarjeta-titulo'), 'Eso no lo puedo hacer');
      await p.click('#tarjeta button.boton.principal');
      igual(await p.textContent('.tarjeta-titulo'), 'Alarma');
      verdad((await hrefPrincipal()).startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE&text=Alarma'), 'no armó el evento');
      await captura('07-evento');
      const [descarga] = await Promise.all([p.waitForEvent('download'), p.click('text=Agregar al calendario del teléfono')]);
      igual(descarga.suggestedFilename(), 'evento.ics');
      const ics = fs.readFileSync(await descarga.path(), 'utf8');
      verdad(ics.includes('SUMMARY:Alarma') && ics.includes('BEGIN:VALARM'), 'el .ics no tiene el evento');
    });

    await paso('el historial guarda los pedidos y se pueden repetir', async () => {
      await p.click('#tarjeta .cerrar');
      verdad(await p.isVisible('#historial'), 'no se ve el historial');
      const primero = (await p.textContent('#lista-historial li .h-texto')).trim();
      igual(primero, 'poné una alarma a las 7');
      await captura('08-historial');
    });

    await paso('la ayuda abre con «ayuda» y el botón atrás vuelve', async () => {
      await pedir('ayuda').catch(() => {});
      await p.waitForSelector('[data-pantalla="ayuda"]:not([hidden])');
      await captura('09-ayuda');
      await p.goBack();
      await p.waitForSelector('[data-pantalla="inicio"]:not([hidden])');
    });

    await paso('funciona sin internet (service worker)', async () => {
      await p.evaluate(() => navigator.serviceWorker.ready);
      await p.reload();
      await p.waitForSelector('html[data-listo="1"]');
      await contexto.setOffline(true);
      await p.reload();
      await p.waitForSelector('html[data-listo="1"]', { timeout: 5000 });
      await pedir('llamá a Juan Gómez');
      igual(await hrefPrincipal(), 'tel:1123456789'); // se marca tal cual está guardado
      await contexto.setOffline(false);
    });

    await paso('modo oscuro y pantalla chica', async () => {
      if (!CAPTURAS) return;
      const oscuro = await navegador.newContext({ ...devices['iPhone SE'], colorScheme: 'dark', locale: 'es-AR' });
      await oscuro.route(/^https:\/\/fonts\./, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      await oscuro.addInitScript(microfonoFalso);
      const q = await oscuro.newPage();
      await q.goto(BASE);
      await q.waitForSelector('html[data-listo="1"]');
      await q.fill('#entrada', 'Recordame llamar al dentista mañana a las 10');
      await q.press('#entrada', 'Enter');
      await q.waitForSelector('#tarjeta:not([hidden])');
      await q.waitForTimeout(350);
      await q.screenshot({ path: path.join(CAPTURAS, '10-oscuro-iphone-se.png'), fullPage: true });
      const ancho = await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      verdad(ancho, 'hay scroll horizontal en pantalla chica');
      await oscuro.close();
    });

    await paso('sin errores en la consola', async () => {
      igual(errores.length, 0, errores.join('\n'));
    });
  } finally {
    await navegador.close();
    servidor.kill();
  }
  console.log(`\n${pasos - fallas}/${pasos} pasos OK${CAPTURAS ? ` · capturas en ${CAPTURAS}` : ''}`);
  process.exit(fallas ? 1 : 0);
}

if (CAPTURAS) fs.mkdirSync(CAPTURAS, { recursive: true });
main().catch((e) => { console.error(e); process.exit(1); });
void os;
