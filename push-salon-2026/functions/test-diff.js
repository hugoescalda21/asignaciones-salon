/**
 * Pruebas de la lógica pura (lib.js). Se corren con: npm test
 * No necesitan Firebase ni conexión.
 */
const assert = require('assert');
const {
  roleLabel, collectNewlyAssignedIds, avisoPreview,
  selectNewAvisos, notificationForNewAvisos, validateReminder, reminderDocId
} = require('./lib');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FALLA ' + name + '\n     ' + e.message); process.exitCode = 1; }
}

const NOW = new Date('2026-09-21T12:00:00Z');
const TOKEN = 'x'.repeat(30);
const good = { token: TOKEN, code: 'SALON2026', pubId: 'p1', meetingDateIso: '2026-09-24T22:00:00Z' };

// ---- roleLabel ----
t('roleLabel: rol conocido', () => assert.strictEqual(roleLabel('sonido'), 'Consola de audio'));
t('roleLabel: micrófono y acomodador numerados', () => {
  assert.strictEqual(roleLabel('mic3'), 'Micrófono de pasillo 3');
  assert.strictEqual(roleLabel('usher2'), 'Acomodador 2');
});
t('roleLabel: desconocido', () => assert.strictEqual(roleLabel('zzz'), 'Asignación'));

// ---- collectNewlyAssignedIds ----
t('roles: solo avisa al que cambió', () => {
  const r = collectNewlyAssignedIds(
    { roles: { sonido: 'a', video: 'b' } },
    { roles: { sonido: 'a', video: 'c' } }, 'weekend', '2026-09-21');
  assert.deepStrictEqual(Object.keys(r), ['c']);
  assert.strictEqual(r.c[0].label, 'Video y Zoom');
  assert.strictEqual(r.c[0].meetingType, 'weekend');
  assert.strictEqual(r.c[0].monday, '2026-09-21');
});
t('sin cambios: nadie', () => {
  const w = { roles: { sonido: 'a' }, program: { presidente: 'b' } };
  assert.deepStrictEqual(collectNewlyAssignedIds(w, JSON.parse(JSON.stringify(w)), 'midweek', 'm'), {});
});
t('semana nueva (before undefined) avisa a todos, sin romper', () => {
  const r = collectNewlyAssignedIds(undefined, { roles: { sonido: 'a' }, program: { oracionInicial: 'b' } }, 'midweek', 'm');
  assert.deepStrictEqual(Object.keys(r).sort(), ['a', 'b']);
});
t('quitar a alguien no notifica', () => {
  assert.deepStrictEqual(collectNewlyAssignedIds({ roles: { sonido: 'a' } }, { roles: { sonido: '' } }, 'midweek', 'm'), {});
});
t('estudiantes y vida cristiana por posición', () => {
  const r = collectNewlyAssignedIds(
    { program: { estudiantes: [{ estudiante: 'a' }], vidaCristiana: [{ presentador: 'x' }] } },
    { program: { estudiantes: [{ estudiante: 'a', ayudante: 'b' }, { estudiante: 'c' }], vidaCristiana: [{ presentador: 'y' }] } },
    'midweek', 'm');
  assert.deepStrictEqual(Object.keys(r).sort(), ['b', 'c', 'y']);
  assert.strictEqual(r.b[0].label, 'Ayudante');
  assert.strictEqual(r.y[0].label, 'Nuestra Vida Cristiana');
});
t('una persona con varias asignaciones: una entrada con todas', () => {
  const r = collectNewlyAssignedIds({}, { program: { oracionInicial: 'a', lectura: 'a' } }, 'midweek', 'm');
  assert.strictEqual(r.a.length, 2);
});

// ---- avisoPreview ----
t('avisoPreview: colapsa espacios y recorta con …', () => {
  assert.strictEqual(avisoPreview('  hola \n  mundo ', 90), 'hola mundo');
  const p = avisoPreview('a'.repeat(200), 90);
  assert.strictEqual(p.length, 90);
  assert.ok(p.endsWith('…'));
});
t('avisoPreview: vacío/undefined', () => assert.strictEqual(avisoPreview(undefined, 90), ''));

// ---- selectNewAvisos ----
const nowMs = NOW.getTime();
t('selectNewAvisos: solo nuevos con notify', () => {
  const before = { anuncios: [{ id: '1', notify: true }] };
  const after = { anuncios: [{ id: '1', notify: true }, { id: '2', notify: true }, { id: '3', notify: false }, { id: '4' }] };
  assert.deepStrictEqual(selectNewAvisos(before, after, nowMs).map((a) => a.id), ['2']);
});
t('selectNewAvisos: ignora vencidos', () => {
  const after = { anuncios: [{ id: '2', notify: true, expiresIso: '2026-09-01T00:00:00Z' }, { id: '3', notify: true, expiresIso: '2026-12-01T00:00:00Z' }] };
  assert.deepStrictEqual(selectNewAvisos({}, after, nowMs).map((a) => a.id), ['3']);
});
t('selectNewAvisos: sin datos no rompe', () => {
  assert.deepStrictEqual(selectNewAvisos(undefined, undefined, nowMs), []);
  assert.deepStrictEqual(selectNewAvisos({ anuncios: [null] }, { anuncios: [null, { notify: true }] }, nowMs), []);
});

// ---- notificationForNewAvisos ----
t('notificationForNewAvisos: con título usa el título', () => {
  const r = notificationForNewAvisos([{ id: '1', title: 'Limpieza general', text: 'Este sábado a las 9', notify: true }]);
  assert.strictEqual(r.title, '📢 Limpieza general');
  assert.strictEqual(r.body, 'Este sábado a las 9');
});
t('notificationForNewAvisos: sin título, con adjunto', () => {
  const r = notificationForNewAvisos([{ id: '1', text: '', attachmentUrl: 'x', notify: true }]);
  assert.strictEqual(r.title, '📢 Nuevo anuncio · 📎 con archivo adjunto');
  assert.strictEqual(r.body, 'Toca para ver el archivo adjunto.');
});
t('notificationForNewAvisos: sin título, sin adjunto', () => {
  const r = notificationForNewAvisos([{ id: '1', text: 'Hola a todos', notify: true }]);
  assert.strictEqual(r.title, '📢 Nuevo anuncio');
  assert.strictEqual(r.body, 'Hola a todos');
});
t('notificationForNewAvisos: varios, título genérico con cantidad', () => {
  const r = notificationForNewAvisos([{ id: '1', title: 'A', text: 'uno', notify: true }, { id: '2', text: 'dos', notify: true }]);
  assert.strictEqual(r.title, '📢 2 nuevos anuncios');
  assert.strictEqual(r.body, 'uno');
});

// ---- validateReminder ----
t('validateReminder: caso válido 1 día', () => {
  const r = validateReminder('remind-1d', good, NOW);
  assert.ok(r.ok);
  assert.strictEqual(r.value.daysBefore, 1);
  assert.strictEqual(r.value.remindAtIso, '2026-09-23T08:00:00.000Z');
});
t('validateReminder: 3 días', () => {
  assert.strictEqual(validateReminder('remind-3d', good, NOW).value.remindAtIso, '2026-09-21T08:00:00.000Z');
});
[
  ['acción desconocida', 'remind-9d', good],
  ['sin payload', 'remind-1d', null],
  ['token corto', 'remind-1d', { ...good, token: 'abc' }],
  ['token no string', 'remind-1d', { ...good, token: 12345678901234567890 }],
  ['código con minúsculas/símbolos', 'remind-1d', { ...good, code: 'sa lon' }],
  ['pubId vacío', 'remind-1d', { ...good, pubId: '' }],
  ['pubId enorme', 'remind-1d', { ...good, pubId: 'p'.repeat(101) }],
  ['fecha inválida', 'remind-1d', { ...good, meetingDateIso: 'mañana' }],
  ['fecha muy pasada', 'remind-1d', { ...good, meetingDateIso: '2026-01-01T00:00:00Z' }],
  ['fecha muy lejana', 'remind-1d', { ...good, meetingDateIso: '2027-09-01T00:00:00Z' }]
].forEach(([name, action, payload]) => t('validateReminder rechaza: ' + name, () => {
  assert.strictEqual(validateReminder(action, payload, NOW).ok, false);
}));

// ---- reminderDocId ----
t('reminderDocId: estable, 40 hex y distinto si cambia algo', () => {
  const a = reminderDocId(TOKEN, '2026-09-24T22:00:00.000Z', 1);
  assert.match(a, /^[0-9a-f]{40}$/);
  assert.strictEqual(a, reminderDocId(TOKEN, '2026-09-24T22:00:00.000Z', 1));
  assert.notStrictEqual(a, reminderDocId(TOKEN, '2026-09-24T22:00:00.000Z', 3));
  assert.notStrictEqual(a, reminderDocId(TOKEN + 'y', '2026-09-24T22:00:00.000Z', 1));
});

console.log('\n' + passed + ' pruebas OK' + (process.exitCode ? ' — HAY FALLAS' : ''));
