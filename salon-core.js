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
  const REPITE = { no: 'No se repite', '15d': 'Cada 15 días', mes: 'Cada mes', '2m': 'Cada 2 meses', '3m': 'Cada 3 meses', '6m': 'Cada 6 meses', anio: 'Cada año' };
  const MESES_REP = { mes: 1, '2m': 2, '3m': 3, '6m': 6, anio: 12 };
  // Repetición libre: repite 'n' con cada (número) y unidad ('d' días, 's' semanas, 'm' meses, 'a' años).
  // Los de antes ('15d', 'mes', '3m'…) siguen funcionando igual.
  const UNIDADES = { d: ['día', 'días'], s: ['semana', 'semanas'], m: ['mes', 'meses'], a: ['año', 'años'] };
  const LEGADO = { '15d': [2, 's'], mes: [1, 'm'], '2m': [2, 'm'], '3m': [3, 'm'], '6m': [6, 'm'], anio: [1, 'a'] };
  // { n, u } de un trabajo que se repite, o null.
  function pasoDe(t) {
    if (!t || !t.repite || t.repite === 'no') return null;
    if (t.repite === 'n') { const n = Math.max(1, Math.min(99, parseInt(t.cada, 10) || 1)); return UNIDADES[t.unidad] ? { n, u: t.unidad } : null; }
    const l = LEGADO[t.repite]; return l ? { n: l[0], u: l[1] } : null;
  }
  // "Cada 3 meses", "Cada 15 días" (cada 2 semanas), "Cada año", "No se repite".
  function repiteTxt(t) {
    const p = pasoDe(t);
    if (!p) return 'No se repite';
    if (p.u === 's' && p.n === 2) return 'Cada 15 días';
    if (p.n === 1) return p.u === 's' ? 'Cada semana' : `Cada ${UNIDADES[p.u][0]}`;
    return `Cada ${p.n} ${UNIDADES[p.u][1]}`;
  }
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
    const p = pasoDe(t);
    if (!p) { if (t.fecha >= from && t.fecha <= to) out.push(t.fecha); return out; }
    for (let i = 0; i < 2000; i++) {
      const f = p.u === 'd' ? addDays(t.fecha, p.n * i) : p.u === 's' ? addDays(t.fecha, 7 * p.n * i) : addMonths(t.fecha, (p.u === 'a' ? 12 : 1) * p.n * i);
      if (f > to) break;
      if (t.hasta && f > t.hasta) break;
      if (f >= from) out.push(f);
    }
    return out;
  }

  // ¿Esa vez se ve en la vista (y se piden voluntarios)? Cada vez puede publicarse u ocultarse
  // aparte (ocurr[fecha].pub); si no, vale lo del trabajo (vista: false = "Solo el comité").
  // Los que todavía no tienen día (soloMes) no se publican.
  function publicado(t, fecha) {
    if (!t || t.soloMes) return false;
    const o = ((t.ocurr || {})[fecha]) || {};
    if (o.pub === true || o.pub === false) return o.pub;
    return t.vista !== false;
  }
  // Todos los trabajos (cada vez que toca) entre dos días, en orden. Incluye los suspendidos
  // esa vez (cancelada: true) para que la app los muestre tachados. sinDia: el trabajo tiene
  // solo el mes (fecha = el día 1 de ese mes); pub: se ve en la vista.
  function trabajosEntre(lista, from, to) {
    const out = [];
    Object.values(lista || {}).forEach(t => {
      if (!t || !t.id) return;
      fechasDe(t, from, to).forEach(f => {
        const o = (t.ocurr || {})[f] || {};
        out.push({ t, fecha: f, occ: o, estado: o.estado || 'prog', cancelada: !!o.cancelada, sinDia: !!t.soloMes, pub: publicado(t, f) });
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
      if (a && a.tid === t.id && a.fecha === fecha) out.push({ id, pubId: a.pubId, nombre: a.nombre || '', comentario: a.comentario || '', propio: true, email: a.email || '', cong: a.cong || '', inv: a.inv || '' });
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
  // "Un grupo por reunión" (en la principal, de después de cada reunión): un grupo para la reunión de entre
  // semana ('g') y otro para la del fin de semana ('r'). Las que van "con el mismo grupo" las hace el del fin de semana.
  function porReunion(cfg) { const t = tiposLimpieza(cfg)[0]; return !!(t && t.modo === 'reunion' && t.porReunion); }
  function claveDe(cfg, tipoId) { const ts = tiposLimpieza(cfg); const t = ts.find(x => x.id === tipoId); return !t || t === ts[0] ? 'g' : t.mismoGrupo ? (porReunion(cfg) ? 'r' : 'g') : tipoId; }
  function cargado(cfg, monday, clave) {
    const w = ((cfg && cfg.semanas) || {})[monday];
    if (!w) return null;
    if (clave === 'g') return w.g ? { g: w.g, s: !!w.s } : null;
    if (clave === 'r') return w.r && w.r.g ? { g: w.r.g, s: !!w.r.s } : null;
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
  // Todas las limpiezas de una semana (de esta congregación): [{ tipo, clave, quien, dias }]
  // Si una limpieza se turna entre las congregaciones del Salón y esa semana le toca a otra,
  // sale como { g: 'otra', c: id de esa congregación }.
  function limpiezasSemana(cfg, monday, settings) {
    const out = [];
    tiposLimpieza(cfg).forEach((tipo, i) => {
      if (i === 0 && tipo.modo === 'reunion' && tipo.porReunion) {
        // Un grupo por reunión: dos líneas, la de entre semana y la del fin de semana.
        const d = diasDe(cfg, monday, tipo, settings);
        out.push({ tipo, clave: 'g', parte: 'semana', quien: quienLimpia(cfg, monday, 'g'), dias: d.slice(0, 1) });
        if (d.length > 1) out.push({ tipo, clave: 'r', parte: 'finde', quien: quienLimpia(cfg, monday, 'r'), dias: d.slice(1) });
        return;
      }
      out.push(unaLimpieza(tipo));
    });
    return out;
    function unaLimpieza(tipo) {
      const clave = claveDe(cfg, tipo.id);
      const tc = turnoDe(cfg, tipo, monday);
      const quien = tc !== 'local' ? { g: 'otra', c: tc, auto: true } : quienLimpia(cfg, monday, clave);
      return { tipo, clave, quien, dias: diasDe(cfg, monday, tipo, settings) };
    }
  }

  /* ---------- Salón compartido: las otras congregaciones con sus grupos ----------
     cfg.congs: [{ id, nombre, color, dias: { semana: 0-6, finde: 0-6 }, grupos: [{ id, nombre, encargado, tel }] }]
     cfg.semanas[lunes].c[idCong] = { g, s }: el grupo de esa congregación esa semana (limpia después de SUS reuniones).
     tipo.turno = { orden: ['local', idCong…], inicio: lunes }: una limpieza de un día por semana que se turnan
       las congregaciones, semana por semana; la hace el grupo que esa semana tiene la limpieza de reuniones.
     cfg.semanas[lunes].t[idTipo] = 'local' | idCong: cambio a mano del turno esa semana. */
  function congsSalon(cfg) { return ((cfg && cfg.congs) || []).filter(c => c && c.id); }
  function turnoDe(cfg, tipo, monday) {
    if (!tipo || !tipo.turno || tipo.modo === 'reunion') return 'local';
    const ids = ['local'].concat(congsSalon(cfg).map(c => c.id));
    if (ids.length < 2) return 'local';
    const fijo = ((((cfg && cfg.semanas) || {})[monday] || {}).t || {})[tipo.id];
    if (fijo && ids.includes(fijo)) return fijo;
    const orden = (tipo.turno.orden || []).filter(x => ids.includes(x)).concat(ids.filter(x => !(tipo.turno.orden || []).includes(x)));
    const ini = mondayOf(tipo.turno.inicio || monday);
    const k = Math.round((Date.parse(monday + 'T12:00:00Z') - Date.parse(ini + 'T12:00:00Z')) / 604800000);
    return orden[((k % orden.length) + orden.length) % orden.length];
  }
  // Días de reunión de otra congregación esa semana (después de esas reuniones limpia su grupo).
  function diasCong(cong, monday) {
    const d = (cong && cong.dias) || {};
    return diasLimpieza({ modo: 'reunion' }, monday, { weekdaySemana: d.semana != null ? d.semana : 2, weekdayFinde: d.finde != null ? d.finde : 6 });
  }
  // parte: 'semana' (o sin parte) → c; 'finde' → cr (cuando esa congregación tiene un grupo por reunión).
  function grupoCong(cfg, monday, idCong, parte) {
    const x = (((((cfg && cfg.semanas) || {})[monday]) || {})[parte === 'finde' ? 'cr' : 'c'] || {})[idCong];
    return x && x.g ? { g: x.g, s: !!x.s } : null;
  }
  const congPorReunion = (cfg, idCong) => !!((congsSalon(cfg).find(c => c.id === idCong) || {}).porReunion);
  // Las partes que se cargan por separado de esa congregación: una por semana, o una por reunión.
  const partesCong = (cfg, idCong) => congPorReunion(cfg, idCong) ? ['semana', 'finde'] : ['semana'];
  function nombreGrupoCong(cfg, idCong, gid) {
    const c = congsSalon(cfg).find(x => x.id === idCong);
    const g = c && (c.grupos || []).find(x => x.id === gid);
    return gid === 'nadie' ? 'Sin limpieza' : g ? g.nombre : '';
  }
  // Las limpiezas del Salón esa semana, de todas las congregaciones: [{ tipo, cong: 'local' | id, quien, dias, turno }]
  // · "Después de cada reunión": la de esta congregación y, además, cada otra congregación después de sus reuniones.
  // · La que se turnan: una sola, de la congregación a la que le toca (con el grupo que esa semana tiene).
  function limpiezasSalon(cfg, monday, settings) {
    const reu = [], otras = [], resto = [];
    const congs = congsSalon(cfg);
    limpiezasSemana(cfg, monday, settings).forEach(l => {
      const turno = !!(l.tipo.turno && l.tipo.modo !== 'reunion' && congs.length);
      if (l.quien && l.quien.g === 'otra' && l.quien.c) { const pr = congPorReunion(cfg, l.quien.c) ? 'finde' : undefined; resto.push({ tipo: l.tipo, clave: l.clave, cong: l.quien.c, quien: grupoCong(cfg, monday, l.quien.c, pr), dias: l.dias, turno: true }); return; }
      const x = Object.assign({}, l, { cong: 'local', turno });
      if (l.tipo.modo !== 'reunion') { resto.push(x); return; }
      reu.push(x);
      if (otras.length) return;
      // Cada otra congregación, después de SUS reuniones (con un grupo por semana o uno por reunión).
      congs.forEach(c => {
        const d = diasCong(c, monday);
        if (c.porReunion) {
          otras.push({ tipo: l.tipo, clave: 'c', cong: c.id, parte: 'semana', quien: grupoCong(cfg, monday, c.id, 'semana'), dias: d.slice(0, 1), turno: false });
          otras.push({ tipo: l.tipo, clave: 'c', cong: c.id, parte: 'finde', quien: grupoCong(cfg, monday, c.id, 'finde'), dias: d.slice(1), turno: false });
        } else otras.push({ tipo: l.tipo, clave: 'c', cong: c.id, quien: grupoCong(cfg, monday, c.id), dias: d, turno: false });
      });
    });
    return reu.concat(otras, resto);
  }
  // La última semana (antes de "antesDe") en que limpió ese grupo de otra congregación.
  function ultimaVezCong(cfg, idCong, gid, antesDe) {
    let best = null;
    Object.keys((cfg && cfg.semanas) || {}).forEach(m => { if (m >= antesDe) return; if (['semana', 'finde'].some(p => { const w = grupoCong(cfg, m, idCong, p); return w && w.g === gid; }) && (!best || m > best)) best = m; });
    return best;
  }
  function ordenCong(cfg, idCong, monday) {
    const c = congsSalon(cfg).find(x => x.id === idCong);
    return ((c && c.grupos) || []).filter(g => g && g.id).map((g, i) => ({ g: g.id, i, ult: ultimaVezCong(cfg, idCong, g.id, monday) }))
      .sort((a, b) => (a.ult || '') === (b.ult || '') ? a.i - b.i : (a.ult || '').localeCompare(b.ult || ''));
  }
  // Completa los grupos de las otras congregaciones en las semanas vacías (el que hace más que no limpia).
  function sugerirCongs(cfg, desde, hasta, soloCong) {
    const c = JSON.parse(JSON.stringify(cfg || {}));
    c.semanas = c.semanas || {};
    let n = 0;
    congsSalon(c).filter(cg => !soloCong || cg.id === soloCong).forEach(cg => {
      for (let m = mondayOf(desde); m <= hasta; m = addDays(m, 7)) {
        partesCong(c, cg.id).forEach(p => {
          if (grupoCong(c, m, cg.id, p)) return;
          const ord = ordenCong(c, cg.id, m);
          if (!ord.length) return;
          const otro = grupoCong(c, m, cg.id, p === 'finde' ? 'semana' : 'finde');
          const pick = (ord.find(o => !otro || o.g !== otro.g) || ord[0]).g;
          const k = p === 'finde' ? 'cr' : 'c';
          const w = c.semanas[m] = Object.assign({}, c.semanas[m] || {});
          w[k] = Object.assign({}, w[k] || {}); w[k][cg.id] = { g: pick, s: true };
          n++;
        });
      }
    });
    return { semanas: c.semanas, n };
  }
  // Tabla del mes para el PDF y la vista: columnas (una por limpieza y congregación; la que se turnan, una sola)
  // y una fila por semana. nombres: { local: 'San Agustín', grupo: (gid) => nombre del grupo de esta congregación }.
  function tablaLimpieza(cfg, semanas, settings, nombres) {
    const congs = congsSalon(cfg);
    const nomCong = (id) => id === 'local' ? (nombres.local || 'Esta congregación') : ((congs.find(c => c.id === id) || {}).nombre || 'Otra congregación');
    const DIAS3 = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const corto = (f) => { const d = new Date(f + 'T12:00:00Z'); return `${DIAS3[d.getUTCDay()]} ${d.getUTCDate()}`; };
    const lista = (a) => a.map(corto).reduce((t, x, i, arr) => t + (i === 0 ? '' : i === arr.length - 1 ? ' y ' : ', ') + x, '');
    const cols = [];
    const colDe = (l) => l.turno ? l.tipo.id + '|T' : l.tipo.id + '|' + l.cong + (l.parte ? '|' + l.parte : '');
    semanas.forEach(m => limpiezasSalon(cfg, m, settings).forEach(l => {
      const k = colDe(l);
      if (!cols.some(c => c.k === k)) cols.push({ k, tipo: l.tipo, cong: l.turno ? null : l.cong, turno: l.turno, titulo: l.turno ? `${l.tipo.nombre}${l.tipo.hora ? ' (' + l.tipo.hora + ')' : ''} · se turnan` : `${l.parte ? (l.parte === 'semana' ? 'Reunión de entre semana' : 'Reunión del fin de semana') : l.tipo.modo === 'reunion' ? 'Después de las reuniones' : l.tipo.nombre} · ${nomCong(l.cong)}` });
    }));
    const filas = semanas.map(m => {
      const ls = limpiezasSalon(cfg, m, settings);
      return { m, celdas: cols.map(c => {
        const l = ls.find(x => colDe(x) === c.k);
        if (!l) return { txt: '—', cong: null };
        const q = l.quien;
        const gn = !q ? '' : q.g === 'nadie' ? 'Sin limpieza' : q.g === 'otra' ? nomCong('otra') : l.cong === 'local' ? (nombres.grupo ? nombres.grupo(q.g) : q.g) : nombreGrupoCong(cfg, l.cong, q.g);
        const quien = (l.turno ? nomCong(l.cong) + (gn ? ' · ' + gn : '') : gn) || 'Sin cargar';
        return { txt: quien, dias: q && q.g === 'nadie' ? '' : lista(l.dias) + (l.tipo.modo === 'semana' && l.tipo.hora ? ' · ' + l.tipo.hora : ''), cong: l.cong, vacio: !q };
      }) };
    });
    return { cols, filas, nomCong };
  }
  // Grupos ordenados para sugerir: el que hace más tiempo que no limpia (con esa clave); a igualdad, el orden de la lista.
  function ultimaVez(cfg, gid, clave, antesDe) {
    let best = null;
    const ks = clave === 'g' || clave === 'r' ? ['g', 'r'] : [clave];   // las dos reuniones cuentan juntas
    Object.keys((cfg && cfg.semanas) || {}).forEach(m => { if (m >= antesDe) return; if (ks.some(k => { const w = cargado(cfg, m, k); return w && w.g === gid; }) && (!best || m > best)) best = m; });
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
        const ocup = [w0.g, w0.r && w0.r.g].concat(Object.values(w0.x || {}).map(x => x.g)).filter(Boolean);
        const ord = ordenSugerido(c, grupos, k, m);
        const pick = (ord.find(o => !ocup.includes(o.g)) || ord[0]).g;
        const w = c.semanas[m] = Object.assign({}, c.semanas[m] || {});
        if (k === 'g') { w.g = pick; w.s = true; }
        else if (k === 'r') w.r = { g: pick, s: true };
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
      if (o.cancelada || o.estado === 'hecho' || o.sinDia) return;
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

  const api = { TIPOS, REPITE, ESTADOS, TAREAS_REU, isoOf, addDays, addMonths, mondayOf, fechasDe, pasoDe, repiteTxt, UNIDADES, publicado, trabajosEntre, anotadoId, voluntarios, cupoInfo, semanaDelMes, esOtra, turnoLimpieza, diasLimpieza,
    tiposLimpieza, porReunion, claveDe, cargado, quienLimpia, diasDe, limpiezasSemana, ultimaVez, ordenSugerido, sugerir, asignacionesSalon,
    congsSalon, turnoDe, diasCong, grupoCong, congPorReunion, partesCong, nombreGrupoCong, limpiezasSalon, ultimaVezCong, ordenCong, sugerirCongs, tablaLimpieza };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SalonCore = api;
})(typeof window !== 'undefined' ? window : this);
