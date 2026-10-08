/* Ficha de trabajo en PDF con el diseño de las fichas del manual (la usan la app de administración
   y la vista de la congregación). dibujar(doc, f) con f = { titulo, md (ficha del manual o propia),
   color, esRep, cuando, frecuencia, resp, aux, tareas, tareasOk, voluntarios, cupo, materiales,
   matsOk, notas, nota, cong }. Necesita jsPDF + autoTable y fichas-modelo.js (íconos). */
(function (root) {
  'use strict';
  const esGrupoTxt = (x) => { const l = [...String(x)].filter(c => /\p{L}/u.test(c)).length; return l >= 2 && x.length <= 60 && x === x.toUpperCase(); };
  function dibujar(doc, f) {
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const L = 42, R = W - 42;
    const md = f.md, o = { tareas: f.tareasOk || {}, mats: f.matsOk || {}, nota: f.nota || '' };
    const FM = () => root.FichasModelo || { EPP: {} };
    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const col = hex(f.color || (md && md.color) || '#475569');
    const cong = f.cong || '';
    const ink = () => doc.setTextColor(25, 28, 33), gris = () => doc.setTextColor(110, 116, 125);
    // --- Encabezado (como la ficha oficial)
    const cat = md ? (md.propia ? 'MANTENIMIENTO' : md.cat.toUpperCase()) : (f.esRep ? 'REPARACIÓN' : 'MANTENIMIENTO');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); gris();
    doc.text(`FICHA DE TRABAJO  |  ${cat}`, L, 44, { charSpace: 1.2 });
    const conBadge = md && !md.propia;
    const maxTit = conBadge ? R - 190 - L : R - L;
    doc.setFontSize(21); ink();
    const tit = doc.splitTextToSize(f.titulo || (md && md.nombre) || 'Trabajo', maxTit).slice(0, 2);
    doc.text(tit, L, 70);
    let y = 70 + (tit.length - 1) * 24 + 14;
    doc.setDrawColor(...col); doc.setLineWidth(2.4); doc.line(L, y, L + Math.min(maxTit, 300), y);
    if (conBadge) {
      doc.setFillColor(...col); doc.rect(R - 44, 26, 44, 44, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.text(md.letra, R - 22, 56, { align: 'center' });
      doc.setTextColor(...col); doc.setFontSize(9.5);
      const ms = `MM SECCIÓN ${md.sec}`, cs = 2.2, mw = doc.getTextWidth(ms) + cs * (ms.length - 1);
      doc.text(ms, R - 56 - mw, 52, { charSpace: cs });
    }
    // Protección personal (los mismos íconos de la ficha)
    const epp = (md && md.epp) || [];
    if (epp.length) {
      const sz = 30, gap = 6; let x = R - epp.length * (sz + gap) + gap;
      epp.forEach(k => { const img = FM().EPP[k]; if (img) { try { doc.addImage(img, 'PNG', x, 80, sz, sz); } catch (e) { /* nada */ } } x += sz + gap; });
      y = Math.max(y, 80 + sz);
    }
    y += 16;
    // Advertencia
    const aviso = (md && md.aviso) || [];
    if (aviso.length) {
      doc.setFontSize(9); const ln = doc.splitTextToSize(aviso.join(' '), R - L - 40);
      const h = Math.max(30, ln.length * 11 + 10);
      doc.setFillColor(185, 28, 28); doc.rect(L, y, 22, h, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(15); doc.text('!', L + 11, y + h / 2 + 5, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); ink(); doc.text(ln, L + 30, y + 13);
      y += h + 14;
    }
    // Datos de este trabajo
    const cuando = f.cuando || 'Sin fecha todavía';
    doc.autoTable({ startY: y, margin: { left: L, right: W - R }, theme: 'grid', showHead: false,
      body: [['Cuándo', cuando, 'Frecuencia', f.frecuencia || '—'], ['Responsable', f.resp || '—', 'Auxiliar', f.aux || '—']],
      styles: { fontSize: 9.5, cellPadding: 5, lineColor: [215, 218, 223], textColor: [25, 28, 33] },
      columnStyles: { 0: { fontStyle: 'bold', textColor: [110, 116, 125], cellWidth: 72 }, 2: { fontStyle: 'bold', textColor: [110, 116, 125], cellWidth: 68 } } });
    y = doc.lastAutoTable.finalY + 18;
    const nueva = (need) => { if (y + need > H - 50) { doc.addPage(); y = 50; doc.setFont('helvetica', 'bold'); doc.setFontSize(8); gris(); doc.text(`${(f.titulo || '').toUpperCase()} (continuación)`, L, 34, { charSpace: 1 }); } };
    const caja = (x, yy, ok) => { doc.setDrawColor(150, 155, 162); doc.setLineWidth(0.7); doc.rect(x, yy - 8, 8.5, 8.5); if (ok) { doc.setDrawColor(22, 163, 74); doc.setLineWidth(1.5); doc.line(x + 1.6, yy - 3.6, x + 3.8, yy - 1.4); doc.line(x + 3.8, yy - 1.4, x + 7.4, yy - 6.8); } };
    // Los grupos de la ficha van como en el manual (negrita grande); lo que agrega este trabajo, como etiqueta chica.
    const seccion = (s) => { nueva(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); ink(); doc.text(s, L, y); y += 15; doc.setFont('helvetica', 'normal'); doc.setFontSize(10); };
    const etiqueta = (s) => { nueva(34); y += 4; doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); gris(); doc.text(s, L, y, { charSpace: 0.8 }); doc.setDrawColor(...col); doc.setLineWidth(1.2); doc.line(L, y + 5, L + 46, y + 5); y += 19; doc.setFont('helvetica', 'normal'); doc.setFontSize(10); };
    // Tareas agrupadas
    const tareas = f.tareas || [];
    if (tareas.length) {
      let primero = true;
      tareas.forEach((x, i) => {
        if (esGrupoTxt(x)) { y += primero ? 0 : 6; seccion(x); primero = false; return; }
        if (primero) { seccion('TAREAS'); primero = false; }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        const ln = doc.splitTextToSize(x, R - L - 34);
        nueva(ln.length * 12.5 + 4); ink();
        caja(L + 10, y, !!(o.tareas || {})[i]); doc.text(ln, L + 28, y); y += ln.length * 12.5 + 4;
      });
      y += 8;
    }
    // Voluntarios
    const nombres = f.voluntarios || [], cupo = f.cupo || 0;
    if (cupo || nombres.length) {
      etiqueta(`VOLUNTARIOS${cupo ? ' (' + cupo + ')' : ''}`);
      const n = Math.max(nombres.length, cupo), colW = (R - L) / 2;
      nueva(Math.ceil(n / 2) * 19);
      for (let i = 0; i < n; i++) {
        const x = L + (i % 2) * colW, yy = y + Math.floor(i / 2) * 19;
        gris(); doc.text(`${i + 1}.`, x + 4, yy);
        if (nombres[i]) { ink(); doc.text(nombres[i], x + 20, yy); } else { doc.setDrawColor(205, 208, 213); doc.setLineWidth(0.5); doc.line(x + 20, yy + 2, x + colW - 16, yy + 2); }
      }
      y += Math.ceil(n / 2) * 19 + 8;
    }
    if ((f.materiales || []).length) {
      etiqueta('QUÉ LLEVAR');
      f.materiales.forEach((x, i) => { nueva(14); ink(); caja(L + 10, y, !!(o.mats || {})[i]); doc.text(doc.splitTextToSize(x, R - L - 34), L + 28, y); y += 15; });
      y += 6;
    }
    if (f.notas) { const ln = doc.splitTextToSize(f.notas, R - L); etiqueta('INDICACIONES'); nueva(ln.length * 12.5); ink(); doc.text(ln, L, y); y += ln.length * 12.5 + 8; }
    // Cómo se hizo + firma (al pie), y las notas de la ficha
    const notasF = md && md.notas ? md.notas : '';
    doc.setFontSize(7.8); const nln = notasF ? doc.splitTextToSize(notasF, R - L - 40) : [];
    const pieH = 150 + (nln.length ? nln.length * 9.5 + 10 : 0);
    if (y + pieH > H - 24) { doc.addPage(); y = 50; }
    y = Math.max(y + 6, H - 24 - pieH);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); gris(); doc.text('CÓMO SE HIZO / OBSERVACIONES', L, y, { charSpace: 0.8 });
    doc.setDrawColor(...col); doc.setLineWidth(1.2); doc.line(L, y + 5, L + 46, y + 5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); ink();
    if (o.nota) doc.text(doc.splitTextToSize(o.nota, R - L), L, y + 22);
    doc.setDrawColor(210, 213, 218); doc.setLineWidth(0.5);
    for (let i = 0; i < 3; i++) doc.line(L, y + 26 + i * 19, R, y + 26 + i * 19);
    y += 26 + 3 * 19 + 30;
    doc.setDrawColor(130, 136, 145); doc.line(L, y, L + 190, y); doc.line(R - 190, y, R, y);
    doc.setFontSize(8); gris(); doc.text('Firma del responsable', L, y + 11); doc.text('Fecha en que se hizo', R - 190, y + 11);
    y += 28;
    if (nln.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.8); ink(); doc.text('NOTAS.', L, y, { charSpace: 1 });
      doc.setFont('helvetica', 'normal'); doc.text(nln, L + 40, y); y += nln.length * 9.5;
    }
    doc.setFontSize(7); doc.setTextColor(160, 165, 172);
    doc.text(`${cong ? 'Salón del Reino · ' + cong + ' · ' : ''}Generado con Asignaciones${md && !md.propia ? ' · basada en la ficha ' + md.cod + ' del manual' : ''}`, W / 2, H - 14, { align: 'center' });
  }
  // Limpieza del Salón con varias congregaciones (salon-core tablaLimpieza): una fila por semana y una
  // columna por limpieza y congregación, con el punto del color de cada una. Devuelve dónde terminó.
  function limpieza(doc, tabla, o) {
    const opts = o || {};
    const rgb = (hex) => { const h = String(hex || '#64748B').replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
    const fs = opts.fmtSem || ((m) => `${Number(m.slice(8))}/${Number(m.slice(5, 7))}`);
    const hoyM = opts.hoyM || '';
    const head = [['Semana'].concat(tabla.cols.map(c => c.titulo))];
    const body = tabla.filas.map(f => [fs(f.m)].concat(f.celdas.map(c => c.txt + (c.dias ? '\n' + c.dias : ''))));
    doc.autoTable({ startY: opts.y || 86, margin: { left: 32, right: 32 }, theme: 'grid', head, body,
      headStyles: { fillColor: [15, 27, 45], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      styles: { fontSize: 9, cellPadding: { top: 5, bottom: 5, left: 16, right: 5 } },
      columnStyles: { 0: { cellPadding: 5, fontStyle: 'bold', cellWidth: 46 } },
      didParseCell: (d) => {
        if (d.section !== 'body') return;
        const f = tabla.filas[d.row.index];
        if (hoyM && f && f.m === hoyM) d.cell.styles.fillColor = [255, 248, 230];
        if (d.column.index > 0) { const c = f.celdas[d.column.index - 1]; if (c && c.vacio) d.cell.styles.textColor = [180, 83, 9]; }
      },
      didDrawCell: (d) => {
        if (d.section !== 'body' || d.column.index === 0) return;
        const c = tabla.filas[d.row.index].celdas[d.column.index - 1];
        if (!c || !c.cong || c.vacio) return;
        doc.setFillColor(...rgb(opts.color ? opts.color(c.cong) : null));
        doc.circle(d.cell.x + 8, d.cell.y + 10.5, 3, 'F');
      } });
    return doc.lastAutoTable.finalY + 16;
  }
  root.FichaPdf = { dibujar, esGrupoTxt, limpieza };
})(typeof window !== 'undefined' ? window : this);
