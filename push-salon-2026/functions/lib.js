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
  const reunion = first && first.type === 'finde' ? 'Reunión del fin de semana' : 'Reunión entre semana';
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

module.exports = {
  PROGRAM_SIMPLE_FIELDS, ROLES_MAP, roleLabel, collectNewlyAssignedIds,
  avisoPreview, selectNewAvisos, notificationForNewAvisos, validateReminder, reminderDocId,
  arParts, addDaysIso, parseHHMM, fmtHHMM, meetingDateFor, assignmentLabels, assignmentsOnDate,
  normalizeReminderPrefs, remindersDue, reminderMessage, sentReminderId, DEFAULT_REMINDER_PREFS
};
