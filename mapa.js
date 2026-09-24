/* =====================================================================
   Mapas de territorios — Leaflet + OpenStreetMap (gratis, sin cuentas)
   ---------------------------------------------------------------------
   Lo usan la app de asignaciones (dibujar y ver todos los territorios) y
   la vista de la congregación (el mapa de "Mis territorios"). Leaflet está
   copiado en vendor/leaflet (licencia BSD-2) y se carga recién cuando hace
   falta un mapa. Los límites se guardan como [{lat, lng}, ...].
   ===================================================================== */
(function () {
  'use strict';
  const BASE = (document.currentScript && document.currentScript.src || '').replace(/mapa\.js(\?.*)?$/, '');
  const COLORS = { disponible: '#4C7A5E', asignado: '#3E6B8A', vencido: '#C0392B', anio: '#C98A1B', nuevo: '#3E6B8A' };
  const DEFAULT_CENTER = [-34.6037, -58.3816];   // si todavía no hay nada dibujado ni ubicación
  let loading = null;

  function load() {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    if (!loading) loading = new Promise((res, rej) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = BASE + 'vendor/leaflet/leaflet.css';
      document.head.appendChild(css);
      const st = document.createElement('style');
      st.textContent = `.tm-num { background: rgba(255,255,255,.92); border: none; box-shadow: 0 1px 4px rgba(0,0,0,.25); font-weight: 700; font-size: 12px; padding: 1px 6px; border-radius: 8px; color: #212C34; }
        .tm-num:before { display: none; }
        .tm-me { width: 14px; height: 14px; border-radius: 50%; background: #4285F4; border: 3px solid #fff; box-shadow: 0 0 0 6px rgba(66,133,244,.25); box-sizing: border-box; }
        .tm-pt { width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 3px solid #3E6B8A; box-sizing: border-box; }
        .tm-pt.first { background: #3E6B8A; }
        .tm-btn { background: #fff; border: none; border-radius: 8px; box-shadow: 0 1px 5px rgba(0,0,0,.3); padding: 7px 10px; font: 700 13px system-ui, sans-serif; color: #212C34; cursor: pointer; }
        .leaflet-container { font: inherit; isolation: isolate; z-index: 0; }`;   /* que los controles del mapa no tapen las ventanas de la app */
      document.head.appendChild(st);
      const sc = document.createElement('script');
      sc.src = BASE + 'vendor/leaflet/leaflet.js';
      sc.onload = () => res(window.L);
      sc.onerror = () => { loading = null; rej(new Error('No se pudo cargar el mapa')); };
      document.head.appendChild(sc);
    });
    return loading;
  }
  function toLL(pts) { return (pts || []).map(p => [p.lat, p.lng]); }
  function baseMap(el, opts) {
    const L = window.L;
    const m = L.map(el, Object.assign({ zoomControl: true, attributionControl: true, tap: true }, opts || {}));
    m.setView(DEFAULT_CENTER, 12);   // Leaflet necesita una vista antes de dibujar formas; después se ajusta
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(m);
    return m;
  }
  function centroid(pts) {
    if (!pts || !pts.length) return null;
    const s = pts.reduce((a, p) => ({ lat: a.lat + p.lat, lng: a.lng + p.lng }), { lat: 0, lng: 0 });
    return { lat: s.lat / pts.length, lng: s.lng / pts.length };
  }
  function directionsUrl(pts) {
    const c = centroid(pts); if (!c) return '';
    return `https://www.google.com/maps/dir/?api=1&destination=${c.lat.toFixed(6)},${c.lng.toFixed(6)}`;
  }
  // Botón "Mi ubicación": sigue la posición del celular con un punto azul.
  function addLocate(m) {
    const L = window.L;
    let marker = null, watch = null;
    const Ctl = L.Control.extend({
      onAdd() {
        const b = L.DomUtil.create('button', 'tm-btn');
        b.type = 'button'; b.textContent = '📍 Mi ubicación'; b.title = 'Mostrar dónde estoy';
        L.DomEvent.disableClickPropagation(b);
        b.addEventListener('click', () => {
          if (!navigator.geolocation) { b.textContent = 'Sin ubicación'; return; }
          if (watch != null) { navigator.geolocation.clearWatch(watch); watch = null; if (marker) { marker.remove(); marker = null; } b.textContent = '📍 Mi ubicación'; return; }
          b.textContent = 'Buscando…';
          let first = true;
          watch = navigator.geolocation.watchPosition((pos) => {
            const ll = [pos.coords.latitude, pos.coords.longitude];
            if (!marker) marker = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="tm-me"></div>', iconSize: [14, 14] }), interactive: false }).addTo(m);
            else marker.setLatLng(ll);
            if (first) { first = false; b.textContent = '✕ Dejar de seguir'; m.panTo(ll); }
          }, () => { b.textContent = 'Sin permiso de ubicación'; watch = null; }, { enableHighAccuracy: true, maximumAge: 10000 });
        });
        return b;
      },
      onRemove() { if (watch != null) navigator.geolocation.clearWatch(watch); }
    });
    new Ctl({ position: 'topright' }).addTo(m);
  }

  const API = {
    load, centroid, directionsUrl, COLORS,
    // Un territorio, solo para mirar.
    async show(el, pts, opts) {
      const L = await load();
      opts = opts || {};
      const m = baseMap(el, { scrollWheelZoom: !!opts.big });
      const poly = L.polygon(toLL(pts), { color: opts.color || COLORS.asignado, weight: 3, fillOpacity: 0.15 }).addTo(m);
      if (opts.label) poly.bindTooltip(String(opts.label), { permanent: true, direction: 'center', className: 'tm-num' });
      m.fitBounds(poly.getBounds(), { padding: [18, 18] });
      if (opts.locate) addLocate(m);
      return m;
    },
    // Todos los territorios, coloreados por estado; tocar uno llama a onClick(id).
    async showAll(el, items, onClick) {
      const L = await load();
      const m = baseMap(el);
      const group = L.featureGroup().addTo(m);
      items.forEach(it => {
        const poly = L.polygon(toLL(it.limites), { color: it.color || COLORS.asignado, weight: 2.5, fillOpacity: 0.22 }).addTo(group);
        poly.bindTooltip(String(it.label), { permanent: true, direction: 'center', className: 'tm-num' });
        if (onClick) poly.on('click', () => onClick(it.id));
      });
      if (items.length) m.fitBounds(group.getBounds(), { padding: [20, 20] });
      else API.centerOnMe(m);
      addLocate(m);
      return m;
    },
    centerOnMe(m, fallback) {
      m.setView(fallback || DEFAULT_CENTER, fallback ? 15 : 12);
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => m.setView([p.coords.latitude, p.coords.longitude], 16), () => {}, { timeout: 6000 });
    },
    // Dibujar: cada toque agrega una esquina; los puntos se pueden arrastrar para acomodarlos.
    // otros: límites de los demás territorios (se ven de fondo, para no superponerse).
    async draw(el, pts, otros, onChange) {
      const L = await load();
      const m = baseMap(el);
      const bg = L.featureGroup().addTo(m);
      (otros || []).forEach(o => {
        L.polygon(toLL(o.limites), { color: '#93A0A7', weight: 1.5, fillOpacity: 0.08, interactive: false }).addTo(bg)
          .bindTooltip(String(o.label), { permanent: true, direction: 'center', className: 'tm-num' });
      });
      let points = (pts || []).map(p => L.latLng(p.lat, p.lng));
      let markers = [];
      const shape = L.polygon([], { color: COLORS.nuevo, weight: 3, fillOpacity: 0.18, interactive: false }).addTo(m);
      function paint() {
        markers.forEach(mk => mk.remove());
        markers = points.map((ll, i) => {
          const mk = L.marker(ll, { draggable: true, icon: L.divIcon({ className: '', html: `<div class="tm-pt${i === 0 ? ' first' : ''}"></div>`, iconSize: [16, 16] }) }).addTo(m);
          mk.on('drag', (e) => { points[i] = e.target.getLatLng(); shape.setLatLngs(points); });
          mk.on('dragend', () => { if (onChange) onChange(points.length); });
          return mk;
        });
        shape.setLatLngs(points);
        if (onChange) onChange(points.length);
      }
      m.on('click', (e) => { points.push(e.latlng); paint(); });
      if (points.length) m.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
      else if (bg.getLayers().length) m.fitBounds(bg.getBounds(), { padding: [20, 20] });
      else API.centerOnMe(m);
      paint();
      return {
        map: m,
        undo() { points.pop(); paint(); },
        clear() { points = []; paint(); },
        count() { return points.length; },
        points() { return points.map(ll => ({ lat: Math.round(ll.lat * 1e6) / 1e6, lng: Math.round(ll.lng * 1e6) / 1e6 })); },
        goTo(lat, lng) { m.setView([lat, lng], 17); }
      };
    },
    // Buscar una calle o barrio (OpenStreetMap). Devuelve [{ nombre, lat, lng }].
    async search(q, near) {
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=es&q=' + encodeURIComponent(q) + (near ? '&viewbox=' + [near.lng - 0.3, near.lat + 0.3, near.lng + 0.3, near.lat - 0.3].join(',') : '');
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('busqueda');
      return (await r.json()).map(x => ({ nombre: x.display_name, lat: parseFloat(x.lat), lng: parseFloat(x.lon) }));
    }
  };
  window.TerrMapa = API;
})();
