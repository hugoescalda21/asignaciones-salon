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

module.exports = {
  PROGRAM_SIMPLE_FIELDS, ROLES_MAP, roleLabel, collectNewlyAssignedIds,
  avisoPreview, selectNewAvisos, notificationForNewAvisos, validateReminder, reminderDocId
};
