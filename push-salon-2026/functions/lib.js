/**
 * Lógica pura de las funciones en la nube (sin Firebase): se puede probar con
 * `npm test` sin conexión ni credenciales.
 */
const crypto = require('crypto');

const PROGRAM_SIMPLE_FIELDS = [
  'presidente', 'oracionInicial', 'oracionFinal', 'consejeroAux',
  'tesoros', 'perlas', 'lectura', 'lecturaAux',
  'estudioConductor', 'estudioLector',
  'oradorPublico', 'atalayaConductor', 'atalayaLector'
];

const ROLES_MAP = {
  presidente: 'Presidente',
  oracionInicial: 'Oración Inicial',
  oracionFinal: 'Oración Final',
  consejeroAux: 'Consejero Auxiliar',
  tesoros: 'Tesoros de la Biblia',
  perlas: 'Perlas escondidas',
  lectura: 'Lectura de la Biblia',
  lecturaAux: 'Lectura de la Biblia (Aux)',
  estudioConductor: 'Conductor Estudio Bíblico',
  estudioLector: 'Lector Estudio Bíblico',
  oradorPublico: 'Discurso Público',
  atalayaConductor: 'Conductor de La Atalaya',
  atalayaLector: 'Lector de La Atalaya',
  // Equipo técnico — las claves son las que guarda la app (sonido, video,
  // mic1, mic2..., plataforma, usher1..., cronometrista) y los nombres, los
  // que ve la persona en la app.
  sonido: 'Consola de audio',
  video: 'Video y Zoom',
  plataforma: 'Acomodador de plataforma',
  cronometrista: 'Cronometrista',
  estudiante: 'Asignación Estudiantil',
  ayudante: 'Ayudante',
  estudianteAux: 'Asig. Estudiantil (Aux)',
  ayudanteAux: 'Ayudante (Aux)',
  presentador: 'Nuestra Vida Cristiana'
};

// Micrófonos y acomodadores tienen cantidad configurable (mic1, mic2, ...,
// usher1, usher2, ...), así que se arma el nombre a partir del número.
function roleLabel(key) {
  if (ROLES_MAP[key]) return ROLES_MAP[key];
  let m = /^mic(\d+)$/.exec(key);
  if (m) return 'Micrófono de pasillo ' + m[1];
  m = /^usher(\d+)$/.exec(key);
  if (m) return 'Acomodador ' + m[1];
  return 'Asignación';
}

function collectNewlyAssignedIds(beforeWeek, afterWeek, meetingType, monday) {
  const assignmentsByPub = {};
  
  function addAssignment(id, label) {
    if (!id) return;
    if (!assignmentsByPub[id]) assignmentsByPub[id] = [];
    assignmentsByPub[id].push({ label, meetingType, monday });
  }

  const beforeRoles = (beforeWeek && beforeWeek.roles) || {};
  const afterRoles = (afterWeek && afterWeek.roles) || {};
  Object.keys(afterRoles).forEach((roleKey) => {
    const id = afterRoles[roleKey];
    if (id && beforeRoles[roleKey] !== id) {
      addAssignment(id, roleLabel(roleKey));
    }
  });

  const beforeProgram = (beforeWeek && beforeWeek.program) || {};
  const afterProgram = (afterWeek && afterWeek.program) || {};

  PROGRAM_SIMPLE_FIELDS.forEach((field) => {
    const id = afterProgram[field];
    if (id && beforeProgram[field] !== id) {
      addAssignment(id, ROLES_MAP[field] || 'Asignación');
    }
  });

  (afterProgram.estudiantes || []).forEach((student, i) => {
    const beforeStudent = (beforeProgram.estudiantes || [])[i] || {};
    ['estudiante', 'ayudante', 'estudianteAux', 'ayudanteAux'].forEach((sub) => {
      const id = student[sub];
      if (id && beforeStudent[sub] !== id) {
        addAssignment(id, ROLES_MAP[sub] || 'Asignación');
      }
    });
  });

  (afterProgram.vidaCristiana || []).forEach((entry, i) => {
    const beforeEntry = (beforeProgram.vidaCristiana || [])[i] || {};
    const id = entry.presentador;
    if (id && beforeEntry.presentador !== id) {
      addAssignment(id, ROLES_MAP.presentador || 'Nuestra Vida Cristiana');
    }
  });

  return assignmentsByPub;
}

function avisoPreview(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

// Anuncios nuevos de un guardado: los que no estaban antes, con "Avisar por
// notificación" marcado y que todavía no vencieron.
function selectNewAvisos(before, after, nowMs) {
  const beforeIds = new Set(((before && before.anuncios) || []).map((a) => a && a.id));
  return ((after && after.anuncios) || []).filter((a) =>
    a && a.id && !beforeIds.has(a.id) && a.notify === true &&
    !(a.expiresIso && new Date(a.expiresIso).getTime() < nowMs));
}

// Compone el título y cuerpo de la notificación push de anuncios nuevos. Si el
// anuncio tiene título (campo opcional), se usa como título de la notificación.
function notificationForNewAvisos(nuevos) {
  const first = nuevos[0];
  if (nuevos.length === 1) {
    const title = first.title
      ? '📢 ' + first.title
      : '📢 Nuevo anuncio' + (first.attachmentUrl ? ' · 📎 con archivo adjunto' : '');
    const body = avisoPreview(first.text, 90) || 'Toca para ver el archivo adjunto.';
    return { title, body };
  }
  return {
    title: `📢 ${nuevos.length} nuevos anuncios`,
    body: avisoPreview(first.text, 90) || 'Toca para verlos.'
  };
}

// Recordatorios ("Recordar 1 / 3 días antes"): valida lo que manda el celular.
const REMINDER_DAYS = { 'remind-1d': 1, 'remind-3d': 3 };
function validateReminder(action, payload, now) {
  const daysBefore = REMINDER_DAYS[action];
  if (!daysBefore) return { ok: false, error: 'Acción no válida' };
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Datos no válidos' };
  const { token, code, pubId, meetingDateIso } = payload;
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return { ok: false, error: 'Token no válido' };
  if (typeof code !== 'string' || !/^[A-Z0-9]{3,40}$/.test(code)) return { ok: false, error: 'Código no válido' };
  if (typeof pubId !== 'string' || !pubId || pubId.length > 100) return { ok: false, error: 'Publicador no válido' };
  const meeting = typeof meetingDateIso === 'string' ? new Date(meetingDateIso) : null;
  if (!meeting || isNaN(meeting.getTime())) return { ok: false, error: 'Fecha no válida' };
  const diffDays = (meeting.getTime() - now.getTime()) / 86400000;
  if (diffDays < -1 || diffDays > 120) return { ok: false, error: 'Fecha fuera de rango' };
  const remindAt = new Date(meeting.getTime());
  remindAt.setUTCDate(remindAt.getUTCDate() - daysBefore);
  remindAt.setUTCHours(8, 0, 0, 0);
  return { ok: true, value: { token, code, pubId, meetingDateIso: meeting.toISOString(), daysBefore, remindAtIso: remindAt.toISOString() } };
}
// Mismo recordatorio (celular + reunión + anticipación) = mismo documento: repetir el toque no duplica.
function reminderDocId(token, meetingDateIso, daysBefore) {
  return crypto.createHash('sha256').update([token, meetingDateIso, daysBefore].join('|')).digest('hex').slice(0, 40);
}

// ---------------------------------------------------------------------------
// Recordatorios automáticos (el día anterior / a la mañana / unas horas antes)
// ---------------------------------------------------------------------------
// Argentina no usa horario de verano: UTC-3 fijo.
const AR_OFFSET_MIN = -180;
const DAY_BEFORE_AT = 20 * 60;   // 20:00
const MORNING_AT = 8 * 60;       // 08:00
const DEFAULT_REMINDER_PREFS = { dayBefore: true, morning: false, hoursBefore: 0 };
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Fecha (AAAA-MM-DD) y minutos desde la medianoche, en hora argentina.
function arParts(date) {
  const t = new Date(date.getTime() + AR_OFFSET_MIN * 60000);
  return { dateIso: t.toISOString().slice(0, 10), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() };
}
function addDaysIso(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// "19:30" -> 1170. Cualquier otra cosa -> null.
function parseHHMM(v) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(v || ''));
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}
function fmtHHMM(min) { return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }

// Mismo cálculo que ver.html (dateForType): lunes de la semana + día configurado.
function meetingDateFor(monday, type, settings) {
  const s = settings || {};
  const dow = type === 'semana' ? (s.weekdaySemana != null ? s.weekdaySemana : 4) : (s.weekdayFinde != null ? s.weekdayFinde : 0);
  return addDaysIso(monday, (dow - 1 + 7) % 7);
}
function meetingTimeFor(type, settings) {
  const s = settings || {};
  return parseHHMM(type === 'semana' ? s.meetingTimeSemana : s.meetingTimeFinde);
}

// Qué le toca a un hermano en una reunión (equipo técnico + programa), con los
// mismos nombres que ve en la app.
function assignmentLabels(week, type, settings, pubId) {
  const out = [];
  if (!week || !pubId) return out;
  const s = settings || {};
  const roles = week.roles || {};
  const keys = ['sonido', 'video'];
  for (let i = 1; i <= (s.micCount || 2); i++) keys.push('mic' + i);
  keys.push('plataforma');
  for (let i = 1; i <= (s.usherCount || 2); i++) keys.push('usher' + i);
  if (type !== 'finde') keys.push('cronometrista');
  keys.forEach((k) => { if (roles[k] === pubId) out.push(roleLabel(k)); });

  const p = week.program;
  if (!p) return out;
  const chk = (id, label) => { if (id === pubId) out.push(label); };
  const chkPair = (a, b, label) => { if (a === pubId || b === pubId) out.push(label); };
  chk(p.presidente, 'Presidente');
  chk(p.oracionInicial, 'Oración inicial');
  if (type === 'finde') {
    chk(p.oradorPublico, 'Discurso público');
    chk(p.atalayaConductor, 'Atalaya — Conductor');
    chk(p.atalayaLector, 'Atalaya — Lector');
    chk(p.oracionFinal, 'Oración final');
    return out;
  }
  chk(p.consejeroAux, 'Consejero sala aux.');
  chk(p.tesoros, 'Tesoros de la Biblia');
  chk(p.perlas, 'Perlas escondidas');
  chk(p.lectura, 'Lectura de la Biblia');
  chk(p.lecturaAux, 'Lectura (sala auxiliar)');
  (p.estudiantes || []).forEach((st) => {
    if (!st) return;
    const base = st.tema || 'Seamos mejores maestros';
    chkPair(st.estudiante, st.ayudante, base);
    chkPair(st.estudianteAux, st.ayudanteAux, base + ' (sala aux.)');
  });
  (p.vidaCristiana || []).forEach((v) => { if (v) chk(v.presentador, v.tema || 'Nuestra Vida Cristiana'); });
  chkPair(p.estudioConductor, p.estudioLector, 'Estudio bíblico');
  chk(p.oracionFinal, 'Oración final');
  return out;
}

// Todas las asignaciones de un hermano en una fecha: [{ type, labels, timeMin }]
function assignmentsOnDate(cong, pubId, dateIso) {
  const settings = (cong && cong.settings) || {};
  const weeks = (cong && cong.weeks) || {};
  const out = [];
  ((cong && cong.__salidas) || []).forEach((s) => {
    if (s.pubId === pubId && s.dateIso === dateIso) out.push({ type: 'salida', labels: ['Conducir la salida' + (s.lugarName ? ' (' + s.lugarName + ')' : '')], timeMin: s.timeMin });
  });
  Object.keys(weeks).forEach((monday) => {
    ['semana', 'finde'].forEach((type) => {
      const week = weeks[monday] && weeks[monday][type];
      if (!week || meetingDateFor(monday, type, settings) !== dateIso) return;
      const labels = assignmentLabels(week, type, settings, pubId);
      if (labels.length) out.push({ type, labels, timeMin: meetingTimeFor(type, settings) });
    });
  });
  return out;
}

function normalizeReminderPrefs(p) {
  const src = p && typeof p === 'object' ? p : {};
  const hb = Number(src.hoursBefore);
  return {
    dayBefore: typeof src.dayBefore === 'boolean' ? src.dayBefore : DEFAULT_REMINDER_PREFS.dayBefore,
    morning: typeof src.morning === 'boolean' ? src.morning : DEFAULT_REMINDER_PREFS.morning,
    hoursBefore: [1, 2, 3].includes(hb) ? hb : 0
  };
}

// Qué recordatorios le corresponden a un celular en esta franja de media hora.
// Se calcula siempre con los datos ACTUALES: si le sacaron la asignación, no se avisa.
function remindersDue(cong, sub, slotStart, slotMinutes) {
  const len = slotMinutes || 30;
  const prefs = normalizeReminderPrefs(sub && sub.reminderPrefs);
  const pubId = sub && sub.pubId;
  if (!pubId) return [];
  const { dateIso: today, minutes: now } = arParts(slotStart);
  const inSlot = (m) => m >= now && m < now + len;
  const due = [];

  if (prefs.hoursBefore) {
    assignmentsOnDate(cong, pubId, today).forEach((a) => {
      if (a.timeMin == null) return;
      const target = a.timeMin - prefs.hoursBefore * 60;
      if (target >= 0 && inSlot(target)) due.push({ kind: 'hours', dateIso: today, items: [a], hours: prefs.hoursBefore });
    });
  }
  if (prefs.morning && inSlot(MORNING_AT) && !due.some((d) => d.dateIso === today)) {
    const items = assignmentsOnDate(cong, pubId, today);
    if (items.length) due.push({ kind: 'morning', dateIso: today, items });
  }
  if (prefs.dayBefore && inSlot(DAY_BEFORE_AT)) {
    const tomorrow = addDaysIso(today, 1);
    const items = assignmentsOnDate(cong, pubId, tomorrow);
    if (items.length) due.push({ kind: 'dayBefore', dateIso: tomorrow, items });
  }
  return due;
}

// Texto de la notificación: dice qué asignación es y a qué hora.
function reminderMessage(due) {
  const labels = [];
  due.items.forEach((a) => a.labels.forEach((l) => { if (!labels.includes(l)) labels.push(l); }));
  const first = due.items[0];
  const time = first && first.timeMin != null ? fmtHHMM(first.timeMin) : '';
  const d = new Date(due.dateIso + 'T00:00:00Z');
  const dia = DIAS[d.getUTCDay()] + ' ' + d.getUTCDate();
  const reunion = first && first.type === 'salida' ? 'Salida al servicio' : first && first.type === 'finde' ? 'Reunión del fin de semana' : 'Reunión entre semana';
  const aLas = time ? ' a las ' + time : '';
  const n = labels.length;

  if (due.kind === 'hours') {
    const en = due.hours === 1 ? 'en 1 hora' : `en ${due.hours} horas`;
    return n === 1
      ? { title: `Hoy a las ${time}: ${labels[0]}`, body: `${reunion} · ${en}` }
      : { title: `Hoy a las ${time} tenés ${n} asignaciones`, body: `${labels.join(' · ')} — ${en}` };
  }
  const cuando = due.kind === 'dayBefore' ? 'Mañana' : 'Hoy';
  return n === 1
    ? { title: `${cuando}: ${labels[0]}`, body: `${reunion} · ${dia}${aLas}` }
    : { title: `${cuando} tenés ${n} asignaciones`, body: `${labels.join(' · ')} — ${dia}${aLas}` };
}

// Un mismo aviso (celular + tipo + fecha) se manda una sola vez.
function sentReminderId(token, kind, dateIso) {
  return crypto.createHash('sha256').update(['auto', token, kind, dateIso].join('|')).digest('hex').slice(0, 40);
}

/* ---------- Control de permisos por rol (función guardRoles) ----------
   Las reglas de Firestore no pueden revisar tan adentro del documento: para un Admin
   dejan cambiar "weeks" completo. Esta lógica mira, hoja por hoja, qué cambió dentro de
   las semanas y marca lo que no corresponde al rol de quien guardó, para deshacerlo. */
const ADMIN_FIELDS = { tecnico: 'tecnicoAdminEmails', acomodadores: 'acomodadoresAdminEmails', asignaciones: 'asignacionesAdminEmails' };
// Áreas que puede tocar un email: null = todo (Super Admin); [] = nada dentro de las semanas.
function roleAreasFor(settings, email) {
  const s = settings || {};
  const inList = (f) => Array.isArray(s[f]) && s[f].includes(email);
  if (!email) return [];
  if (inList('editorEmails') || !(s.editorEmails || []).length) return null;
  return Object.keys(ADMIN_FIELDS).filter(r => inList(ADMIN_FIELDS[r]));
}
function isPlainObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && typeof v.toDate !== 'function'; }
function isEmptyDeep(v) {
  if (v === null || v === undefined || v === '' || v === false) return true;
  if (Array.isArray(v)) return v.every(isEmptyDeep);
  if (isPlainObj(v)) return Object.keys(v).every(k => isEmptyDeep(v[k]));
  return false;
}
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (isPlainObj(v)) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
// Hojas de un objeto: { 'a\u0000b': valor }. Las listas son hojas; los objetos vacíos no cuentan.
function leaves(obj, prefix, out) {
  out = out || {};
  Object.keys(obj || {}).forEach((k) => {
    const path = prefix.concat(k);
    const v = obj[k];
    if (isPlainObj(v)) leaves(v, path, out);
    else out[path.join('\u0000')] = { path, v };
  });
  return out;
}
// ¿A qué área pertenece una hoja de weeks? [monday, type, campo, ...]
function weekLeafArea(path) {
  const field = path[2], key = path[3];
  if (field === 'roles') return /^usher/.test(key || '') ? 'acomodadores' : 'tecnico';
  if (field === 'program') return 'asignaciones';
  return null;   // excluded, topic y lo que no es de un área: cualquiera de los Admin
}
// Cambios dentro de "weeks" que no le corresponden a esas áreas.
// Devuelve [{ path, before, after, area }] con path relativo a weeks.
function disallowedWeekChanges(beforeWeeks, afterWeeks, areas) {
  if (areas === null) return [];
  const a = leaves(beforeWeeks || {}, []), b = leaves(afterWeeks || {}, []);
  const keys = new Set(Object.keys(a).concat(Object.keys(b)));
  const out = [];
  keys.forEach((k) => {
    const before = a[k] ? a[k].v : undefined, after = b[k] ? b[k].v : undefined;
    if (canon(before) === canon(after)) return;
    if (isEmptyDeep(before) && isEmptyDeep(after)) return;   // p. ej. una semana nueva, en blanco
    const path = (a[k] || b[k]).path;
    const area = weekLeafArea(path);
    if (area && !areas.includes(area)) out.push({ path, before, after, area });
  });
  return out;
}
const AREA_LABEL = { tecnico: 'Equipo técnico', acomodadores: 'Acomodadores', asignaciones: 'Programa' };
function guardSummary(email, changes) {
  const byMeeting = {};
  changes.forEach((c) => {
    const k = c.path[0] + ' ' + (c.path[1] === 'finde' ? 'fin de semana' : 'entre semana');
    (byMeeting[k] = byMeeting[k] || new Set()).add(AREA_LABEL[c.area] || c.area);
  });
  const partes = Object.keys(byMeeting).sort().map(k => `${[...byMeeting[k]].join(' y ')} (semana del ${k})`);
  return `${email} cambió ${partes.join(', ')}, que no corresponde a su rol. Se deshizo automáticamente.`;
}

// Aviso al Super Admin cuando alguien pide acceso (si hay varios pendientes, se agrupan).
function accessRequestMessage(name, pending) {
  const n = Math.max(1, pending || 1);
  const who = String(name || 'Alguien').trim().slice(0, 60) || 'Alguien';
  if (n === 1) return { title: 'Nueva solicitud de acceso', body: `${who} quiere entrar a la app. Tocá para aprobarla.` };
  return { title: `${n} solicitudes de acceso`, body: `${who} y ${n - 1 === 1 ? 'otra persona esperan' : (n - 1) + ' personas más esperan'} tu aprobación.` };
}

/* ---------- Salidas al servicio (congregations/{código}/salidas/{grupo}) ---------- */
function mondayOfIsoLib(iso) { const d = new Date(iso + 'T12:00:00Z'); const w = d.getUTCDay(); return addDaysIso(iso, w === 0 ? -6 : 1 - w); }
// Las salidas de una semana de un documento de grupo, con los cambios de esa semana.
function salidaInstances(doc, monday) {
  const out = [];
  const sem = ((doc && doc.semanas) || {})[monday] || {};
  const cambios = sem.cambios || {};
  Object.values((doc && doc.plantilla) || {}).forEach((p) => {
    if (!p || !p.id || (p.desde && p.desde > monday)) return;
    const c = cambios[p.id] || {};
    out.push({ id: p.id, dateIso: addDaysIso(monday, (p.dia || 1) - 1), hora: p.hora || '', lugar: p.lugar || '',
      conductor: c.conductor !== undefined ? c.conductor : (p.conductor || null), cancelada: !!c.cancelada });
  });
  Object.values(sem.extra || {}).forEach((x) => {
    if (x && x.id) out.push({ id: x.id, dateIso: addDaysIso(monday, (x.dia || 1) - 1), hora: x.hora || '', lugar: x.lugar || '', conductor: x.conductor || null, cancelada: false });
  });
  return out;
}
// Salidas que conduce cada hermano entre dos fechas: [{ pubId, dateIso, timeMin, lugar }].
function conductorAssignments(salidasDocs, fromIso, toIso) {
  const out = [];
  Object.keys(salidasDocs || {}).forEach((gid) => {
    for (let m = mondayOfIsoLib(fromIso); m <= toIso; m = addDaysIso(m, 7)) {
      salidaInstances(salidasDocs[gid], m).forEach((s) => {
        if (s.conductor && !s.cancelada && s.dateIso >= fromIso && s.dateIso <= toIso) out.push({ pubId: s.conductor, dateIso: s.dateIso, timeMin: parseHHMM(s.hora), lugar: s.lugar, gid, id: s.id });
      });
    }
  });
  return out;
}
// Conductores nuevos en un guardado de salidas (para avisarles): los que antes no estaban en esa salida y fecha.
function newConductors(beforeDoc, afterDoc, todayIso, days) {
  const to = addDaysIso(todayIso, days || 56);
  const key = (a) => `${a.id}|${a.dateIso}|${a.pubId}`;
  const before = new Set(conductorAssignments({ g: beforeDoc || {} }, todayIso, to).map(key));
  const seen = new Set();
  return conductorAssignments({ g: afterDoc || {} }, todayIso, to).filter((a) => {
    if (before.has(key(a))) return false;
    if (seen.has(a.pubId)) return false;   // uno por hermano (el primero que viene)
    seen.add(a.pubId); return true;
  }).sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}
function conductorMessage(first, pubFirstName, lugarName) {
  const d = new Date(first.dateIso + 'T00:00:00Z');
  const dia = DIAS[d.getUTCDay()] + ' ' + d.getUTCDate();
  const hora = first.timeMin != null ? ' · ' + fmtHHMM(first.timeMin) : '';
  return { title: `${pubFirstName ? 'Hola ' + pubFirstName + ', conducís' : 'Conducís'} la salida del ${dia}`, body: `${lugarName || 'Salida al servicio'}${hora}` };
}
// Territorios recién asignados (a un hermano o a un grupo) en un guardado de terr/territorios.
function newTerritoryAssignments(beforeList, afterList) {
  const out = [];
  Object.keys(afterList || {}).forEach((id) => {
    const a = afterList[id] && afterList[id].asignado;
    const b = beforeList && beforeList[id] && beforeList[id].asignado;
    if (!a || !a.id) return;
    if (b && b.id === a.id && b.tipo === a.tipo && b.desde === a.desde) return;
    out.push({ id, num: afterList[id].num, nombre: afterList[id].nombre || '', tipo: a.tipo, to: a.id });
  });
  return out;
}

module.exports = {
  salidaInstances, conductorAssignments, newConductors, conductorMessage, newTerritoryAssignments, mondayOfIsoLib,
  accessRequestMessage,
  roleAreasFor, isEmptyDeep, leaves, weekLeafArea, disallowedWeekChanges, guardSummary,
  PROGRAM_SIMPLE_FIELDS, ROLES_MAP, roleLabel, collectNewlyAssignedIds,
  avisoPreview, selectNewAvisos, notificationForNewAvisos, validateReminder, reminderDocId,
  arParts, addDaysIso, parseHHMM, fmtHHMM, meetingDateFor, assignmentLabels, assignmentsOnDate,
  normalizeReminderPrefs, remindersDue, reminderMessage, sentReminderId, DEFAULT_REMINDER_PREFS
};
