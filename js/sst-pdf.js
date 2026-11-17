// Expide en PDF un registro SST con el membrete de la empresa de la obra, código, versión, número y firmas.
const cargados = {};
function cargarScript(src) {
  return cargados[src] ||= new Promise((ok, mal) => {
    const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => mal(new Error("No se pudo cargar " + src));
    document.head.append(s);
  });
}
const t = v => String(v ?? "").replace(/[–—−]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...")
  .replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[✓✔]/g, "OK").replace(/[✗✘]/g, "X").replace(/·/g, "·").replace(/[^\u0000-ÿ]/g, "").trim();
const fc = iso => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-"); return d ? `${d}/${m}/${y}` : iso; };
const NAVY = [31, 56, 100], CLARO = [232, 238, 246], ROJO = [198, 40, 40], VERDE = [46, 125, 50];

async function blobUrl(blob) { return new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); }); }
async function medidas(url) { return new Promise(ok => { const i = new Image(); i.onload = () => ok({ url, w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => ok(null); i.src = url; }); }

const ESTADOS = { autorizado: "AUTORIZADO", "no autorizado": "NO AUTORIZADO", cerrado: "CERRADO", suspendido: "SUSPENDIDO", guardado: "REGISTRADO", borrador: "BORRADOR" };

export async function pdfRegistro(r, f, d, EMPRESAS) {
  await cargarScript("js/vendor/jspdf.umd.min.js");
  await cargarScript("js/vendor/jspdf.plugin.autotable.min.js");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12, AN = W - 2 * M;
  const o = d.obra, emp = EMPRESAS[o.empresa] || {}, v = r.datos || {};
  let logo = null;
  if (emp.logo) { const b = await fetch(emp.logo).then(x => x.ok ? x.blob() : null).catch(() => null); if (b) logo = await medidas(await blobUrl(b)); }
  const insp = f.grupo === "inspeccion";
  const estadoTxt = insp && r.estado === "autorizado" ? "APTO" : insp && r.estado === "no autorizado" ? "NO APTO" : ESTADOS[r.estado] || "";

  // ---- encabezado: logo | título | código, versión, número
  const encabezado = () => {
    const y0 = 8, alto = 22, c1 = 46, c3 = 46;
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.3);
    doc.rect(M, y0, AN, alto); doc.line(M + c1, y0, M + c1, y0 + alto); doc.line(W - M - c3, y0, W - M - c3, y0 + alto);
    if (logo) { const hh = 15, ww = Math.min(c1 - 6, hh * logo.w / logo.h); doc.addImage(logo.url, "PNG", M + (c1 - ww) / 2, y0 + (alto - hh) / 2, ww, hh); }
    else { doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...NAVY); doc.text(doc.splitTextToSize(t(o.empresa && o.empresa !== "Otra" ? o.empresa : "SG-SST"), c1 - 4), M + c1 / 2, y0 + 10, { align: "center" }); }
    const cx = M + c1 + (AN - c1 - c3) / 2;
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...NAVY);
    doc.text(t([o.empresa && o.empresa !== "Otra" ? o.empresa : "", emp.nit ? "NIT " + emp.nit : ""].filter(Boolean).join(" - ")), cx, y0 + 5, { align: "center" });
    doc.setFontSize(9.5); doc.setTextColor(20);
    const tit = doc.splitTextToSize(t(f.titulo), AN - c1 - c3 - 6).slice(0, 2);
    doc.text(tit, cx, y0 + 10.5, { align: "center" });
    if (f.subtitulo) { doc.setFontSize(8); doc.setTextColor(...NAVY); doc.text(doc.splitTextToSize(t(f.subtitulo), AN - c1 - c3 - 6)[0], cx, y0 + 11 + tit.length * 4.2, { align: "center" }); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(30);
    const xr = W - M - c3 + 3;
    doc.text(`Código: ${t(f.codigo)}`, xr, y0 + 5.5); doc.text("Versión: 01", xr, y0 + 10);
    doc.text(t(f.sub || "SG-SST"), xr, y0 + 14.5);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY); doc.text(`N.º ${r.numero}`, xr, y0 + 19);
  };
  const pie = () => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(120);
    doc.text(t(`Registro del SG-SST · ${o.nombre || ""} · Estado: ${estadoTxt}`).slice(0, 120), M, H - 6);
    doc.text(`Página ${doc.getCurrentPageInfo().pageNumber} de {total}`, W - M, H - 6, { align: "right" });
  };
  const comun = { rowPageBreak: "avoid", margin: { top: 34, left: M, right: M, bottom: 12 }, didDrawPage: () => { encabezado(); pie(); }, theme: "grid",
    styles: { font: "helvetica", fontSize: 7.8, cellPadding: 1.3, textColor: 25, lineColor: [190, 196, 208], lineWidth: 0.15, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5 } };
  let y = 34;
  const tabla = (opts) => { doc.autoTable({ ...comun, startY: y, ...opts, didDrawCell: opts.didDrawCell }); y = doc.lastAutoTable.finalY + 3; };
  const tituloSec = txt => { if (!txt) return; tabla({ body: [[{ content: t(txt), styles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8.3 } }]] }); y -= 3; };
  const parrafo = (txt, opts = {}) => {
    doc.setFont("helvetica", opts.negrita ? "bold" : "italic"); doc.setFontSize(opts.tam || 7.5); doc.setTextColor(...(opts.color || [70, 70, 70]));
    const ls = doc.splitTextToSize(t(txt), AN);
    if (y + ls.length * 3.4 > H - 14) { doc.addPage(); y = 34; }
    doc.text(ls, M, y + 3); y += ls.length * 3.4 + 2.5;
  };
  // imágenes dentro de celdas (firmas)
  const dibujarImg = data => { const im = data.cell.raw?.img; if (!im || data.section !== "body") return;
    const c = data.cell, hh = Math.min(c.height - 1.5, (c.width - 2) / 2.5), ww = hh * 2.5;
    try { doc.addImage(im, "PNG", c.x + (c.width - ww) / 2, c.y + (c.height - hh) / 2, ww, hh); } catch (e) { console.warn(e); } };
  const celdaFirma = img => img ? { content: "", img, styles: { minCellHeight: 13 } } : { content: "", styles: { minCellHeight: 13 } };

  if (f.nota) parrafo(f.nota);
  const verCierre = r.estado === "cerrado" || r.formato === "FO-12";
  for (const s of f.secciones) {
    if (s.cierre && !verCierre) continue;
    tituloSec(s.titulo);
    let simples = [];
    const volcar = () => {
      if (!simples.length) return;
      const body = []; let fila = [];
      for (const c of simples) {
        const val = valorTexto(c, v);
        const ancho = c.t === "area" || c.t === "marcas" || val.length > 45;
        const lab = { content: t(c.l), styles: { fontStyle: "bold", fillColor: CLARO, cellWidth: 34 } };
        if (ancho) { if (fila.length) { fila.push({ content: "", colSpan: 2 }); body.push(fila); fila = []; } body.push([lab, { content: t(val), colSpan: 3 }]); }
        else { fila.push(lab, { content: t(val) }); if (fila.length === 4) { body.push(fila); fila = []; } }
      }
      if (fila.length) { fila.push({ content: "", colSpan: 2 }); body.push(fila); }
      tabla({ body, columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: AN / 2 - 34 }, 2: { cellWidth: 34 }, 3: { cellWidth: AN / 2 - 34 } } });
      simples = [];
    };
    for (const c of s.campos) {
      if (["texto", "num", "fecha", "hora", "area", "sel", "marcas", "trabajador"].includes(c.t)) { simples.push(c); continue; }
      volcar();
      if (c.t === "nota") parrafo(c.l);
      else if (c.t === "lista") {
        const resp = v[c.k] || {}; let n = 0; const body = [];
        c.items.forEach((it, i) => {
          if (it.startsWith("#")) { body.push([{ content: t(it.slice(1).trim()), colSpan: 3 + c.op.length, styles: { fontStyle: "bold", fillColor: CLARO, textColor: NAVY } }]); return; }
          n++; const crit = it.endsWith(" *"), val = resp[i]?.v || "", malo = c.malo && val === c.malo;
          body.push([String(n), t(it.replace(/ \*$/, "")) + (crit ? " (*)" : ""), ...c.op.map(op => ({ content: val === op ? "X" : "", styles: { halign: "center", fontStyle: "bold", textColor: malo && val === op ? ROJO : 25 } })), t(resp[i]?.o || "")]);
        });
        tabla({ head: [["N.º", "Ítem a verificar", ...c.op, c.serial ? "Serial / observación" : "Observación"]], body,
          columnStyles: { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: AN - 8 - c.op.length * 9 - 40 }, ...Object.fromEntries(c.op.map((_, j) => [2 + j, { cellWidth: 9 }])), [2 + c.op.length]: { cellWidth: 40 } } });
        if (c.malo) parrafo(`(*) Ítem crítico: si queda en "${c.malo}" la tarea o el equipo no se autoriza.`);
      } else if (c.t === "tabla") {
        const filas = (v[c.k] || []).filter(x => Object.values(x).some(Boolean));
        tabla({ head: [["N.º", ...c.cols.map(col => t(col.l))]], body: filas.length ? filas.map((x, i) => [String(i + 1), ...c.cols.map(col => t(col.t === "fecha" ? fc(x[col.k]) : x[col.k] || ""))]) : [[{ content: "Sin registros", colSpan: c.cols.length + 1, styles: { textColor: 120 } }]],
          columnStyles: { 0: { cellWidth: 8, halign: "center" } } });
      } else if (c.t === "inventario") {
        const inv = v[c.k] || {};
        tabla({ head: [["Elemento", "Mínimo", "Encontrada", "Vencimiento", "B", "M"]], body: c.items.map(([el, min], i) => { const x = inv[i] || {};
          return [t(el), min, x.cant || "", fc(x.vence), { content: x.e === "B" ? "X" : "", styles: { halign: "center" } }, { content: x.e === "M" ? "X" : "", styles: { halign: "center", textColor: ROJO, fontStyle: "bold" } }]; }),
          columnStyles: { 1: { cellWidth: 16 }, 2: { cellWidth: 20 }, 3: { cellWidth: 22 }, 4: { cellWidth: 8 }, 5: { cellWidth: 8 } } });
      } else if (c.t === "gases") {
        const fl = (v[c.k] || []).filter(m => m.o2 || m.hora);
        tabla({ head: [["Momento / punto", "Hora", "O2 (%)", "LIE (%)", "H2S (ppm)", "CO (ppm)", "Medido por"]], body: fl.length ? fl.map(m => [t(m.punto), m.hora || "", m.o2 || "", m.lie || "", m.h2s || "", m.co || "", t(m.medido)]) : [[{ content: "Sin mediciones", colSpan: 7 }]] });
        parrafo("Aceptable: O2 19,5 a 23,5 % · LIE < 10 % · H2S < 10 ppm · CO < 25 ppm.");
      } else if (c.t === "personal") {
        const lista = v[c.k] || []; const fk = (c.firmas || []).filter(x => x !== "cierre" || verCierre);
        const nomF = { firma: "Firma", inicio: "Firma inicio", cierre: "Firma cierre", instala: "Firma instalación", retiro: "Firma retiro" };
        tabla({ head: [["N.º", "Nombre", "C.C.", "Cargo", ...(c.cols || []).map(x => t(x.l)), ...fk.map(x => nomF[x] || x)]],
          body: lista.length ? lista.map((p, i) => [String(i + 1), t(p.nombre), t(p.cc), t(p.cargo), ...(c.cols || []).map(x => t(p[x.k] ?? (x.def === "empresa" ? o.empresa : ""))), ...fk.map(x => celdaFirma(r.firmas?.[`${c.k}.${p.id}.${x}`]))])
            : [[{ content: "Sin personas", colSpan: 4 + (c.cols || []).length + fk.length }]],
          columnStyles: { 0: { cellWidth: 8, halign: "center" }, ...Object.fromEntries(fk.map((_, j) => [4 + (c.cols || []).length + j, { cellWidth: 32 }])) }, didDrawCell: dibujarImg });
      } else if (c.t === "fotos") {
        for (const src of v[c.k] || []) { const im = await medidas(src); if (!im) continue; const ww = Math.min(90, AN), hh = ww * im.h / im.w;
          if (y + hh > H - 14) { doc.addPage(); y = 34; } doc.addImage(im.url, "JPEG", M, y, ww, hh); y += hh + 3; }
      } else if (c.t === "decision") {
        const ok = r.estado === "autorizado" || r.estado === "cerrado";
        const txt = ok ? (insp ? "RESULTADO: APTO PARA OPERAR" : "DECISIÓN: SE AUTORIZA LA TAREA") : r.estado === "no autorizado" ? (insp ? "RESULTADO: NO APTO - Fuera de servicio" : "DECISIÓN: NO SE AUTORIZA LA TAREA") : `ESTADO: ${estadoTxt}`;
        const motivos = r.estado === "no autorizado" ? (r.motivos || []) : [];
        tabla({ body: [[{ content: t(txt) + (r.fechaDecision ? `   (${fc(r.fechaDecision.slice(0, 10))} ${new Date(r.fechaDecision).toTimeString().slice(0, 5)})` : ""), styles: { fontStyle: "bold", fontSize: 9, textColor: ok ? VERDE : ROJO, fillColor: ok ? [232, 245, 233] : [253, 236, 234] } }],
          ...motivos.map(m => [t("• " + m)])] });
      } else if (c.t === "firmas") {
        tabla({ head: [["Rol", "Nombre", "C.C.", "Firma"]], body: c.roles.map(rol => [t(rol.l) + (rol.cert && v[`${c.k}.${rol.k}.cert`] ? `\n${t(rol.cert)}: ${t(v[`${c.k}.${rol.k}.cert`])}` : ""),
          t(v[`${c.k}.${rol.k}.nombre`]), t(v[`${c.k}.${rol.k}.cc`]), celdaFirma(r.firmas?.[`${c.k}.${rol.k}`])]),
          columnStyles: { 0: { cellWidth: 70 }, 2: { cellWidth: 24 }, 3: { cellWidth: 42 } }, didDrawCell: dibujarImg });
      }
    }
    volcar();
    y += 1;
  }
  if (r.estado === "suspendido" && r.suspension) tabla({ body: [[{ content: t(`PERMISO SUSPENDIDO a las ${r.suspension.hora}. Motivo: ${r.suspension.motivo}. Para reanudar se expide un permiso nuevo.`), styles: { textColor: ROJO, fontStyle: "bold" } }]] });
  doc.putTotalPages?.("{total}");
  const nombre = `${f.codigo}${f.lista ? "-L" + f.lista : f.hoja ? "-H" + f.hoja : ""} N${r.numero} ${(o.nombre || "obra").replace(/[\\/:*?"<>|]/g, "").slice(0, 40)} ${v.fecha || ""}.pdf`.replace(/\s+/g, " ");
  return { blob: doc.output("blob"), nombre };
}

function valorTexto(c, v) {
  const x = v[c.k];
  if (c.t === "fecha") return fc(x);
  if (c.t === "marcas") return (x || []).join(", ");
  if (c.t === "trabajador") return x ? [x.nombre, x.cc ? "C.C. " + x.cc : "", x.cargo].filter(Boolean).join(" · ") : "";
  return x == null ? "" : String(x);
}
