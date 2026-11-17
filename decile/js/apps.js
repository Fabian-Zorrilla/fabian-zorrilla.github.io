// apps.js — Catálogo de apps que Decile sabe abrir.
//
// Para cada app:
//   web     → enlace https (abre la app si está instalada, o la web)
//   ios     → esquema propio del iPhone (whatsapp://, fb://…), si se conoce
//   android → nombre del paquete en Android (para abrir justo esa app)
// Si una app no está acá, se puede agregar desde Ajustes → "Mis comandos".

import { claveNombre } from './contactos.js';
import { similitud } from './texto.js';

export const APPS = [
  { id: 'whatsapp', nombre: 'WhatsApp', claves: ['whatsapp', 'whats app', 'wasap', 'guasap', 'watsap', 'wpp', 'wsp', 'whats'], web: 'https://wa.me/', ios: 'whatsapp://', android: 'com.whatsapp' },
  { id: 'instagram', nombre: 'Instagram', claves: ['instagram', 'insta', 'ig'], web: 'https://www.instagram.com/', ios: 'instagram://app', android: 'com.instagram.android' },
  { id: 'facebook', nombre: 'Facebook', claves: ['facebook', 'face', 'feisbuk', 'fb'], web: 'https://www.facebook.com/', ios: 'fb://', android: 'com.facebook.katana' },
  { id: 'messenger', nombre: 'Messenger', claves: ['messenger', 'mesenger'], web: 'https://www.messenger.com/', ios: 'fb-messenger://', android: 'com.facebook.orca' },
  { id: 'youtube', nombre: 'YouTube', claves: ['youtube', 'you tube', 'yutub', 'yutu'], web: 'https://www.youtube.com/', ios: 'youtube://', android: 'com.google.android.youtube' },
  { id: 'youtubemusic', nombre: 'YouTube Music', claves: ['youtube music', 'yt music'], web: 'https://music.youtube.com/', ios: '', android: 'com.google.android.apps.youtube.music' },
  { id: 'spotify', nombre: 'Spotify', claves: ['spotify', 'spotifai', 'espotifai'], web: 'https://open.spotify.com/', ios: 'spotify:', android: 'com.spotify.music' },
  { id: 'gmail', nombre: 'Gmail', claves: ['gmail', 'correo', 'mail', 'mails', 'email', 'el mail'], web: 'https://mail.google.com/', ios: 'googlegmail://', android: 'com.google.android.gm' },
  { id: 'maps', nombre: 'Google Maps', claves: ['google maps', 'maps', 'mapas', 'mapa', 'el mapa'], web: 'https://www.google.com/maps', ios: 'comgooglemaps://', android: 'com.google.android.apps.maps' },
  { id: 'waze', nombre: 'Waze', claves: ['waze', 'ueis', 'weis', 'wais'], web: 'https://waze.com/ul', ios: 'waze://', android: 'com.waze' },
  { id: 'calendario', nombre: 'Google Calendar', claves: ['calendario', 'calendar', 'google calendar', 'agenda'], web: 'https://calendar.google.com/', ios: 'googlecalendar://', android: 'com.google.android.calendar' },
  { id: 'drive', nombre: 'Google Drive', claves: ['drive', 'google drive'], web: 'https://drive.google.com/', ios: 'googledrive://', android: 'com.google.android.apps.docs' },
  { id: 'fotos', nombre: 'Google Fotos', claves: ['fotos', 'google fotos', 'google photos', 'galeria'], web: 'https://photos.google.com/', ios: 'googlephotos://', android: 'com.google.android.apps.photos' },
  { id: 'chrome', nombre: 'Chrome', claves: ['chrome', 'google chrome', 'navegador', 'google'], web: 'https://www.google.com/', ios: 'googlechrome://', android: 'com.android.chrome' },
  { id: 'keep', nombre: 'Google Keep', claves: ['keep', 'google keep', 'notas'], web: 'https://keep.google.com/', ios: '', android: 'com.google.android.keep' },
  { id: 'traductor', nombre: 'Google Traductor', claves: ['traductor', 'google traductor', 'google translate', 'translate'], web: 'https://translate.google.com/', ios: '', android: 'com.google.android.apps.translate' },
  { id: 'meet', nombre: 'Google Meet', claves: ['meet', 'google meet'], web: 'https://meet.google.com/', ios: '', android: 'com.google.android.apps.tachyon' },
  { id: 'telegram', nombre: 'Telegram', claves: ['telegram', 'telegran'], web: 'https://t.me/', ios: 'tg://', android: 'org.telegram.messenger' },
  { id: 'tiktok', nombre: 'TikTok', claves: ['tiktok', 'tik tok', 'tictoc', 'tic toc'], web: 'https://www.tiktok.com/', ios: 'snssdk1233://', android: 'com.zhiliaoapp.musically' },
  { id: 'x', nombre: 'X (Twitter)', claves: ['twitter', 'tuiter', 'x'], web: 'https://x.com/', ios: 'twitter://', android: 'com.twitter.android' },
  { id: 'linkedin', nombre: 'LinkedIn', claves: ['linkedin', 'linked in', 'linkdin'], web: 'https://www.linkedin.com/', ios: 'linkedin://', android: 'com.linkedin.android' },
  { id: 'netflix', nombre: 'Netflix', claves: ['netflix', 'netflis', 'netflic'], web: 'https://www.netflix.com/', ios: 'nflx://', android: 'com.netflix.mediaclient' },
  { id: 'prime', nombre: 'Prime Video', claves: ['prime video', 'amazon prime', 'prime'], web: 'https://www.primevideo.com/', ios: '', android: 'com.amazon.avod.thirdpartyclient' },
  { id: 'disney', nombre: 'Disney+', claves: ['disney', 'disney plus', 'disney+'], web: 'https://www.disneyplus.com/', ios: '', android: 'com.disney.disneyplus' },
  { id: 'max', nombre: 'Max', claves: ['max', 'hbo', 'hbo max'], web: 'https://www.max.com/', ios: '', android: 'com.wbd.stream' },
  { id: 'mercadolibre', nombre: 'Mercado Libre', claves: ['mercado libre', 'mercadolibre', 'meli'], web: 'https://www.mercadolibre.com.ar/', ios: '', android: 'com.mercadolibre' },
  { id: 'mercadopago', nombre: 'Mercado Pago', claves: ['mercado pago', 'mercadopago'], web: 'https://www.mercadopago.com.ar/', ios: '', android: 'com.mercadopago.wallet' },
  { id: 'uber', nombre: 'Uber', claves: ['uber', 'uver'], web: 'https://m.uber.com/', ios: 'uber://', android: 'com.ubercab' },
  { id: 'cabify', nombre: 'Cabify', claves: ['cabify', 'cabifai'], web: 'https://cabify.com/', ios: '', android: 'com.cabify.rider' },
  { id: 'didi', nombre: 'DiDi', claves: ['didi'], web: 'https://web.didiglobal.com/', ios: '', android: 'com.didiglobal.passenger' },
  { id: 'pedidosya', nombre: 'PedidosYa', claves: ['pedidos ya', 'pedidosya'], web: 'https://www.pedidosya.com.ar/', ios: '', android: 'com.pedidosya' },
  { id: 'rappi', nombre: 'Rappi', claves: ['rappi', 'rapi'], web: 'https://www.rappi.com.ar/', ios: '', android: 'com.grability.rappi' },
  { id: 'zoom', nombre: 'Zoom', claves: ['zoom', 'zum'], web: 'https://zoom.us/', ios: 'zoomus://', android: 'us.zoom.videomeetings' },
  { id: 'teams', nombre: 'Microsoft Teams', claves: ['teams', 'microsoft teams'], web: 'https://teams.microsoft.com/', ios: 'msteams://', android: 'com.microsoft.teams' },
  { id: 'outlook', nombre: 'Outlook', claves: ['outlook', 'hotmail'], web: 'https://outlook.live.com/', ios: 'ms-outlook://', android: 'com.microsoft.office.outlook' },
];

const RELLENO = /\s+(?:por favor|porfa|ahora|ya|de nuevo|otra vez|en el celular|en el telefono)$/;

/** Busca una app por cómo la nombró el usuario. Devuelve la app o null. */
export function buscarApp(nombre) {
  const q = claveNombre(nombre).replace(RELLENO, '').replace(/^(?:la|el|mi)\s+(?:app\s+(?:de\s+)?)?/, '').trim();
  if (!q) return null;
  for (const app of APPS) if (app.claves.includes(q)) return app;
  if (q.length < 4) return null;
  let mejor = null;
  let puntos = 0;
  for (const app of APPS) {
    for (const c of app.claves) {
      if (c.length < 4) continue;
      const s = similitud(q, c);
      if (s > puntos) { puntos = s; mejor = app; }
    }
  }
  return puntos >= 0.8 ? mejor : null;
}

export const appPorId = (id) => APPS.find((a) => a.id === id) || null;
