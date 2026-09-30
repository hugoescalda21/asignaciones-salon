/* =====================================================================
   Salón — lógica compartida (app de asignaciones, vista y funciones)
   ---------------------------------------------------------------------
   El mismo archivo lo usan asignaciones-salon.html (salon.js), la vista
   (ver/salon-ver.js) y las funciones en la nube (una copia idéntica en
   push-salon-2026/functions/salon-core.js; la prueba de las funciones
   avisa si quedaron distintas).

   Datos:
     congregations/{código}/salon/trabajos → { lista: {id: trabajo} }
       trabajo = { id, titulo, tipo, fecha, hora, resp, aux, cupo, repite,
                   materiales: [texto], vista, notas,
                   ocurr: { fecha: { estado, nota, mats: {i: true}, vols: [pubId], cancelada } } }
     congregations/{código}/salon/limpieza → { modo, dia, rotacion: [grupo], inicio, otra: [n], tareas: [texto] }
     congregations/{código}/salonAnotados/{trabajo__fecha__uid}
       → { tid, fecha, pubId, nombre, email, uid, comentario, at }   (lo escribe cada hermano desde la vista)
   ===================================================================== */
(function (root) {
  'use strict';

  const TIPOS = {
    pintura: { icon: '🎨', label: 'Pintura', color: '#DB2777' },
    reparacion: { icon: '🔧', label: 'Reparación', color: '#EA580C' },
    jardin: { icon: '🌿', label: 'Jardín', color: '#16A34A' },
    profunda: { icon: '🧽', label: 'Limpieza profunda', color: '#7C3AED' },
    otro: { icon: '🛠', label: 'Otro trabajo', color: '#0891B2' }
  };
  const REPITE = { no: 'No se repite', '15d': 'Cada 15 días', mes: 'Cada mes', '3m': 'Cada 3 meses' };
  const ESTADOS = { prog: 'Programado', curso: 'En curso', hecho: 'Hecho' };

  function pad(n) { return String(n).padStart(2, '0'); }
  function isoOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function addDays(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d); }
  function mondayOf(iso) { const d = new Date(iso + 'T12:00:00'); const w = d.getDay(); return addDays(iso, w === 0 ? -6 : 1 - w); }
  // El mismo día del mes, n meses después (si el mes es más corto, el último día).
  function addMonths(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(y, m - 1 + n, 1, 12);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(d, last));
    return isoOf(t);
  }

  // Fechas de un trabajo entre dos días (incluidos), según cómo se repite.
  function fechasDe(t, from, to) {
    if (!t || !t.fecha) return [];
    const out = [];
    const rep = t.repite || 'no';
    if (rep === 'no') { if (t.fecha >= from && t.fecha <= to) out.push(t.fecha); return out; }
    for (let i = 0; i < 1000; i++) {
      const f = rep === '15d' ? addDays(t.fecha, 14 * i) : addMonths(t.fecha, (rep === '3m' ? 3 : 1) * i);
      if (f > to) break;
      if (t.hasta && f > t.hasta) break;
      if (f >= from) out.push(f);
    }
    return out;
  }

  // Todos los trabajos (cada vez que toca) entre dos días, en orden. Incluye los suspendidos
  // esa vez (cancelada: true) para que la app los muestre tachados.
  function trabajosEntre(lista, from, to) {
    const out = [];
    Object.values(lista || {}).forEach(t => {
      if (!t || !t.id) return;
      fechasDe(t, from, to).forEach(f => {
        const o = (t.ocurr || {})[f] || {};
        out.push({ t, fecha: f, occ: o, estado: o.estado || 'prog', cancelada: !!o.cancelada });
      });
    });
    return out.sort((a, b) => (a.fecha + (a.t.hora || '')).localeCompare(b.fecha + (b.t.hora || '')));
  }

  const anotadoId = (tid, fecha, uid) => `${tid}__${fecha}__${uid}`;
  // Quiénes van a un trabajo esa vez: los que se anotaron desde la vista y los que agregó el encargado.
  function voluntarios(t, fecha, anotados) {
    const out = [];
    Object.keys(anotados || {}).forEach(id => {
      const a = anotados[id];
      if (a && a.tid === t.id && a.fecha === fecha) out.push({ id, pubId: a.pubId, nombre: a.nombre || '', comentario: a.comentario || '', propio: true, email: a.email || '' });
    });
    (((t.ocurr || {})[fecha] || {}).vols || []).forEach(pid => { if (!out.some(v => v.pubId === pid)) out.push({ id: null, pubId: pid, nombre: '', comentario: '', propio: false }); });
    return out;
  }
  function cupoInfo(t, fecha, anotados) {
    const vols = voluntarios(t, fecha, anotados);
    const cupo = Math.max(0, Number(t.cupo) || 0);
    return { vols, cupo, van: vols.length, faltan: Math.max(0, cupo - vols.length), completo: cupo > 0 && vols.length >= cupo };
  }

  /* ---------- Limpieza por grupos ---------- */
  // Número de semana dentro del mes (1 a 5), contando por el jueves de esa semana.
  function semanaDelMes(monday) {
    const jue = addDays(monday, 3);
    return { n: Math.ceil(Number(jue.slice(8, 10)) / 7), mes: jue.slice(0, 7) };
  }
  function esOtra(cfg, monday) { return (cfg.otra || []).includes(semanaDelMes(monday).n); }
  // A quién le toca limpiar la semana que empieza ese lunes: { gid } o { otra: true } o null.
  // La rotación avanza solo en las semanas que limpia la congregación.
  function turnoLimpieza(cfg, monday) {
    if (!cfg || !(cfg.rotacion || []).length) return null;
    if (esOtra(cfg, monday)) return { otra: true };
    const rot = cfg.rotacion;
    const inicio = mondayOf(cfg.inicio || monday);
    let k = 0;
    if (monday >= inicio) { for (let m = inicio; m < monday; m = addDays(m, 7)) if (!esOtra(cfg, m)) k++; }
    else { for (let m = monday; m < inicio; m = addDays(m, 7)) if (!esOtra(cfg, m)) k--; }
    const i = ((k % rot.length) + rot.length) % rot.length;
    return { gid: rot[i] };
  }
  // Días de limpieza de esa semana: después de cada reunión, o un día fijo (0 = domingo … 6 = sábado).
  function diasLimpieza(cfg, monday, settings) {
    const s = settings || {};
    const off = (wd) => (Number(wd) + 6) % 7;
    if (cfg && cfg.modo === 'semana') return [addDays(monday, off(cfg.dia != null ? cfg.dia : 6))];
    const a = addDays(monday, off(s.weekdaySemana != null ? s.weekdaySemana : 4));
    const b = addDays(monday, off(s.weekdayFinde != null ? s.weekdayFinde : 0));
    return [a, b].sort();
  }

  // Lo que le toca a un hermano en el Salón entre dos días: [{ fecha, hora, rol, label, tid }]
  // rol: 'resp' | 'aux' | 'vol' | 'limpieza'. "grupoDe" devuelve el grupo del hermano (o null).
  function asignacionesSalon(pubId, trabajos, anotados, limpieza, settings, grupoDe, from, to) {
    const out = [];
    if (!pubId) return out;
    trabajosEntre(trabajos, from, to).forEach(o => {
      if (o.cancelada || o.estado === 'hecho') return;
      const t = o.t;
      let rol = null;
      if (t.resp === pubId) rol = 'resp';
      else if (t.aux === pubId) rol = 'aux';
      else if (voluntarios(t, o.fecha, anotados).some(v => v.pubId === pubId)) rol = 'vol';
      if (!rol) return;
      const quien = rol === 'resp' ? 'Responsable' : rol === 'aux' ? 'Auxiliar' : 'Voluntario';
      out.push({ fecha: o.fecha, hora: t.hora || '', rol, tid: t.id, label: `${t.titulo || 'Trabajo en el Salón'} (${quien.toLowerCase()})`, titulo: t.titulo || '', quien });
    });
    const g = grupoDe ? grupoDe(pubId) : null;
    if (g && limpieza) {
      for (let m = mondayOf(from); m <= to; m = addDays(m, 7)) {
        const tu = turnoLimpieza(limpieza, m);
        if (!tu || tu.gid !== g) continue;
        diasLimpieza(limpieza, m, settings).forEach(f => { if (f >= from && f <= to) out.push({ fecha: f, hora: '', rol: 'limpieza', tid: null, label: 'Limpieza del Salón (tu grupo)', titulo: 'Limpieza del Salón', quien: 'Tu grupo' }); });
      }
    }
    return out.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  }

  const api = { TIPOS, REPITE, ESTADOS, isoOf, addDays, addMonths, mondayOf, fechasDe, trabajosEntre, anotadoId, voluntarios, cupoInfo, semanaDelMes, turnoLimpieza, diasLimpieza, asignacionesSalon };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SalonCore = api;
})(typeof window !== 'undefined' ? window : this);
