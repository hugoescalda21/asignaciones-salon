/**
 * Pruebas de la lógica pura (lib.js). Se corren con: npm test
 * No necesitan Firebase ni conexión.
 */
const assert = require('assert');
const {
  roleLabel, collectNewlyAssignedIds, avisoPreview,
  selectNewAvisos, notificationForNewAvisos, validateReminder, reminderDocId,
  arParts, parseHHMM, meetingDateFor, assignmentsOnDate, normalizeReminderPrefs,
  remindersDue, reminderMessage, sentReminderId,
  roleAreasFor, disallowedWeekChanges, guardSummary, accessRequestMessage
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

// ---- Recordatorios automáticos ----
const CONG = {
  settings: { weekdaySemana: 4, weekdayFinde: 0, micCount: 2, usherCount: 2, meetingTimeSemana: '19:30', meetingTimeFinde: '10:00' },
  weeks: {
    '2026-09-21': {
      semana: { roles: { mic1: 'p1', sonido: 'p2' }, program: { lectura: 'p1', estudiantes: [{ tema: 'Empiece conversaciones', estudiante: 'p3', ayudante: 'p1' }] } },
      finde: { roles: { usher1: 'p1' }, program: {} }
    }
  }
};
const at = (iso) => new Date(iso);   // las horas de abajo están en UTC (Argentina = UTC-3)

t('arParts: pasa a hora argentina (cruza la medianoche)', () => {
  assert.deepStrictEqual(arParts(at('2026-09-24T02:00:00Z')), { dateIso: '2026-09-23', minutes: 23 * 60 });
});
t('parseHHMM', () => {
  assert.strictEqual(parseHHMM('19:30'), 1170);
  assert.strictEqual(parseHHMM(''), null);
  assert.strictEqual(parseHHMM('25:00'), null);
  assert.strictEqual(parseHHMM(undefined), null);
});
t('meetingDateFor: jueves y domingo (0 = domingo, no se confunde con "sin dato")', () => {
  assert.strictEqual(meetingDateFor('2026-09-21', 'semana', CONG.settings), '2026-09-24');
  assert.strictEqual(meetingDateFor('2026-09-21', 'finde', CONG.settings), '2026-09-27');
});
t('assignmentsOnDate: junta equipo técnico y programa (incluye ayudante)', () => {
  const r = assignmentsOnDate(CONG, 'p1', '2026-09-24');
  assert.strictEqual(r.length, 1);
  assert.deepStrictEqual(r[0].labels, ['Micrófono de pasillo 1', 'Lectura de la Biblia', 'Empiece conversaciones']);
  assert.strictEqual(r[0].timeMin, 1170);
  assert.deepStrictEqual(assignmentsOnDate(CONG, 'p1', '2026-09-25'), []);
});
t('normalizeReminderPrefs: por defecto solo el día anterior', () => {
  assert.deepStrictEqual(normalizeReminderPrefs(undefined), { dayBefore: true, morning: false, hoursBefore: 0 });
  assert.deepStrictEqual(normalizeReminderPrefs({ dayBefore: false, hoursBefore: 9 }), { dayBefore: false, morning: false, hoursBefore: 0 });
});
t('remindersDue: el día anterior a las 20:00, sin configurar nada', () => {
  const due = remindersDue(CONG, { pubId: 'p1' }, at('2026-09-23T23:00:00Z'));
  assert.strictEqual(due.length, 1);
  assert.strictEqual(due[0].kind, 'dayBefore');
  assert.strictEqual(due[0].dateIso, '2026-09-24');
  const m = reminderMessage(due[0]);
  assert.strictEqual(m.title, 'Mañana tenés 3 asignaciones');
  assert.strictEqual(m.body, 'Micrófono de pasillo 1 · Lectura de la Biblia · Empiece conversaciones — jueves 24 a las 19:30');
});
t('remindersDue: fuera de la franja no avisa', () => {
  assert.deepStrictEqual(remindersDue(CONG, { pubId: 'p1' }, at('2026-09-23T23:30:00Z')), []);
  assert.deepStrictEqual(remindersDue(CONG, { pubId: 'p1' }, at('2026-09-23T22:30:00Z')), []);
});
t('remindersDue: el mismo día a la mañana', () => {
  const due = remindersDue(CONG, { pubId: 'p2', reminderPrefs: { dayBefore: false, morning: true } }, at('2026-09-24T11:00:00Z'));
  assert.strictEqual(due.length, 1);
  assert.deepStrictEqual(reminderMessage(due[0]), { title: 'Hoy: Consola de audio', body: 'Reunión entre semana · jueves 24 a las 19:30' });
});
t('remindersDue: 2 horas antes (19:30 -> 17:30)', () => {
  const due = remindersDue(CONG, { pubId: 'p2', reminderPrefs: { hoursBefore: 2 } }, at('2026-09-24T20:30:00Z'));
  assert.strictEqual(due.length, 1);
  assert.deepStrictEqual(reminderMessage(due[0]), { title: 'Hoy a las 19:30: Consola de audio', body: 'Reunión entre semana · en 2 horas' });
});
t('remindersDue: si "horas antes" cae a la misma hora que el de la mañana, manda uno solo', () => {
  const due = remindersDue(CONG, { pubId: 'p1', reminderPrefs: { dayBefore: false, morning: true, hoursBefore: 2 } }, at('2026-09-27T11:00:00Z'));
  assert.strictEqual(due.length, 1);
  assert.strictEqual(due[0].kind, 'hours');
  assert.strictEqual(reminderMessage(due[0]).title, 'Hoy a las 10:00: Acomodador 1');
});
t('remindersDue: sin horario cargado, "horas antes" no hace nada', () => {
  const sinHora = { ...CONG, settings: { ...CONG.settings, meetingTimeSemana: '' } };
  assert.deepStrictEqual(remindersDue(sinHora, { pubId: 'p2', reminderPrefs: { dayBefore: false, hoursBefore: 2 } }, at('2026-09-24T20:30:00Z')), []);
  const due = remindersDue(sinHora, { pubId: 'p2' }, at('2026-09-23T23:00:00Z'));
  assert.strictEqual(reminderMessage(due[0]).body, 'Reunión entre semana · jueves 24');
});
t('remindersDue: si le sacaron la asignación, no avisa', () => {
  assert.deepStrictEqual(remindersDue(CONG, { pubId: 'p9' }, at('2026-09-23T23:00:00Z')), []);
});
t('sentReminderId: estable y distinto por tipo/fecha', () => {
  const a = sentReminderId(TOKEN, 'dayBefore', '2026-09-24');
  assert.match(a, /^[0-9a-f]{40}$/);
  assert.strictEqual(a, sentReminderId(TOKEN, 'dayBefore', '2026-09-24'));
  assert.notStrictEqual(a, sentReminderId(TOKEN, 'morning', '2026-09-24'));
});

// ---- guardRoles: permisos por rol dentro de las semanas ----
const SET = { editorEmails: ['super@x'], tecnicoAdminEmails: ['tec@x', 'doble@x'], acomodadoresAdminEmails: ['aco@x'], asignacionesAdminEmails: ['asig@x', 'doble@x'], viewerEmails: ['ver@x'] };
const W = () => ({ '2026-09-21': { semana: { roles: { sonido: 'a', usher1: 'b', mic1: null }, excluded: [], topic: '', program: { presidente: 'c', estudiantes: [{ tema: 'x', estudiante: 'd' }] } } } });
const mod = (fn) => { const w = W(); fn(w['2026-09-21'].semana, w); return w; };
t('roleAreasFor: super = todo, admins = sus áreas, doble rol = las dos', () => {
  assert.strictEqual(roleAreasFor(SET, 'super@x'), null);
  assert.deepStrictEqual(roleAreasFor(SET, 'tec@x'), ['tecnico']);
  assert.deepStrictEqual(roleAreasFor(SET, 'doble@x'), ['tecnico', 'asignaciones']);
  assert.deepStrictEqual(roleAreasFor(SET, 'ver@x'), []);
  assert.strictEqual(roleAreasFor({ editorEmails: [] }, 'x@x'), null);
});
t('guard: el técnico puede cambiar su puesto y "no disponibles"', () => {
  const after = mod((m) => { m.roles.sonido = 'z'; m.roles.mic1 = 'y'; m.excluded = ['q']; });
  assert.deepStrictEqual(disallowedWeekChanges(W(), after, ['tecnico']), []);
});
t('guard: el técnico no puede tocar el Programa ni los acomodadores', () => {
  const after = mod((m) => { m.program.presidente = 'z'; m.roles.usher1 = 'z'; });
  const d = disallowedWeekChanges(W(), after, ['tecnico']);
  assert.deepStrictEqual(d.map(c => c.path.join('.')).sort(), ['2026-09-21.semana.program.presidente', '2026-09-21.semana.roles.usher1']);
  assert.strictEqual(d.find(c => c.area === 'asignaciones').before, 'c');
});
t('guard: Asignaciones no toca el Equipo técnico; sí las listas del programa', () => {
  const after = mod((m) => { m.program.estudiantes[0].estudiante = 'z'; m.program.lectura = 'k'; m.roles.sonido = 'z'; });
  const d = disallowedWeekChanges(W(), after, ['asignaciones']);
  assert.deepStrictEqual(d.map(c => c.path.join('.')), ['2026-09-21.semana.roles.sonido']);
});
t('guard: semana nueva en blanco no cuenta como cambio', () => {
  const after = W(); after['2026-09-28'] = { semana: { roles: { sonido: null, usher1: null }, excluded: [], topic: '', program: { presidente: null, estudiantes: [{ tema: '', estudiante: null }] } } };
  assert.deepStrictEqual(disallowedWeekChanges(W(), after, ['acomodadores']), []);
  after['2026-09-28'].semana.program.presidente = 'p';
  assert.strictEqual(disallowedWeekChanges(W(), after, ['acomodadores']).length, 1);
});
t('guard: borrar una asignación ajena también se deshace', () => {
  const after = mod((m) => { delete m.program.presidente; });
  const d = disallowedWeekChanges(W(), after, ['tecnico']);
  assert.strictEqual(d.length, 1); assert.strictEqual(d[0].after, undefined); assert.strictEqual(d[0].before, 'c');
});
t('guard: Super Admin puede todo', () => {
  assert.deepStrictEqual(disallowedWeekChanges(W(), mod((m) => { m.program.presidente = 'z'; }), null), []);
});
t('guard: resumen legible', () => {
  const d = disallowedWeekChanges(W(), mod((m) => { m.program.presidente = 'z'; }), ['tecnico']);
  assert.match(guardSummary('tec@x', d), /tec@x cambió Programa \(semana del 2026-09-21 entre semana\).*Se deshizo/);
});

// ---- aviso de solicitud de acceso ----
t('solicitud: una sola', () => {
  assert.deepStrictEqual(accessRequestMessage('Rebeca Escalda', 1), { title: 'Nueva solicitud de acceso', body: 'Rebeca Escalda quiere entrar a la app. Tocá para aprobarla.' });
});
t('solicitud: varias pendientes se agrupan', () => {
  assert.strictEqual(accessRequestMessage('Lucas', 2).body, 'Lucas y otra persona esperan tu aprobación.');
  assert.strictEqual(accessRequestMessage('Lucas', 4).title, '4 solicitudes de acceso');
  assert.strictEqual(accessRequestMessage('Lucas', 4).body, 'Lucas y 3 personas más esperan tu aprobación.');
});

console.log('\n' + passed + ' pruebas OK' + (process.exitCode ? ' — HAY FALLAS' : ''));
