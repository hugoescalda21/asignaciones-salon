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
  roleAreasFor, disallowedWeekChanges, guardSummary, accessRequestMessage,
  salidaInstances, conductorAssignments, newConductors, conductorMessage, newTerritoryAssignments
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

// ---- salidas y territorios ----
const SAL = { plantilla: { s1: { id: 's1', dia: 2, hora: '09:30', lugar: 'L1', conductor: null, desde: '2026-09-21' }, s2: { id: 's2', dia: 6, hora: '18:00', lugar: 'L2', conductor: 'p4' } },
  semanas: { '2026-09-21': { cambios: { s1: { conductor: 'p1' } } }, '2026-09-28': { cambios: { s2: { cancelada: true } }, extra: { x1: { id: 'x1', dia: 4, hora: '17:00', lugar: 'L1', conductor: 'p9' } } } } };
t('salidas: la semana con sus cambios', () => {
  const w = salidaInstances(SAL, '2026-09-21');
  assert.deepStrictEqual(w.map(s => [s.id, s.dateIso, s.conductor]), [['s1', '2026-09-22', 'p1'], ['s2', '2026-09-26', 'p4']]);
  const w2 = salidaInstances(SAL, '2026-09-28');
  assert.ok(w2.find(s => s.id === 's2').cancelada);
  assert.strictEqual(w2.find(s => s.id === 'x1').dateIso, '2026-10-01');
  assert.strictEqual(w2.find(s => s.id === 's1').conductor, null);
});
t('salidas: no aparecen antes de "desde"', () => {
  assert.ok(!salidaInstances(SAL, '2026-09-14').some(s => s.id === 's1'));
});
t('conductores entre fechas (sin las suspendidas)', () => {
  const a = conductorAssignments({ g: SAL }, '2026-09-22', '2026-10-04');
  assert.deepStrictEqual(a.map(x => [x.pubId, x.dateIso]).sort(), [['p1', '2026-09-22'], ['p4', '2026-09-26'], ['p9', '2026-10-01']]);
  assert.strictEqual(a.find(x => x.pubId === 'p1').timeMin, 9 * 60 + 30);
});
t('conductor nuevo: avisa solo al que cambió, uno por hermano', () => {
  const after = JSON.parse(JSON.stringify(SAL)); after.semanas['2026-09-28'].cambios.s1 = { conductor: 'p7' };
  const n = newConductors(SAL, after, '2026-09-23', 56);
  assert.deepStrictEqual(n.map(x => [x.pubId, x.dateIso]), [['p7', '2026-09-29']]);
  assert.deepStrictEqual(newConductors(SAL, SAL, '2026-09-23', 56), []);
  const fijo = JSON.parse(JSON.stringify(SAL)); fijo.plantilla.s2.conductor = 'p5';
  assert.strictEqual(newConductors(SAL, fijo, '2026-09-23', 56).filter(x => x.pubId === 'p5').length, 1);
});
t('mensaje del conductor', () => {
  const m = conductorMessage({ dateIso: '2026-09-29', timeMin: 570 }, 'Martín', 'Casa de la familia Gómez');
  assert.strictEqual(m.title, 'Hola Martín, conducís la salida del martes 29');
  assert.strictEqual(m.body, 'Casa de la familia Gómez · 09:30');
});
t('recordatorio de salida: entra en los recordatorios del día', () => {
  const cong = { settings: {}, weeks: {}, __salidas: [{ pubId: 'p1', dateIso: '2026-09-24', timeMin: 570, lugarName: 'Salón' }] };
  const due = remindersDue(cong, { pubId: 'p1', reminderPrefs: { dayBefore: true } }, new Date('2026-09-23T23:00:00Z'));
  assert.strictEqual(due.length, 1);
  const msg = reminderMessage(due[0]);
  assert.match(msg.title, /Mañana: Conducir la salida \(Salón\)/);
  assert.match(msg.body, /Salida al servicio · jueves 24 a las 09:30/);
});
t('territorio asignado: detecta hermano y grupo nuevos', () => {
  const before = { a: { num: '12', asignado: null }, b: { num: '4', asignado: { tipo: 'grupo', id: 'g1', desde: '2026-09-01' } } };
  const after = { a: { num: '12', nombre: 'Centro', asignado: { tipo: 'hermano', id: 'p6', desde: '2026-09-23' } }, b: before.b };
  assert.deepStrictEqual(newTerritoryAssignments(before, after), [{ id: 'a', num: '12', nombre: 'Centro', tipo: 'hermano', to: 'p6' }]);
});

const { backupName, parseBackupName, buildBackup, backupsToPrune, restorePlan, isRestoreWrite } = require('./lib');
t('copias: nombre con fecha y hora de Argentina, y se puede leer', () => {
  const n = backupName('SALON2026', new Date('2026-09-27T06:30:00Z'), 'auto');
  assert.strictEqual(n, 'backups/SALON2026/2026-09-27_0330-auto.json');
  assert.deepStrictEqual(parseBackupName(n), { file: '2026-09-27_0330-auto.json', dateIso: '2026-09-27', time: '03:30', kind: 'auto', label: 'Automática' });
  assert.strictEqual(parseBackupName('backups/X/otra-cosa.json'), null);
});
t('copias: incluye la congregación, territorios, salidas y avisos de terminado', () => {
  const b = buildBackup('C', { publishers: [1] }, { terr: { territorios: { lista: {} } }, salidas: { g1: {} } }, new Date('2026-09-27T06:30:00Z'));
  assert.deepStrictEqual(Object.keys(b).sort(), ['app', 'code', 'createdAt', 'main', 'salidas', 'salon', 'salonAnotados', 'salonFichas', 'terminados', 'terr', 'version'].sort());
  assert.deepStrictEqual(b.terminados, {});
});
t('copias: se guardan 8 semanas y una por mes hasta un año', () => {
  const names = ['2026-09-27_0330-auto', '2026-08-09_0330-auto', '2026-07-26_0330-auto', '2026-07-05_0330-auto', '2026-07-12_0330-auto', '2026-06-14_1200-manual', '2025-08-03_0330-auto', '2026-03-01_0330-auto']
    .map(x => 'backups/C/' + x + '.json');
  const del = backupsToPrune(names, '2026-09-28').map(n => n.split('/').pop());
  assert.deepStrictEqual(del.sort(), ['2025-08-03_0330-auto.json', '2026-06-14_1200-manual.json', '2026-07-12_0330-auto.json', '2026-07-26_0330-auto.json'].sort());
});
t('restaurar: programa mantiene a quien restaura como Super Admin; territorios borra lo que no estaba', () => {
  const b = { main: { settings: { editorEmails: ['otro@x.com'] }, _guard: { at: 'x' }, weeks: {} }, terr: { territorios: { lista: { a: 1 } } }, salidas: { g1: { plantilla: {} } }, terminados: {} };
  const p = restorePlan(b, ['programa', 'territorios'], { terr: ['territorios', 'grupos'], salidas: ['g1', 'g2'], terminados: ['t9'] }, 'hugo@x.com', 'AHORA');
  assert.deepStrictEqual(p.main.settings.editorEmails, ['otro@x.com', 'hugo@x.com']);
  assert.strictEqual(p.main._guard, undefined); assert.strictEqual(p.main._restoredAt, 'AHORA');
  assert.deepStrictEqual(p.docs.map(d => [d.col, d.id, d.data ? 'set' : 'del']), [['terr', 'territorios', 'set'], ['terr', 'grupos', 'del'], ['salidas', 'g1', 'set'], ['salidas', 'g2', 'del'], ['terminados', 't9', 'del']]);
  const solo = restorePlan(b, ['territorios'], {}, 'hugo@x.com', 'AHORA');
  assert.strictEqual(solo.main, null);
  assert.throws(() => restorePlan({}, ['programa'], {}, 'h', 'A'));
});
t('restaurar: no manda avisos de "te asignaron"', () => {
  assert.strictEqual(isRestoreWrite({}, { _restoredAt: 'A' }), true);
  assert.strictEqual(isRestoreWrite({ _restoredAt: 'A' }, { _restoredAt: 'A' }), false);
  assert.strictEqual(isRestoreWrite({}, {}), false);
});

// ---- Salón ----
{
  const fs = require('fs'), path = require('path');
  const L = require('./lib');
  t('salon-core.js: la copia de las funciones es igual a la de la app', () => {
    assert.strictEqual(fs.readFileSync(path.join(__dirname, 'salon-core.js'), 'utf8'), fs.readFileSync(path.join(__dirname, '..', '..', 'salon-core.js'), 'utf8'));
  });
  const trabajos = { w1: { id: 'w1', titulo: 'Pintura', fecha: '2026-09-26', hora: '09:00', resp: 'p1', aux: 'p2', cupo: 2 },
    w2: { id: 'w2', titulo: 'Pasto', fecha: '2026-09-24', hora: '08:00', resp: 'p3', aux: 'p4', repite: '15d' } };
  const anotados = { 'w1__2026-09-26__u': { tid: 'w1', fecha: '2026-09-26', pubId: 'p5', nombre: 'Juan Paz', uid: 'u' } };
  const cong = { settings: { weekdaySemana: 4, weekdayFinde: 0 }, publishers: ['p1', 'p2', 'p3', 'p5', 'p6'].map(id => ({ id, name: id })) };
  const lz = { rotacion: ['g1'], inicio: '2026-09-21' };
  const grupos = { g1: { id: 'g1', miembros: ['p6'] } };
  t('salón: recordatorios de responsable, auxiliar, voluntario y limpieza', () => {
    const a = L.salonAssignments(cong, trabajos, anotados, lz, grupos, '2026-09-24', '2026-09-27');
    const k = a.map(x => `${x.pubId}|${x.dateIso}`).sort();
    assert.deepStrictEqual(k, ['p1|2026-09-26', 'p2|2026-09-26', 'p3|2026-09-24', 'p5|2026-09-26', 'p6|2026-09-24', 'p6|2026-09-27']);
    assert.ok(a.find(x => x.pubId === 'p5').label.includes('voluntario'));
  });
  t('salón: el recordatorio de la víspera dice "Salón del Reino"', () => {
    const c2 = Object.assign({}, cong, { __salon: L.salonAssignments(cong, trabajos, anotados, lz, grupos, '2026-09-26', '2026-09-26') });
    const items = L.assignmentsOnDate(c2, 'p5', '2026-09-26');
    const m = L.reminderMessage({ kind: 'dayBefore', dateIso: '2026-09-26', items });
    assert.ok(/Mañana/.test(m.title) && /Pintura/.test(m.title) && /Salón del Reino/.test(m.body) && /09:00/.test(m.body), JSON.stringify(m));
  });
  t('salón: aviso a quien asignan como responsable, auxiliar o voluntario', () => {
    const before = { w1: Object.assign({}, trabajos.w1, { aux: 'p9' }) };
    const after = { w1: Object.assign({}, trabajos.w1, { ocurr: { '2026-09-26': { vols: ['p7'] } } }) };
    const n = L.newSalonAssignments(before, after, '2026-09-23').map(a => a.pubId + ':' + a.rol);
    assert.deepStrictEqual(n, ['p2:auxiliar', 'p7:voluntario']);
    assert.ok(/sos el auxiliar/.test(L.salonAssignMessage({ rol: 'auxiliar', t: trabajos.w1, fecha: '2026-09-26' }, 'Mario').title));
  });
  t('cronograma: sin día no se avisa; al ponerle el día, sí', () => {
    const base = { id: 'm1', titulo: 'Pintura del frente', fecha: '2026-10-01', soloMes: true, resp: 'p2', aux: 'p3', repite: 'no' };
    assert.deepStrictEqual(L.newSalonAssignments({}, { m1: base }, '2026-09-23'), []);
    const conDia = Object.assign({}, base, { fecha: '2026-10-17' }); delete conDia.soloMes;
    assert.deepStrictEqual(L.newSalonAssignments({ m1: base }, { m1: conDia }, '2026-09-23').map(a => a.pubId + ':' + a.rol + ':' + a.fecha), ['p2:responsable:2026-10-17', 'p3:auxiliar:2026-10-17']);
    assert.deepStrictEqual(L.salonAssignments({ publishers: [{ id: 'p2' }] }, { m1: base }, {}, null, {}, '2026-09-01', '2026-12-31'), []);
    const pend = { id: 'q1', titulo: 'Canilla', sinFecha: true, repite: 'no' };
    assert.deepStrictEqual(L.newSalonAssignments({}, { q1: Object.assign({}, pend, { resp: 'p2' }) }, '2026-09-23'), [], 'pendiente: nada');
    const prog = { id: 'q1', titulo: 'Canilla', fecha: '2026-10-01', repite: 'no', resp: 'p2' };
    assert.deepStrictEqual(L.newSalonAssignments({ q1: Object.assign({}, pend, { resp: 'p2' }) }, { q1: prog }, '2026-09-23').map(a => a.pubId + ':' + a.rol), ['p2:responsable'], 'al programarlo, se avisa');
  });
  t('cronograma: aviso a todos solo cuando se publica algo que pide voluntarios', () => {
    const w = { id: 'f1', titulo: 'Fumigación', fecha: '2026-10-03', hora: '10:00', resp: 'p2', aux: 'p3', cupo: 2, repite: 'no', vista: false };
    assert.deepStrictEqual(L.newPublished({}, { f1: w }, '2026-09-23'), [], 'nuevo y solo del comité: nada');
    const pub = Object.assign({}, w, { ocurr: { '2026-10-03': { pub: true } } });
    const r = L.newPublished({ f1: w }, { f1: pub }, '2026-09-23');
    assert.deepStrictEqual(r.map(x => x.t.id + ':' + x.fecha), ['f1:2026-10-03']);
    assert.ok(/Se buscan voluntarios/.test(L.publishedMessage(r[0]).title) && /Fumigación · sábado 3 a las 10:00/.test(L.publishedMessage(r[0]).body), JSON.stringify(L.publishedMessage(r[0])));
    assert.deepStrictEqual(L.newPublished({ f1: pub }, { f1: Object.assign({}, pub, { notas: 'x' }) }, '2026-09-23'), [], 'ya estaba publicado: nada');
    assert.deepStrictEqual(L.newPublished({}, { f1: Object.assign({}, w, { cupo: 0, vista: true }) }, '2026-09-23'), [], 'sin voluntarios: nada');
    const pasto = { id: 'p', titulo: 'Pasto', fecha: '2026-09-26', repite: '15d', cupo: 3, vista: true, resp: 'p2', aux: 'p3' };
    assert.deepStrictEqual(L.newPublished({}, { p: pasto }, '2026-09-23').map(x => x.fecha), ['2026-09-26'], 'los que se repiten: un solo aviso');
    assert.deepStrictEqual(L.newPublished({}, { p: Object.assign({}, pasto, { fecha: '2026-11-28' }) }, '2026-09-23'), [], 'más de 30 días: nada');
  });
  t('fichas desde el celular: aviso al comité al empezar y al terminar', () => {
    const t0 = { titulo: 'Limpieza de canaletas', tareas: ['TECHOS', 'Revise el techo', 'Limpie la basura', 'ALEROS', 'Revise aleros'] };
    const f1 = { tid: 'w1', fecha: '2026-10-17', tareas: { 1: true }, estado: 'curso', nombre: 'Carlos Vega', pubId: 'p3' };
    assert.strictEqual(L.fichaCambio(null, f1), 'empezo');
    assert.strictEqual(L.fichaCambio(f1, Object.assign({}, f1, { tareas: { 1: true, 2: true } })), null, 'tildar más no avisa');
    const f2 = Object.assign({}, f1, { tareas: { 1: true, 2: true, 4: true }, estado: 'hecho', nota: 'Falta sellar la bajada' });
    assert.strictEqual(L.fichaCambio(f1, f2), 'termino');
    assert.strictEqual(L.fichaCambio(f2, f2), null);
    assert.deepStrictEqual(L.fichaMessage('empezo', f1, t0), { title: 'Carlos Vega empezó «Limpieza de canaletas»', body: 'Ya tildó 1 de 3 tareas' });
    assert.deepStrictEqual(L.fichaMessage('termino', f2, t0), { title: 'Carlos Vega terminó «Limpieza de canaletas»', body: '3 de 3 tareas · "Falta sellar la bajada"' });
    const cong = { settings: { editorEmails: ['hugo@x.com'], salonAdminEmails: ['MANT@x.com'] }, publishers: [{ id: 'p0', email: 'hugo@x.com' }, { id: 'p3', email: 'mant@x.com' }, { id: 'p5', email: 'otro@x.com' }] };
    assert.deepStrictEqual(L.comiteIds(cong, 'p3'), ['p0']);
  });
  t('salón: aviso al responsable cuando alguien se suma o se baja', () => {
    const r = anotados['w1__2026-09-26__u'];
    assert.deepStrictEqual(L.anotadoMessage(Object.assign({ comentario: 'Llevo la escalera' }, r), trabajos.w1, true, 1, 2), { title: 'Juan Paz se sumó a Pintura', body: 'sábado 26 · van 1 de 2 · "Llevo la escalera"' });
    assert.ok(/ya no va a Pintura/.test(L.anotadoMessage(r, trabajos.w1, false, 0, 2).title));
  });
  t('salón: dos limpiezas cargadas a mano, la general con el mismo grupo', () => {
    const lz2 = { tipos: [{ id: 'reu', nombre: 'Después de las reuniones', modo: 'reunion' }, { id: 'gen', nombre: 'Limpieza general', modo: 'semana', dia: 6, hora: '09:00', mismoGrupo: true }], semanas: { '2026-09-21': { g: 'g1', d: { gen: ['2026-09-25'] } } } };
    const a = L.salonAssignments(cong, {}, {}, lz2, grupos, '2026-09-21', '2026-09-27').filter(x => x.pubId === 'p6');
    assert.deepStrictEqual(a.map(x => x.dateIso + ' ' + x.label), ['2026-09-24 Limpieza: después de las reuniones (tu grupo)', '2026-09-25 Limpieza general (tu grupo)', '2026-09-27 Limpieza: después de las reuniones (tu grupo)']);
    assert.strictEqual(a[1].timeMin, 9 * 60); assert.strictEqual(a[0].timeMin, null);
  });
  t('resumen semanal: puestos sin asignar, solicitudes, limpieza', () => {
    const c = { settings: { weekdaySemana: 4, weekdayFinde: 0, micCount: 2, usherCount: 2 }, weeks: { '2026-09-21': { semana: { roles: { sonido: 'a', video: 'b', mic1: 'c', mic2: 'd', plataforma: 'e', usher1: 'f', cronometrista: 'g' } }, finde: { roles: { sonido: 'a' } } } } };
    const m = L.resumenSemanal(c, '2026-09-21', { solicitudes: 2, limpia: 'Grupo 3' });
    assert.strictEqual(m.title, 'Esta semana: hay 2 cosas para resolver');
    assert.strictEqual(m.body, '7 puestos sin asignar (jue 24 y dom 27) · 2 solicitudes de acceso — Limpia: Grupo 3.');
    const lleno = { settings: c.settings, weeks: {} };
    assert.strictEqual(L.resumenSemanal(lleno, '2026-09-21', {}), null);
    assert.strictEqual(L.resumenSemanal(lleno, '2026-09-21', { limpia: 'Grupo 1' }).title, 'Esta semana está todo al día');
  });
  t('restaurar: el Salón aparte, y las copias viejas no lo tocan', () => {
    const b = { main: {}, salon: { trabajos: { lista: {} } }, salonAnotados: {} };
    const p = L.restorePlan(b, ['salon'], { salon: ['trabajos', 'limpieza'], salonAnotados: ['x'] }, 'h', 'A');
    assert.deepStrictEqual(p.docs.map(d => [d.col, d.id, d.data ? 'set' : 'del']), [['salon', 'trabajos', 'set'], ['salon', 'limpieza', 'del'], ['salonAnotados', 'x', 'del']]);
    assert.strictEqual(L.restorePlan({ main: {} }, ['salon'], { salon: ['trabajos'] }, 'h', 'A').docs.length, 0);
  });
}

{
  // Hermanos de otra congregación: invitación por enlace y voluntarios del salón.
  const L = require('./lib');
  const pubs = [{ id: 'p1', name: 'Carlos Vega', email: 'carlos@x.com', phone: '111' }, { id: 'p2', name: 'Nicolás Paz', email: 'nico@x.com' }, { id: 'p3', name: 'Martín Ruiz', email: 'mr@x.com' }, { id: 'p9', name: 'Otro Hermano', email: 'o@x.com' }];
  const w1 = { id: 'w1', titulo: 'Canaletas', tipo: 'profunda', fecha: '2026-10-10', hora: '08:00', resp: 'p1', aux: 'p2', cupo: 3, repite: 'no', vista: true, materiales: ['Escalera'], tareas: ['Limpiar'], ocurr: { '2026-10-10': { vols: ['p3'], nota: 'interna' } }, externos: { 'x:e9': { nombre: 'Raúl Sur', cong: 'Sur', tel: '999' } } };
  const w2 = { id: 'w2', titulo: 'Driver', tipo: 'reparacion', fecha: '2026-10-14', resp: 'p1', aux: 'p9', cupo: 0, repite: 'no', vista: false };
  const w3 = { id: 'w3', titulo: 'Rejas', tipo: 'profunda', fecha: '2026-10-08', resp: 'p9', aux: 'x:e1', cupo: 0, repite: 'no', vista: false };
  const trabajos = { w1, w2, w3 };
  const externos = { e1: { id: 'e1', nombre: 'Juan Ramírez', cong: 'Norte', tel: '343', email: 'Juan.Ramirez@gmail.com', vol: true }, e2: { id: 'e2', nombre: 'Esteban Ríos', cong: 'Norte' } };
  t('otra cong.: el voluntario entra con su email (sin importar mayúsculas), solo si tiene la tilde', () => {
    assert.strictEqual(L.extVoluntario(externos, 'juan.ramirez@gmail.com').id, 'e1');
    assert.strictEqual(L.extVoluntario({ e1: Object.assign({}, externos.e1, { vol: false }) }, 'juan.ramirez@gmail.com'), null);
    assert.strictEqual(L.extVoluntario(externos, ''), null);
    assert.strictEqual(L.extBuscar(externos, 'esteban rios', 'NORTE').id, 'e2');
    assert.strictEqual(L.extBuscar(externos, 'Esteban Ríos', 'Sur'), null);
  });
  t('otra cong.: la invitación sirve hasta el día del trabajo, si sigue publicado', () => {
    const inv = { k: 'K1', tid: 'w1', fecha: '2026-10-10', lugares: 0 };
    assert.strictEqual(L.estadoInvitacion(inv, trabajos, '2026-10-05').estado, 'ok');
    assert.strictEqual(L.estadoInvitacion(inv, trabajos, '2026-10-11').estado, 'vencida');
    assert.strictEqual(L.estadoInvitacion(Object.assign({}, inv, { anulada: true }), trabajos, '2026-10-05').estado, 'anulada');
    assert.strictEqual(L.estadoInvitacion(null, trabajos, '2026-10-05').estado, 'nohay');
    const oculto = { w1: Object.assign({}, w1, { ocurr: { '2026-10-10': { pub: false } } }) };
    assert.strictEqual(L.estadoInvitacion(inv, oculto, '2026-10-05').estado, 'vencida');
    const hecho = { w1: Object.assign({}, w1, { ocurr: { '2026-10-10': { estado: 'hecho' } } }) };
    assert.strictEqual(L.estadoInvitacion(inv, hecho, '2026-10-05').estado, 'vencida');
  });
  t('otra cong.: lugares de la invitación (lo que falta y el tope del comité)', () => {
    const an = { a: { tid: 'w1', fecha: '2026-10-10', pubId: 'x:e2', inv: 'K1' } };
    assert.strictEqual(L.lugaresInvitacion({ k: 'K1', tid: 'w1', fecha: '2026-10-10', lugares: 0 }, w1, an), 1);   // cupo 3: van Ruiz y Ríos
    assert.strictEqual(L.lugaresInvitacion({ k: 'K1', tid: 'w1', fecha: '2026-10-10', lugares: 1 }, w1, an), 0);
    assert.strictEqual(L.lugaresInvitacion({ k: 'K2', tid: 'w1', fecha: '2026-10-10', lugares: 1 }, w1, an), 1);
  });
  t('otra cong.: el voluntario ve los publicados que piden ayuda y los suyos, no los del comité', () => {
    const occ = L.occVoluntario(trabajos, {}, 'e1', '2026-10-05');
    assert.deepStrictEqual(occ.map(o => o.tid + ' ' + o.fecha), ['w3 2026-10-08', 'w1 2026-10-10']);
    assert.deepStrictEqual(L.occVoluntario(trabajos, {}, 'e2', '2026-10-05').map(o => o.tid), ['w1']);
  });
  t('otra cong.: lo que se le manda no trae emails, teléfonos ni notas internas', () => {
    const an = { 'w1__2026-10-10__uidX': { tid: 'w1', fecha: '2026-10-10', pubId: 'p9', nombre: 'Otro Hermano', uid: 'uidX', comentario: 'Voy', at: 'x' }, 'w1__2026-10-10__x-e1': { tid: 'w1', fecha: '2026-10-10', pubId: 'x:e1', nombre: 'Juan Ramírez', uid: 'x-e1', comentario: '', cong: 'Norte', inv: 'K1', bk: 'hash' }, 'w2__2026-10-14__u': { tid: 'w2', fecha: '2026-10-14', pubId: 'p3', uid: 'u' } };
    const fi = { 'w1__2026-10-10': { tid: 'w1', fecha: '2026-10-10', tareas: { 0: true }, mats: {}, nota: 'ok', estado: 'curso', nombre: 'Carlos Vega', email: 'carlos@x.com', pubId: 'p1' } };
    const p = L.proyeccionExterno([{ tid: 'w1', fecha: '2026-10-10' }], trabajos, an, fi, pubs, 'x-e1');
    assert.deepStrictEqual(Object.keys(p.trabajos), ['w1']);
    assert.deepStrictEqual(p.trabajos.w1.ocurr, { '2026-10-10': { vols: ['p3'] } });
    assert.deepStrictEqual(p.trabajos.w1.externos, { 'x:e9': { nombre: 'Raúl Sur', cong: 'Sur' } });
    assert.deepStrictEqual(p.pubs, [{ id: 'p1', name: 'Carlos Vega' }, { id: 'p2', name: 'Nicolás Paz' }, { id: 'p3', name: 'Martín Ruiz' }]);
    const txt = JSON.stringify(p);
    ['@', '999', '111', 'uidX', 'hash', 'interna'].forEach(x => assert.ok(!txt.includes(x), 'no debería incluir ' + x));
    assert.deepStrictEqual(Object.keys(p.anotados).sort(), ['a0', 'w1__2026-10-10__x-e1']);
    assert.strictEqual(p.anotados['w1__2026-10-10__x-e1'].cong, 'Norte');
    assert.deepStrictEqual(Object.keys(p.fichas), ['w1__2026-10-10']);
    assert.strictEqual(p.fichas['w1__2026-10-10'].email, undefined);
  });
  t('otra cong.: datos del invitado (nombre, congregación y teléfono)', () => {
    assert.deepStrictEqual(L.datosInvitado({ nombre: '  Juan   Ramírez ', cong: 'Cong. Norte', tel: '343 555-1234<x>', comentario: '' }), { nombre: 'Juan Ramírez', cong: 'Norte', tel: '343 555-1234', comentario: '' });
    assert.ok(L.datosInvitado({ nombre: 'J', cong: 'Norte' }).error);
    assert.ok(L.datosInvitado({ nombre: 'Juan Ramírez', cong: '' }).error);
    assert.ok(L.datosInvitado({ nombre: '1234', cong: 'Norte' }).error);
  });
  t('otra cong.: el aviso dice de qué congregación es', () => {
    assert.strictEqual(L.anotadoMessage({ nombre: 'Juan Ramírez', cong: 'Norte', fecha: '2026-10-10', comentario: '' }, w1, true, 2, 3).title, 'Juan Ramírez (Cong. Norte) se sumó a Canaletas');
  });
  t('otra cong.: el voluntario del salón también tiene recordatorio de sus trabajos', () => {
    const a = L.salonAssignments({ publishers: pubs }, trabajos, {}, null, {}, '2026-10-08', '2026-10-08', externos).filter(x => x.pubId === 'x:e1');
    assert.deepStrictEqual(a.map(x => x.dateIso + ' ' + x.label), ['2026-10-08 Rejas (auxiliar)']);
    assert.deepStrictEqual(L.salonAssignments({ publishers: pubs }, trabajos, {}, null, {}, '2026-10-08', '2026-10-08', { e2: externos.e2 }).filter(x => x.pubId.startsWith('x:')), []);
  });
}

console.log('\n' + passed + ' pruebas OK' + (process.exitCode ? ' — HAY FALLAS' : ''));
