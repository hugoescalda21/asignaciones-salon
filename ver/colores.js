/* =====================================================================
   Colores de la app (vista de la congregación)
   ---------------------------------------------------------------------
   Botón 🎨 del encabezado → hoja con 4 estilos (Clásico, Moderno azul,
   Cálido, Vibrante) y el modo (Claro, Oscuro, Como el celular). Todo se
   guarda en este celular (kh-paleta, kh-modo). El estilo se aplica antes
   de pintar con el script del principio de ver.html; los colores están
   en paletas.css. Quien ya usaba la app ve una vez el aviso "Nuevo:
   elegí tus colores" en Inicio.
   ===================================================================== */
(function () {
  'use strict';
  const d = document.documentElement;
  const EST = [
    ['clasico', 'Clásico', 'Sobrio, el de siempre'],
    ['a', 'Moderno azul', 'Claro y prolijo'],
    ['b', 'Cálido', 'Verde y coral'],
    ['c', 'Vibrante', 'Violeta y fucsia']
  ];
  const MODOS = [['claro', '☀️ Claro'], ['oscuro', '🌙 Oscuro'], ['auto', '📱 Como el celular']];
  const TOP = { clasico: ['#212C34', '#0C1216'], a: ['#0F1B2D', '#060B16'], b: ['#0F8A6A', '#0B5E49'], c: ['#6D28D9', '#4C1D95'] };

  const get = (k, def) => { try { return localStorage.getItem(k) || def; } catch (e) { return def; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin acceso */ } };
  const paleta = () => { const v = get('kh-paleta', 'clasico'); return /^(clasico|[abc])$/.test(v) ? v : 'clasico'; };
  const modo = () => { const v = get('kh-modo', 'auto'); return /^(auto|claro|oscuro)$/.test(v) ? v : 'auto'; };

  // La barra del celular acompaña el color del encabezado.
  function themeColor() {
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', TOP[paleta()][d.classList.contains('dk') ? 1 : 0]);
  }
  function apply(p, m) {
    if (p) { set('kh-paleta', p); if (p === 'clasico') d.removeAttribute('data-paleta'); else d.setAttribute('data-paleta', p); }
    if (m) { set('kh-modo', m); d.setAttribute('data-modo', m); if (window.khApplyDark) window.khApplyDark(); }
    themeColor();
  }

  const css = document.createElement('style');
  css.textContent = `
  .col-ov { position: fixed; inset: 0; z-index: 60; background: rgba(10,14,20,.45); display: flex; align-items: flex-end; justify-content: center; animation: colFade .15s ease-out; }
  @keyframes colFade { from { opacity: 0; } to { opacity: 1; } }
  .col-sheet { background: var(--surface); color: var(--ink); width: 100%; max-width: 480px; border-radius: 22px 22px 0 0; padding: 10px 16px calc(16px + env(safe-area-inset-bottom)); box-shadow: 0 -8px 30px rgba(0,0,0,.2); max-height: 92vh; overflow-y: auto; }
  .col-handle { width: 38px; height: 4px; border-radius: 2px; background: var(--line); margin: 0 auto 12px; }
  .col-sheet h3 { margin: 0; font-family: inherit; font-weight: 700; font-size: 18px; }
  .col-hint { font-size: 12.5px; color: var(--ink-soft); margin: 3px 0 12px; }
  .col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .col-opt { display: block; width: 100%; border: 2px solid var(--line); border-radius: 16px; padding: 8px; background: var(--surface); text-align: left; font: inherit; color: var(--ink); position: relative; cursor: pointer; }
  .col-opt.on { border-color: var(--accent-gold); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-gold) 22%, transparent); }
  .col-mini { display: block; height: 70px; border-radius: 10px; overflow: hidden; background: var(--mb); position: relative; }
  .col-mini i { position: absolute; display: block; }
  .col-mini .t { left: 0; right: 0; top: 0; height: 17px; background: var(--mt); }
  .col-mini .h { left: 7px; right: 7px; top: 22px; height: 24px; border-radius: var(--mr); background: var(--mh); }
  .col-mini .s { left: 7px; right: 7px; top: 50px; height: 13px; border-radius: 5px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  .col-mini .s::before { content: ''; position: absolute; left: 6px; top: 4.5px; width: 18px; height: 4px; border-radius: 2px; background: var(--ma); }
  .col-opt b { display: block; font-size: 13.5px; margin: 7px 2px 0; }
  .col-opt small { display: block; font-size: 11px; color: var(--ink-soft); margin: 1px 2px 0; }
  .col-ck { position: absolute; top: 12px; right: 12px; width: 22px; height: 22px; border-radius: 50%; background: var(--accent-gold); color: #fff; font-size: 12px; font-weight: 800; display: none; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,.25); }
  .col-opt.on .col-ck { display: flex; }
  .col-o-clasico { --mb: #EDEFEF; --mt: #212C34; --mh: linear-gradient(135deg,#212C34,#33444F); --ma: #A9822F; --mr: 4px; }
  .col-o-a { --mb: #F2F5FB; --mt: linear-gradient(135deg,#0F1B2D,#1E3A8A); --mh: linear-gradient(135deg,#1D4ED8,#3B82F6); --ma: #2563EB; --mr: 8px; }
  .col-o-b { --mb: #F7F5F0; --mt: linear-gradient(135deg,#0F8A6A,#0B6E54); --mh: linear-gradient(140deg,#fff,#FFE1CF); --ma: #0F8A6A; --mr: 8px; }
  .col-o-c { --mb: #F4F2FF; --mt: linear-gradient(120deg,#6D28D9,#2563EB); --mh: linear-gradient(135deg,#7C3AED,#DB2777); --ma: #7C3AED; --mr: 8px; }
  .col-lbl { font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-soft); margin: 16px 2px 7px; }
  .col-seg { display: flex; background: var(--bg); border-radius: 12px; padding: 4px; gap: 4px; }
  .col-seg button { flex: 1; border: none; background: none; border-radius: 9px; padding: 9px 4px; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); cursor: pointer; min-height: 40px; }
  .col-seg button.on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 4px rgba(0,0,0,.14); }
  .col-ok { width: 100%; margin-top: 16px; border: none; border-radius: 14px; padding: 14px; font: inherit; font-size: 15px; font-weight: 700; background: var(--accent-gold); color: #fff; cursor: pointer; }
  .col-foot { font-size: 11px; color: var(--ink-soft); text-align: center; margin-top: 8px; }
  .col-news { position: relative; display: flex; gap: 12px; align-items: center; background: var(--surface); border: 1.5px solid color-mix(in srgb, var(--accent-gold) 45%, transparent); border-radius: 16px; padding: 12px 34px 12px 14px; margin-bottom: 14px; box-shadow: var(--shadow-sm); }
  .col-news .dots { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; flex-shrink: 0; }
  .col-news .dots i { width: 13px; height: 13px; border-radius: 50%; display: block; }
  .col-news b { display: block; font-size: 13.5px; }
  .col-news small { display: block; color: var(--ink-soft); font-size: 12px; line-height: 1.35; }
  .col-news .go { margin-left: auto; flex-shrink: 0; border: none; background: var(--accent-gold); color: #fff; font: inherit; font-size: 12.5px; font-weight: 700; border-radius: 10px; padding: 9px 12px; min-height: 40px; cursor: pointer; }
  .col-news .x { position: absolute; top: 2px; right: 2px; border: none; background: none; color: var(--ink-faint); font-size: 14px; padding: 8px; cursor: pointer; }
  `;
  document.head.appendChild(css);

  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function open() {
    closeNews();
    const prev = document.querySelector('.col-ov'); if (prev) prev.remove();
    const ov = document.createElement('div');
    ov.className = 'col-ov';
    ov.innerHTML = `<div class="col-sheet" role="dialog" aria-modal="true" aria-labelledby="colTitle">
      <div class="col-handle"></div>
      <h3 id="colTitle">Colores de la app</h3>
      <div class="col-hint">Tocá uno para verlo. Solo cambia en este celular.</div>
      <div class="col-grid" role="radiogroup" aria-label="Estilo">${EST.map(([k, t, s]) => `<button type="button" class="col-opt col-o-${k}" role="radio" data-col-p="${k}"><span class="col-mini" aria-hidden="true"><i class="t"></i><i class="h"></i><i class="s"></i></span><b>${esc(t)}</b><small>${esc(s)}</small><span class="col-ck" aria-hidden="true">✓</span></button>`).join('')}</div>
      <div class="col-lbl">Modo</div>
      <div class="col-seg" role="radiogroup" aria-label="Modo">${MODOS.map(([k, t]) => `<button type="button" role="radio" data-col-m="${k}">${t}</button>`).join('')}</div>
      <button type="button" class="col-ok" id="colOk">Listo</button>
      <div class="col-foot">Lo podés cambiar cuando quieras desde 🎨</div>
    </div>`;
    document.body.appendChild(ov);
    const mark = () => {
      ov.querySelectorAll('[data-col-p]').forEach(b => { const on = b.dataset.colP === paleta(); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      ov.querySelectorAll('[data-col-m]').forEach(b => { const on = b.dataset.colM === modo(); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    };
    mark();
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); const b = document.getElementById('colBtn'); if (b) b.focus(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', (e) => {
      if (e.target === ov) { close(); return; }
      const p = e.target.closest('[data-col-p]'); if (p) { apply(p.dataset.colP, null); mark(); return; }
      const m = e.target.closest('[data-col-m]'); if (m) { apply(null, m.dataset.colM); mark(); return; }
      if (e.target.closest('#colOk')) close();
    });
    const on = ov.querySelector('.col-opt.on'); if (on) on.focus();
  }

  // Aviso "Nuevo: elegí tus colores" (una sola vez, para quien ya usaba la app).
  function closeNews() {
    try { localStorage.removeItem('kh-colores-aviso'); } catch (e) { /* nada */ }
    const n = document.getElementById('colNews'); if (n) { n.classList.add('hidden'); n.innerHTML = ''; }
  }
  function renderNews() {
    const n = document.getElementById('colNews'); if (!n) return;
    if (get('kh-colores-aviso', '') !== '1') return;
    n.innerHTML = `<div class="col-news"><span class="dots" aria-hidden="true"><i style="background:#212C34"></i><i style="background:#2563EB"></i><i style="background:#0F8A6A"></i><i style="background:#7C3AED"></i></span>
      <span><b>Nuevo: elegí tus colores</b><small>Hay 4 estilos y modo claro u oscuro.</small></span>
      <button type="button" class="go" data-col-open>Ver</button><button type="button" class="x" data-col-x aria-label="Cerrar el aviso">✕</button></div>`;
    n.classList.remove('hidden');
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#colBtn') || e.target.closest('[data-col-open]')) open();
    else if (e.target.closest('[data-col-x]')) closeNews();
  });
  // Si el celular cambia de claro a oscuro con "Como el celular", la barra también.
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(themeColor, 0)); } catch (e) { /* nada */ }

  themeColor();
  renderNews();
  window.khColores = { open, apply, renderNews };
})();
