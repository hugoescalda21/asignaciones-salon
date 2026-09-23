// Datos de prueba compartidos: 16 hermanos y dos semanas (14 y 21 de septiembre de 2026).
const names = ['Hugo Escalda','Martín Ruiz','Lucas Gómez','Carlos Vega','Tomás Bravo','Ramiro Quinteros','Diego Fernández','Raúl Méndez','Pablo Sosa','Nicolás Paz','Andrés Torres','Mario Díaz','Jorge López','Sofía Abad','Laura Paz','Ariel Núñez'];
const pubs = names.map((n, i) => ({ id: 'p' + i, name: n, notes: '', status: 'activo', email: i === 0 ? 'hugo@x.com' : null,
  roles: { sonido: i % 3 === 0, video: i % 3 === 1, microfono: i < 10, plataforma: i % 4 === 0, acomodador: i > 3, cronometrista: i % 5 === 0 } }));
const data = { settings: { congregationName: 'San Agustín', micCount: 2, usherCount: 2, weekdaySemana: 4, weekdayFinde: 0, timerMuted: false, themeMode: 'light', remindersEnabled: false, useAuxRoom: false, editorEmails: ['hugo@x.com'], viewerEmails: [], tecnicoAdminEmails: [], acomodadoresAdminEmails: [], asignacionesAdminEmails: [], meetingTimeSemana: '19:30', meetingTimeFinde: '10:00' },
  publishers: pubs,
  weeks: { '2026-09-21': { semana: { topic: '', roles: { sonido: 'p0', video: 'p1', mic1: 'p2', mic2: null, plataforma: 'p4', usher1: 'p7', usher2: null, cronometrista: 'p5' },
      program: { presidente: 'p3', oracionInicial: 'p6', tesoros: 'p10', perlas: 'p11', lectura: 'p0', estudiantes: [{ tema: 'Empiece conversaciones', estudiante: 'p13', ayudante: 'p14', minutos: 3 }], vidaCristiana: [{ tema: 'Necesidades locales', presentador: 'p3' }], estudioConductor: 'p1', estudioLector: 'p2', oracionFinal: 'p8' } },
    finde: { roles: { sonido: 'p3', video: 'p4' }, program: { presidente: 'p1', oradorPublico: 'p5' } } },
    '2026-09-14': { semana: { roles: { sonido: 'p3', video: 'p4', mic1: 'p5', mic2: 'p6', plataforma: 'p8', usher1: 'p9', usher2: 'p10', cronometrista: 'p0' }, program: {} }, finde: { roles: {}, program: {} } } } };
module.exports = { data };
