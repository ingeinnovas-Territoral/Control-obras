// Informe en PDF de gastos y compromisos de la obra (el mismo que exportaba el botón del Excel).
// Se arma en el celular, sin internet, con jsPDF.

const cargados = {};
function cargarScript(src) {
  return cargados[src] ||= new Promise((ok, mal) => {
    const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => mal(new Error("No se pudo cargar " + src));
    document.head.append(s);
  });
}
// Las fuentes estándar del PDF no traen algunos signos: se cambian por equivalentes.
const t = v => String(v ?? "").replace(/[–—−]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/…/g, "...").replace(/[^\u0000-ÿ]/g, "").trim();
const pesos = n => (n < 0 ? "-$ " : "$ ") + Math.abs(Math.round(n || 0)).toLocaleString("es-CO");
const fechaCorta = iso => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
const NAVY = [31, 56, 100], CLARO = [232, 238, 246], AMARILLO = [255, 242, 179], ROJO = [198, 40, 40];

async function imagenDatos(blob) {
  const url = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
  const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
  return { url, w: img.naturalWidth, h: img.naturalHeight };
}

// d: datos de cargarObra; gastos y contratos (con abonado/saldo/estado) ya calculados; membrete: { empresa, nit, lema, logo(blob) }
export async function informeGastosPDF({ d, gastos, filasContratos, porPagar, membrete }) {
  await cargarScript("js/vendor/jspdf.umd.min.js");
  await cargarScript("js/vendor/jspdf.plugin.autotable.min.js");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12;
  const o = d.obra;
  const logo = membrete.logo ? await imagenDatos(membrete.logo).catch(() => null) : null;
  const hoyIso = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

  // ---- cifras (igual que la macro del Excel)
  const totG = gastos.reduce((s, g) => s + (Number(g.valor) || 0), 0);
  const norm = x => t(x).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  let tH = 0, tA = 0, tS = 0; const otros = new Map();
  for (const g of gastos) {
    const v = Number(g.valor) || 0, inv = norm(g.inversionista);
    if (inv === "hector suarez") tH += v; else if (inv === "andres correa") tA += v;
    else if (inv === "otro") { const n = t(g.otro) || "Otro (sin nombre)"; otros.set(n, (otros.get(n) || 0) + v); }
    else tS += v;
  }
  const vC = d.cd * d.factor, vE = d.cdEj * d.factor, util = vE - totG - porPagar;

  // ---- encabezado y pie en cada página
  const encabezado = () => {
    if (logo) { const h = 15, w = Math.min(60, h * logo.w / logo.h); doc.addImage(logo.url, "PNG", M, 8, w, h); }
    else { doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY); doc.text(t(membrete.empresa), M, 16); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...NAVY);
    if (membrete.nit) doc.text(t(membrete.nit), W - M, 12, { align: "right" });
    doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(90);
    if (membrete.lema) doc.text(t(membrete.lema), W - M, 16.5, { align: "right" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY);
    doc.text("RELACIÓN DE GASTOS Y COMPROMISOS DE LA OBRA", W / 2, 29, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40);
    const linea = t([o.nombre, o.contrato ? "Contrato " + o.contrato : ""].filter(Boolean).join("   ·   "));
    doc.text(doc.splitTextToSize(linea, W - 2 * M).slice(0, 2), W / 2, 34, { align: "center" });
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.4); doc.line(M, 39.5, W - M, 39.5);
  };
  const pie = () => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120);
    doc.text(`Fecha de corte: ${fechaCorta(hoyIso)}`, M, H - 7);
    doc.text(`Página ${doc.getCurrentPageInfo().pageNumber} de {total}`, W - M, H - 7, { align: "right" });
  };
  const comun = { margin: { top: 44, left: M, right: M, bottom: 14 }, didDrawPage: () => { encabezado(); pie(); },
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.6, textColor: 30, lineColor: [200, 205, 215], lineWidth: 0.15, overflow: "linebreak" },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8 } };
  let y = 44;
  const titulo = txt => ({ content: t(txt), colSpan: 2, styles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 9.5 } });
  const resumen = (tit, filas) => {
    doc.autoTable({ ...comun, startY: y, theme: "grid", tableWidth: 150, body: [[titulo(tit)], ...filas.map(f => [
      { content: t(f[0]), styles: { fontStyle: f[2]?.negrita ? "bold" : "normal", fillColor: f[2]?.claro ? CLARO : 255, textColor: f[2]?.rojo ? ROJO : 30, cellPadding: { left: f[2]?.sangria ? 8 : 1.6, top: 1.6, bottom: 1.6, right: 1.6 } } },
      { content: f[1], styles: { halign: "right", fontStyle: f[2]?.negrita ? "bold" : "normal", fillColor: f[2]?.claro ? CLARO : 255, textColor: f[2]?.rojo ? ROJO : 30 } }])],
      columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 40 } } });
    y = doc.lastAutoTable.finalY + 6;
  };

  // ---- 1) resumen
  const filasRes = [["Total invertido (gastos pagados)", pesos(totG), { negrita: true }],
    ["Aportado por Héctor Suárez", pesos(tH), { sangria: true }], ["Aportado por Andrés Correa", pesos(tA), { sangria: true }],
    ...[...otros].map(([n, v]) => ["Aportado por " + n, pesos(v), { sangria: true }])];
  if (tS) filasRes.push(["Sin inversionista asignado", pesos(tS), { sangria: true }]);
  filasRes.push(["Por pagar (saldos de contratos y compromisos)", pesos(porPagar), { negrita: true }],
    ["TOTAL COMPROMETIDO (invertido + por pagar)", pesos(totG + porPagar), { negrita: true, claro: true }]);
  resumen("RESUMEN", filasRes);

  // ---- 2) utilidad
  resumen("RESUMEN DE UTILIDAD", [["Valor del contrato", pesos(vC)], ["Ejecutado a la fecha (con AIU)", pesos(vE)],
    ["(-) Gastado (ya pagado)", pesos(totG)], ["(-) Por pagar (saldos de contratos)", pesos(porPagar)],
    ["UTILIDAD REAL A LA FECHA", pesos(util), { negrita: true, claro: true, rojo: util < 0 }],
    ["Margen sobre lo ejecutado", vE ? (util / vE * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + " %" : "0 %"]]);

  // ---- 3) contratos
  const seccion = txt => { if (y > H - 40) { doc.addPage(); y = 44; }
    doc.autoTable({ ...comun, startY: y, theme: "plain", body: [[{ content: t(txt), styles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 9.5 } }]] });
    y = doc.lastAutoTable.finalY; };
  seccion(`CONTRATOS Y COMPROMISOS (${filasContratos.length})`);
  if (!filasContratos.length) {
    doc.autoTable({ ...comun, startY: y, theme: "plain", body: [[{ content: "No hay contratos ni compromisos registrados.", styles: { fontStyle: "italic" } }]] });
  } else {
    doc.autoTable({ ...comun, startY: y, theme: "grid",
      head: [["N.º", "TIPO", "OBJETO", "CONTRATISTA / ACREEDOR", "FECHA LÍMITE", "VALOR PACTADO", "ABONADO", "SALDO", "ESTADO"]],
      body: filasContratos.map(f => [f.c.numero, t(f.c.tipo), t(f.c.objeto), t(f.c.contratista), fechaCorta(f.c.fechaLimite),
        pesos(f.c.valor), pesos(f.abonado), pesos(Math.max(0, f.saldo)), t(f.estado[0])]),
      foot: [[{ content: "Total por pagar", colSpan: 7, styles: { halign: "right" } }, { content: pesos(porPagar), styles: { halign: "right" } }, ""]],
      footStyles: { fillColor: CLARO, textColor: 30, fontStyle: "bold" }, showFoot: "lastPage",
      columnStyles: { 0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: 26 }, 4: { cellWidth: 20, halign: "center" }, 5: { cellWidth: 26, halign: "right" },
        6: { cellWidth: 26, halign: "right" }, 7: { cellWidth: 26, halign: "right" }, 8: { cellWidth: 26 } },
      didParseCell: c => { if (c.section === "body" && !/pagado/i.test(filasContratos[c.row.index].estado[0])) c.cell.styles.fillColor = AMARILLO; } });
  }
  y = doc.lastAutoTable.finalY + 6;

  // ---- 4) detalle de gastos
  seccion(`DETALLE DE GASTOS PAGADOS (${gastos.length})`);
  const nombreC = new Map(filasContratos.map(f => [f.c.id, `${f.c.numero} - ${f.c.contratista}`]));
  doc.autoTable({ ...comun, startY: y, theme: "grid",
    head: [["FECHA", "TIPO", "DETALLE", "PROVEEDOR / BENEFICIARIO", "FACTURA", "VALOR", "INVERSIONISTA", "ABONO A"]],
    body: gastos.map(g => [fechaCorta(g.fecha), t(g.tipo), t(g.detalle), t(g.proveedor), t(g.factura), pesos(g.valor),
      t(norm(g.inversionista) === "otro" && t(g.otro) ? g.otro : g.inversionista), t(nombreC.get(g.contratoId) || g.abonoA || "")]),
    foot: [[{ content: "Total gastos pagados", colSpan: 5, styles: { halign: "right" } }, { content: pesos(totG), styles: { halign: "right" } }, "", ""]],
    footStyles: { fillColor: CLARO, textColor: 30, fontStyle: "bold" }, showFoot: "lastPage",
    columnStyles: { 0: { cellWidth: 19, halign: "center" }, 1: { cellWidth: 24 }, 4: { cellWidth: 20 }, 5: { cellWidth: 26, halign: "right" }, 6: { cellWidth: 28 }, 7: { cellWidth: 32 } } });

  if (typeof doc.putTotalPages === "function") doc.putTotalPages("{total}");
  const nombre = `Gastos - Contrato ${t(o.contrato || o.nombre).replace(/[\\/:*?"<>|]/g, "").slice(0, 40)} - ${hoyIso}.pdf`;
  return { blob: doc.output("blob"), nombre };
}
