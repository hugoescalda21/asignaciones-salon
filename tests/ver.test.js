/**
 * Pruebas de la vista pública (ver/ver.html)
 * -------------------------------------------
 * Cómo correrlas:  node tests/ver.test.js   (desde la carpeta del proyecto)
 * No necesitan instalar nada: solo Node.js.
 *
 * Qué hacen: sacan del HTML las funciones de la vista pública y las
 * ejecutan con datos de prueba, sin navegador ni Firebase. Revisan:
 * Google Calendar (con y sin horario), los recordatorios, las
 * asignaciones marcadas como "ya agregadas", el calendario desplegable,
 * Inicio (próximas reuniones y anuncio nuevo) y las tarjetas de anuncios.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'ver', 'ver.html'), 'utf8');
const JS = [...HTML.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim()).sort((a, b) => b.length - a.length)[0];

// ---------- Mini corredor de pruebas ----------
let passed = 0, failed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label + (detail !== undefined ? '\n       obtenido: ' + JSON.stringify(detail) : '')); }
}
function section(t) { console.log('\n' + t); }

// ---------- Extraer código del HTML ----------
function fn(name) {
  const i = JS.indexOf('  function ' + name + '(');
  if (i < 0) throw new Error('No se encontró la función ' + name + ' en ver.html');
  return JS.slice(i, JS.indexOf('\n  }\n', i) + 4);
}
function constBlock(name, endTok) {
  const i = JS.indexOf('  const ' + name);
  if (i < 0) throw new Error('No se encontró ' + name + ' en ver.html');
  return JS.slice(i, JS.indexOf(endTok, i) + endTok.length);
}
function oneLine(start) { const i = JS.indexOf(start); return JS.slice(i, JS.indexOf('\n', i) + 1); }
function between(a, b) { const i = JS.indexOf(a); const j = JS.indexOf(b, i); return JS.slice(i, j + b.length); }
const escapeHtml = "  const escapeHtml = s => String(s || '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'})[c]);";

// ---------- DOM falso mínimo ----------
function fakeDom() {
  const els = {};
  const $ = (id) => {
    if (!els[id]) {
      const cls = new Set(['hidden']); const attrs = {}; const listeners = {};
      els[id] = {
        id, innerHTML: '', textContent: '', value: '2', dataset: {},
        classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, f) => (f === undefined ? !cls.has(c) : f) ? cls.add(c) : cls.delete(c) },
        setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: k => attrs[k],
        addEventListener: (ev, f) => { listeners[ev] = f; }, fire: (ev, e) => listeners[ev] && listeners[ev](e || { target: els[id] }),
        focus() {}
      };
    }
    return els[id];
  };
  return $;
}
function fakeStorage() {
  const s = {};
  return { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; }, _s: s };
}
const plain = (x) => JSON.parse(JSON.stringify(x));
const tick = () => new Promise(r => setTimeout(r, 0));
const pad = n => String(n).padStart(2, '0');
const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

(async () => {
  // =====================================================================
  section('1) Google Calendar');
  {
    const ctx = { data: { settings: { meetingTimeSemana: '19:30' } }, URLSearchParams };
    vm.createContext(ctx);
    vm.runInContext([fn('meetingTimeOf'), fn('gcalUrl')].join('\n') + '\nthis.api = { meetingTimeOf, gcalUrl };', ctx);
    const { meetingTimeOf, gcalUrl } = ctx.api;
    check('toma la hora de la reunión entre semana', meetingTimeOf('semana') === '19:30');
    check('sin hora cargada para el fin de semana devuelve vacío', meetingTimeOf('finde') === '');
    const conHora = gcalUrl('Micrófonos', '2026-09-24', 'x', '19:30');
    check('con horario: evento de 19:30 a 21:15', /dates=20260924T193000%2F20260924T211500/.test(conHora), conHora);
    check('con horario: usa la zona de Buenos Aires', /ctz=America%2FArgentina%2FBuenos_Aires/.test(conHora));
    check('una reunión tarde termina al día siguiente', /dates=20260924T230000%2F20260925T004500/.test(gcalUrl('X', '2026-09-24', 'x', '23:00')));
    check('sin horario: evento de todo el día', /dates=20260924%2F20260925/.test(gcalUrl('X', '2026-09-24', 'x', '')));
  }

  // =====================================================================
  section('2) Google Calendar: marcar las ya agregadas');
  {
    const store = fakeStorage(); let clickFn;
    const ctx = { localStorage: store, document: { addEventListener: (ev, f) => { clickFn = f; } } };
    vm.createContext(ctx);
    vm.runInContext(between('  const GCAL_ICON_ADD', '  function gcalUrl(title').replace(/  function gcalUrl\(title$/, '') + '\nthis.api = { gcalKey, loadGcalAdded };', ctx);
    const { gcalKey, loadGcalAdded } = ctx.api;
    const key = gcalKey({ date: '2099-09-24', meetingType: 'semana', label: 'Micrófono de pasillo 1' });
    store.setItem('S', JSON.stringify(['2000-01-01|semana|Vieja']));
    check('las fechas ya pasadas se descartan', loadGcalAdded('S', '2026-09-22').size === 0);
    const attrs = {}; const btn = { dataset: { gkey: key, gstore: 'S' }, classList: { add(c) { btn.cls = c; } }, innerHTML: '', setAttribute: (a, v) => { attrs[a] = v; } };
    clickFn({ target: { closest: () => btn } });
    check('al tocar el botón pasa a "agregado" con ✓', btn.cls === 'added' && /M5 12\.5/.test(btn.innerHTML));
    check('el texto accesible avisa que ya está en el calendario', /Ya está/.test(attrs['aria-label'] || ''));
    check('queda guardado en el celular', loadGcalAdded('S', '2026-09-22').has(key));
    store.getItem = () => { throw new Error('bloqueado'); };
    check('si el navegador bloquea el almacenamiento no se rompe', loadGcalAdded('S', '2026-09-22').size === 0);
  }

  // =====================================================================
  section('3) Recordatorios');
  {
    const $ = fakeDom(); const store = fakeStorage(); const writes = [];
    const switches = ['dayBefore', 'morning', 'hours'].map(k => { const s = $('sw-' + k); s.dataset.pref = k; return s; });
    const ctx = {
      $, localStorage: store, console,
      document: { querySelectorAll: () => switches, addEventListener() {} },
      Notification: { permission: 'granted' }, navigator: { serviceWorker: {} },
      escapeHtml: s => String(s), data: { settings: { meetingTimeSemana: '19:30' } },
      completePushSubscription: async (pub, code) => { writes.push(JSON.parse(store.getItem(`reminder-prefs-${code}-${pub.id}`) || 'null')); return true; }
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(between('  const REMINDER_DEFAULTS', "closeReminderSheet(); });") + '\nthis.api = { renderReminderRow, openReminderSheet, loadReminderPrefs };', ctx);
    const { renderReminderRow, openReminderSheet, loadReminderPrefs } = ctx.api;
    const pub = { id: 'p1' };
    renderReminderRow(pub, 'SALON');
    check('por defecto: aviso el día anterior', /El día anterior/.test($('reminderRow').innerHTML));
    check('con permiso concedido ofrece "Cambiar"', /reminderChangeBtn/.test($('reminderRow').innerHTML));
    openReminderSheet(pub, 'SALON');
    check('la hoja abre con "el día anterior" activado', $('sw-dayBefore').getAttribute('aria-checked') === 'true');
    $('sw-hours').fire('click'); await tick();
    $('sw-morning').fire('click'); await tick();
    check('activar "a la mañana" y "2 horas antes" se guarda', JSON.stringify(plain(loadReminderPrefs('SALON', 'p1'))) === JSON.stringify({ dayBefore: true, morning: true, hoursBefore: 2 }), plain(loadReminderPrefs('SALON', 'p1')));
    check('la preferencia viaja al registro del celular', JSON.stringify(writes[writes.length - 1]) === JSON.stringify({ dayBefore: true, morning: true, hoursBefore: 2 }));
    check('muestra "Guardado ✓"', $('remStatus').textContent === 'Guardado ✓');
    $('remHoursSel').value = '3'; $('remHoursSel').fire('change'); await tick();
    check('cambiar a 3 horas antes', loadReminderPrefs('SALON', 'p1').hoursBefore === 3);
    ctx.data.settings = {}; openReminderSheet(pub, 'SALON');
    check('sin horario cargado se oculta "unas horas antes"', $('remHoursOpt').classList.contains('hidden'));
    ctx.data.settings = { meetingTimeSemana: '19:30' };
    ctx.Notification.permission = 'default'; renderReminderRow(pub, 'SALON');
    check('sin permiso todavía ofrece "Activar"', /reminderEnableBtn/.test($('reminderRow').innerHTML));
    ctx.Notification.permission = 'denied'; renderReminderRow(pub, 'SALON');
    check('con notificaciones bloqueadas explica cómo activarlas', /bloqueadas/.test($('reminderRow').innerHTML));
    ctx.Notification.permission = 'granted'; $('pushPrompt').classList.remove('hidden'); renderReminderRow(pub, 'SALON');
    check('si está el cartel "¿te avisamos?", la fila no se duplica', $('reminderRow').classList.contains('hidden'));
  }

  // =====================================================================
  // Datos de prueba compartidos por Calendario e Inicio
  const pubs = [['p1', 'Hugo Escalda', 'hugo@x.com'], ['p2', 'Martín Ruiz'], ['p3', 'Lucas Gómez'], ['p4', 'Carlos Vega'], ['p5', 'Sofía Abad'], ['p6', 'Laura Paz'], ['p7', 'Ramiro Quinteros'], ['p8', 'Tomás Bravo']].map(([id, name, email]) => ({ id, name, email }));
  const calCode = [escapeHtml, constBlock('ROLE_META', '};'), fn('getRoles'), fn('dateForType'), fn('formatDate'), oneLine('  function monthKey('), oneLine('  function localIso('),
    fn('meetingTimeOf'), fn('visitorName'), fn('programEntries'), constBlock('SECTION_COLOR', '};'), fn('isProgramFilled'), constBlock('calOpenState', ';'),
    fn('calRowHTML'), fn('bindCalAccordion'), fn('renderMonth'), fn('renderUpcoming'),
    constBlock('annState', ';'), fn('annVigentesList'), fn('annItemHtml'), fn('gcalUrl'), fn('annEventHtml'), fn('annLinkify'), fn('annRelDate'), fn('annExpiresLabel'), fn('renderAnnTeaser')].join('\n');
  function calCtx(weeks, anuncios, seenIso) {
    const $ = fakeDom();
    const ctx = { $, console, URLSearchParams, currentUser: { email: 'hugo@x.com' }, getCode: () => 'SALON', annGetSeen: () => seenIso || '2000-01-01T00:00:00Z',
      data: { settings: { weekdaySemana: 4, weekdayFinde: 0, micCount: 2, usherCount: 2, meetingTimeSemana: '19:30', meetingTimeFinde: '10:00' }, publishers: pubs, weeks, anuncios: anuncios || [] },
      currentMonday: '2099-09-21' };
    vm.createContext(ctx);
    vm.runInContext(calCode, ctx);
    return ctx;
  }

  section('4) Calendario: técnico y programa juntos');
  {
    const weeks = {
      '2099-09-14': { semana: { roles: {}, program: { presidente: 'p2' } } },
      '2099-09-21': {
        semana: { topic: 'Tema de prueba', roles: { sonido: 'p2', video: 'p3', mic1: 'p1', mic2: 'p8', plataforma: 'p4' },
          program: { presidente: 'p4', oracionInicial: 'p3', tesoros: 'p2', temaTesoros: 'Sé fiel', lectura: 'p1', estudiantes: [{ tema: 'Empiece conversaciones', estudiante: 'p5', ayudante: 'p6' }], vidaCristiana: [{ tema: 'Necesidades locales', presentador: 'p4' }], estudioConductor: 'p2', estudioLector: 'p1', oracionFinal: 'p8', cancionInicial: '12' } },
        finde: { roles: { usher1: 'p1' }, program: { presidente: 'p2', oradorPublico: 'p7', atalayaConductor: 'p4', atalayaLector: 'p3' } }
      }
    };
    const ctx = calCtx(weeks);
    vm.runInContext('renderMonth();', ctx);
    const html = ctx.$('agendaCard').innerHTML;
    check('una fila por reunión del mes', (html.match(/class="cal-m[ "]/g) || []).length === 3);
    check('la próxima reunión aparece abierta y marcada', /class="cal-m open" data-mkey="2099-09-17\|semana"/.test(html) && /PRÓXIMA/.test(html));
    check('las demás aparecen cerradas', /class="cal-m" data-mkey="2099-09-24\|semana"/.test(html));
    check('muestra la hora de la reunión', /Entre semana · 19:30/.test(html));
    check('equipo técnico: resalta tu puesto', /Micrófono 1<\/span><span class="v">Hugo Escalda ✓/.test(html));
    check('programa: numera las partes', /3\. Lectura de la Biblia/.test(html));
    check('programa: te encuentra también como ayudante o lector', /Estudio bíblico<\/span><span class="v">Martín Ruiz \/ Hugo Escalda ✓/.test(html));
    check('la fila cerrada avisa "Vos: …"', /Vos: Acomodador 1/.test(html));
    check('el fin de semana resume con el discurso', /Discurso: Ramiro Quinteros/.test(html));
    check('sin equipo técnico lo dice', /Equipo técnico no cargado/.test(html));
    // Orador de otra congregación
    const ctxV = calCtx(JSON.parse(JSON.stringify(weeks)));
    ctxV.data.weeks['2099-09-21'].finde.program = { oradorVisitante: { nombre: 'Julio Sosa', congregacion: 'Villa Elvira' }, temaPublico: 'La paz' };
    vm.runInContext('renderMonth();', ctxV);
    const hv = ctxV.$('agendaCard').innerHTML;
    check('orador visitante: aparece en el resumen de la fila', /Discurso: Julio Sosa \(Villa Elvira\)/.test(hv));
    check('orador visitante: aparece en el programa de la reunión', /Discurso público — La paz<\/span><span class="v">Julio Sosa \(Villa Elvira\)/.test(hv));
    // abrir una reunión y re-dibujar: tiene que seguir abierta
    const item = { classList: { t: false, toggle() { this.t = !this.t; return this.t; } }, dataset: { mkey: '2099-09-27|finde' } };
    const head = { closest: () => item, setAttribute() {} };
    ctx.$('agendaCard').fire('click', { target: { closest: s => (s === '.cal-h' ? head : null) } });
    vm.runInContext('renderMonth();', ctx);
    check('lo que abriste queda abierto aunque la app se actualice', /class="cal-m finde open" data-mkey="2099-09-27\|finde"/.test(ctx.$('agendaCard').innerHTML));
  }

  // =====================================================================
  section('5) Inicio y Anuncios');
  {
    const today = new Date();
    const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const ahora = Date.now();
    const iso = ms => new Date(ms).toISOString();
    const weeks = { [isoDay(mon)]: { semana: { roles: { mic1: 'p1' }, program: { presidente: 'p4' } }, finde: { roles: { usher1: 'p1' }, program: { oradorPublico: 'p7' } } } };
    const anuncios = [
      { id: 'a1', pinned: true, title: 'Horario de limpieza', text: 'Cada grupo tiene asignado un sábado.', dateIso: iso(ahora - 7 * 86400000) },
      { id: 'a2', title: 'Limpieza este sábado', text: 'Le toca al grupo 3.', dateIso: iso(ahora - 2 * 3600000), expiresIso: iso(ahora + 4 * 86400000) },
      { id: 'a3', text: 'Carta de la sucursal.', dateIso: iso(ahora - 60 * 86400000), editedIso: 'x', attachmentUrl: 'u', attachmentType: 'pdf', attachmentName: 'carta.pdf' },
      { id: 'a4', text: 'Vencido', dateIso: iso(ahora - 3600000), expiresIso: iso(ahora - 1000) }
    ];
    // Hoy es jueves o domingo según la fecha real: se ajustan los días para que siempre haya una reunión futura.
    const ctx = calCtx(weeks, anuncios, iso(ahora - 86400000));
    ctx.data.settings.weekdaySemana = 6; ctx.data.settings.weekdayFinde = 0;
    vm.runInContext('renderUpcoming(); renderAnnTeaser(); this.cards = data.anuncios.map(annItemHtml).join(""); this.vig = annVigentesList().length;', ctx);
    const up = ctx.$('thisWeek').innerHTML, teaser = ctx.$('annTeaser').innerHTML;
    check('próximas reuniones con las filas desplegables', /class="card cal-card"/.test(up) && /cal-m[^"]* open/.test(up), up.slice(0, 120));
    check('link al calendario completo', /Ver el calendario completo/.test(up));
    check('tarjeta de anuncio nuevo con su título', /Anuncio nuevo/.test(teaser) && /Limpieza este sábado/.test(teaser), teaser);
    check('el anuncio vencido no cuenta', ctx.vig === 3);
    const ctx2 = calCtx(weeks, anuncios, iso(ahora));
    vm.runInContext('renderAnnTeaser();', ctx2);
    check('sin anuncios nuevos muestra el fijado', /Fijado/.test(ctx2.$('annTeaser').innerHTML) && /Horario de limpieza/.test(ctx2.$('annTeaser').innerHTML));
    check('el fijado tiene borde dorado', /announcement-item pinned/.test(ctx.cards));
    // (entre las 0 y las 2 de la mañana, "hace 2 horas" ya es "Ayer")
    check('fecha relativa ("Hace 2 h")', new Date().getHours() < 2 ? /Ayer/.test(ctx.cards) : /Hace 2 h/.test(ctx.cards));
    check('muestra el vencimiento', /Vence el/.test(ctx.cards));
    check('marca "editado"', /editado/.test(ctx.cards));
    check('"Compartir" en cada tarjeta', (ctx.cards.match(/data-ann-share=/g) || []).length === 4);
    {
      const fut = new Date(ahora + 3 * 86400000), pas = new Date(ahora - 3 * 86400000);
      const dstr = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
      ctx.evA = { id: 'e1', title: 'Visita', text: 'Más info: jw.org/es. Escribime a hugo@gmail.com o https://ejemplo.com/a?b=1&c=2', eventDate: dstr(fut), eventTime: '09:00' };
      ctx.evB = { id: 'e2', text: 'x', eventDate: dstr(pas) };
      vm.runInContext('this.cA = annItemHtml(evA); this.cB = annItemHtml(evB);', ctx);
      check('recuadro del evento con día, hora y "Faltan 3 días"', /ann-event/.test(ctx.cA) && /· 9:00/.test(ctx.cA) && /Faltan 3 días/.test(ctx.cA), ctx.cA.slice(0, 300));
      check('botón "+ Calendar" con la fecha y hora del evento', /calendar\.google\.com[^"]*dates=\d{8}T0900/.test(ctx.cA));
      check('evento pasado: "Ya pasó" y sin botón de Calendar', /Ya pasó/.test(ctx.cB) && !/ae-gc/.test(ctx.cB));
      check('links clickeables (jw.org/es sin el punto final)', /<a href="https:\/\/jw\.org\/es"[^>]*>jw\.org\/es<\/a>\./.test(ctx.cA));
      check('link con http y parámetros', /href="https:\/\/ejemplo\.com\/a\?b=1&amp;c=2"/.test(ctx.cA));
      check('los emails no se convierten en link', !/href="https:\/\/gmail\.com"/.test(ctx.cA));
    }
    vm.runInContext(`this.rel = [annRelDate(new Date(Date.now() - 30000)), annRelDate(new Date(Date.now() - 20 * 60000)), annRelDate(new Date(2020, 0, 5))];
      this.exp = [annExpiresLabel(new Date()), annExpiresLabel(new Date(Date.now() + 86400000)), annExpiresLabel(new Date('x'))];`, ctx);
    check('"Recién" y "Hace 20 min"', ctx.rel[0] === 'Recién' && ctx.rel[1] === 'Hace 20 min', plain(ctx.rel));
    check('de otro año muestra el año', /2020/.test(ctx.rel[2]), ctx.rel[2]);
    check('"Vence hoy" / "Vence mañana"', ctx.exp[0] === 'Vence hoy' && ctx.exp[1] === 'Vence mañana', plain(ctx.exp));
    check('una fecha de vencimiento inválida no muestra nada', ctx.exp[2] === '');
  }

  // =====================================================================
  section('6) Bienvenida');
  {
    const ctx = calCtx({
      '2099-09-14': { semana: { roles: {}, program: { presidente: 'p2' } } },
      '2099-09-21': { semana: { roles: { mic2: 'p1' }, program: {} }, finde: { roles: {}, program: { atalayaLector: 'p1' } } },
      '2099-09-28': { semana: { roles: {}, program: { lectura: 'p1' } } }
    });
    Object.assign(ctx, { navigator: { userAgent: 'Android' }, window: { Notification: {}, }, deferredInstallPrompt: null, __inst: true });
    vm.runInContext([fn('programMatches'), fn('welcomeNextAssignment'), fn('welcomeWhen'), fn('welcomeMode'),
      'function isInstalledApp() { return this.__inst; }'].join('\n') + '\nthis.api = { welcomeNextAssignment, welcomeWhen, welcomeMode };', ctx);
    const { welcomeNextAssignment, welcomeWhen, welcomeMode } = ctx.api;
    const n = welcomeNextAssignment(pubs[0]);
    check('toma la primera asignación que viene (técnico o programa)', n && n.date === '2099-09-24' && /Micrófono/.test(n.label), n);
    check('con la hora de la reunión', /19:30$/.test(welcomeWhen(n)), welcomeWhen(n));
    check('sin asignaciones → nada', welcomeNextAssignment(pubs[7]) === null);
    check('sin hermano vinculado → nada', welcomeNextAssignment(null) === null);
    const mode = (o) => {
      ctx.__inst = !!o.inst; ctx.deferredInstallPrompt = o.prompt ? {} : null; ctx.navigator.userAgent = o.ios ? 'iPhone' : 'Android';
      ctx.window = o.noNotif ? {} : { Notification: {} }; ctx.navigator.serviceWorker = {};
      ctx.Notification = { permission: o.perm || 'default' };
      vm.runInContext('this.window.navigator = this.navigator;', ctx);
      return welcomeMode(o.pub === undefined ? pubs[0] : o.pub, o.noInstall);
    };
    check('en el navegador y se puede instalar → ofrece instalar', mode({ prompt: true }) === 'install');
    check('"Seguir en el navegador" → pasa a los avisos', mode({ prompt: true, noInstall: true }) === 'ask');
    check('iPhone sin instalar → explica cómo instalar', mode({ ios: true }) === 'ios');
    check('app instalada, permiso sin pedir → "Activar avisos"', mode({ inst: true }) === 'ask');
    check('permiso ya dado → "ya están activados"', mode({ inst: true, perm: 'granted' }) === 'on');
    check('bloqueados → explica cómo activarlos', mode({ inst: true, perm: 'denied' }) === 'blocked');
    check('email sin vincular → no ofrece avisos', mode({ inst: true, pub: null }) === 'unlinked');
    check('la bienvenida se muestra una sola vez y el aviso de la app instalada espera a que termine', /if \(!welcomeSeen\(code\) \|\| !\$\('welcomeOv'\)/.test(JS) && /if \(welcomeSeen\(code\) \|\| !\$\('welcomeOv'\)/.test(JS));
    check('se puede volver a ver desde el "?"', /id="guideWelcomeBtn"/.test(HTML));
  }

  // =====================================================================
  section('7) Estructura del HTML');
  {
    const ids = [...HTML.matchAll(/id="([A-Za-z0-9_]+)"/g)].map(m => m[1]);
    const dupes = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
    check('no hay ids repetidos', dupes.length === 0, dupes);
    let ok = true; try { new vm.Script(JS); } catch (e) { ok = false; }
    check('el JavaScript no tiene errores de sintaxis', ok);
    check('no quedó el cartel de error técnico en "Compartir"', !/mandale esto a Hugo/.test(HTML));
    const sw = fs.readFileSync(path.resolve(__dirname, '..', 'ver', 'service-worker.js'), 'utf8');
    check('el service worker tiene versión de caché', /CACHE_NAME = 'ver-salon-v\d+'/.test(sw));
  }

  console.log(`\n${passed} pruebas OK, ${failed} fallaron.`);
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error('\nError al correr las pruebas:', e.message); process.exitCode = 1; });
