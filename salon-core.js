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
     congregations/{código}/salon/limpieza → { tipos, semanas, rotacion: [grupo], otra: [n], otraNombre }  (ver "Limpiezas" más abajo;
       los campos viejos modo, dia, inicio y tareas se siguen leyendo si todavía no hay tipos ni semanas)
     congregations/{código}/salon/externos → { lista: {id: { id, nombre, cong, tel }} }   (hermanos de la otra congregación; solo quien maneja el Salón)
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

  /* ---------- Limpiezas cargadas semana por semana ----------
     cfg.tipos: [{ id, nombre, modo: 'reunion' | 'semana', dia (0 dom … 6 sáb), hora, tareas: [texto], mismoGrupo }]
       La primera es la "principal"; las demás, si mismoGrupo, las hace el grupo de la principal.
     cfg.semanas: { lunes: { g: grupo | 'otra' | 'nadie', s: sugerido, x: { tipoId: { g, s } }, d: { tipoId: [fechas] } } }
     cfg.rotacion: orden de los grupos para sugerir. cfg.otra: semanas del mes de la otra congregación.
     Compatibilidad: si todavía no se cargó ninguna semana (sin cfg.semanas), se usa la rotación de antes. */
  const TAREAS_REU = ['Barrer y trapear el salón', 'Baños: limpiar y reponer papel y jabón', 'Vaciar los cestos', 'Limpiar la plataforma y el atril', 'Repasar sillas y picaportes'];
  function tiposLimpieza(cfg) {
    const c = cfg || {};
    if (Array.isArray(c.tipos) && c.tipos.length) return c.tipos.map((t, i) => Object.assign({ mismoGrupo: i > 0 }, t, i === 0 ? { mismoGrupo: false } : {}));
    return [{ id: 'reu', nombre: c.modo === 'semana' ? 'Limpieza semanal' : 'Después de las reuniones', modo: c.modo || 'reunion', dia: c.dia != null ? c.dia : 6, hora: '', tareas: c.tareas || TAREAS_REU, mismoGrupo: false }];
  }
  // Clave con la que se guarda quién limpia: 'g' (la principal y las que van con ella) o el id de la limpieza.
  function claveDe(cfg, tipoId) { const ts = tiposLimpieza(cfg); const t = ts.find(x => x.id === tipoId); return !t || t === ts[0] || t.mismoGrupo ? 'g' : tipoId; }
  function cargado(cfg, monday, clave) {
    const w = ((cfg && cfg.semanas) || {})[monday];
    if (!w) return null;
    if (clave === 'g') return w.g ? { g: w.g, s: !!w.s } : null;
    const x = (w.x || {})[clave];
    return x && x.g ? { g: x.g, s: !!x.s } : null;
  }
  // Quién limpia esa semana (con esa clave): { g: grupo | 'otra' | 'nadie', s, auto } o null si no está cargada.
  function quienLimpia(cfg, monday, clave) {
    const c = cfg || {};
    const k = clave || 'g';
    const w = cargado(c, monday, k);
    if (w) return w;
    if (esOtra(c, monday)) return { g: 'otra', auto: true };
    if (!c.semanas && c.inicio && k === 'g') { const tu = turnoLimpieza(c, monday); if (tu && tu.gid) return { g: tu.gid, s: true, auto: true }; }
    return null;
  }
  // Días de una limpieza esa semana: los cambiados a mano esa semana, o los de siempre.
  function diasDe(cfg, monday, tipo, settings) {
    const w = ((cfg && cfg.semanas) || {})[monday];
    const d = w && w.d && w.d[tipo.id];
    if (Array.isArray(d)) return d.slice().sort();
    return diasLimpieza({ modo: tipo.modo, dia: tipo.dia }, monday, settings);
  }
  // Todas las limpiezas de una semana: [{ tipo, clave, quien, dias }]
  function limpiezasSemana(cfg, monday, settings) {
    return tiposLimpieza(cfg).map(tipo => { const clave = claveDe(cfg, tipo.id); return { tipo, clave, quien: quienLimpia(cfg, monday, clave), dias: diasDe(cfg, monday, tipo, settings) }; });
  }
  // Grupos ordenados para sugerir: el que hace más tiempo que no limpia (con esa clave); a igualdad, el orden de la lista.
  function ultimaVez(cfg, gid, clave, antesDe) {
    let best = null;
    Object.keys((cfg && cfg.semanas) || {}).forEach(m => { if (m >= antesDe) return; const w = cargado(cfg, m, clave); if (w && w.g === gid && (!best || m > best)) best = m; });
    return best;
  }
  function ordenSugerido(cfg, grupos, clave, monday) {
    const orden = ((cfg && cfg.rotacion) || []).filter(g => grupos.includes(g)).concat(grupos.filter(g => !((cfg && cfg.rotacion) || []).includes(g)));
    return orden.map((g, i) => ({ g, i, ult: ultimaVez(cfg, g, clave, monday) }))
      .sort((a, b) => (a.ult || '') === (b.ult || '') ? a.i - b.i : (a.ult || '').localeCompare(b.ult || ''));
  }
  // Completa las semanas vacías entre dos lunes. Devuelve { semanas nuevas, cuántas }.
  function sugerir(cfg, grupos, desde, hasta, claves) {
    const c = JSON.parse(JSON.stringify(cfg || {}));
    c.semanas = c.semanas || {};
    let n = 0;
    for (let m = mondayOf(desde); m <= hasta; m = addDays(m, 7)) {
      (claves || ['g']).forEach(k => {
        if (cargado(c, m, k) || esOtra(c, m) || !grupos.length) return;
        // Que el mismo grupo no tenga dos limpiezas distintas la misma semana, si se puede.
        const w0 = c.semanas[m] || {};
        const ocup = [w0.g].concat(Object.values(w0.x || {}).map(x => x.g)).filter(Boolean);
        const ord = ordenSugerido(c, grupos, k, m);
        const pick = (ord.find(o => !ocup.includes(o.g)) || ord[0]).g;
        const w = c.semanas[m] = Object.assign({}, c.semanas[m] || {});
        if (k === 'g') { w.g = pick; w.s = true; }
        else { w.x = Object.assign({}, w.x || {}); w.x[k] = { g: pick, s: true }; }
        n++;
      });
    }
    return { semanas: c.semanas, n };
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
      const varias = tiposLimpieza(limpieza).length > 1;
      for (let m = mondayOf(from); m <= to; m = addDays(m, 7)) {
        limpiezasSemana(limpieza, m, settings).forEach(l => {
          if (!l.quien || l.quien.g !== g) return;
          const nom = String(l.tipo.nombre || '');
          const titulo = !varias ? 'Limpieza del Salón' : /^limpieza/i.test(nom) ? nom : `Limpieza: ${nom.charAt(0).toLowerCase()}${nom.slice(1)}`;
          l.dias.forEach(f => { if (f >= from && f <= to) out.push({ fecha: f, hora: l.tipo.modo === 'semana' ? (l.tipo.hora || '') : '', rol: 'limpieza', tid: null, tipoId: l.tipo.id, label: titulo + ' (tu grupo)', titulo, quien: 'Tu grupo' }); });
        });
      }
    }
    return out.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  }

  const api = { TIPOS, REPITE, ESTADOS, TAREAS_REU, isoOf, addDays, addMonths, mondayOf, fechasDe, trabajosEntre, anotadoId, voluntarios, cupoInfo, semanaDelMes, esOtra, turnoLimpieza, diasLimpieza,
    tiposLimpieza, claveDe, cargado, quienLimpia, diasDe, limpiezasSemana, ultimaVez, ordenSugerido, sugerir, asignacionesSalon };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SalonCore = api;
})(typeof window !== 'undefined' ? window : this);
