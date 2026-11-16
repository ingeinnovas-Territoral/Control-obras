// Llena el Excel CONTROL DE OBRA del usuario con lo registrado en la app.
// Solo toca las celdas de captura de las hojas diarias (BITACORA, ACTIVIDADES, GASTOS, PERSONAL).
// Fórmulas, formatos, listas, actas, memorias y macros quedan como estaban.

const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_XML = "http://www.w3.org/XML/1998/namespace";
const sinTilde = t => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const nombreHoja = n => sinTilde(n).replace(/^[\d.\-)\s]+/, "").trim();
const letra = i => { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const numCol = L => L.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

// Cada bloque: hoja, texto de la columna A que marca la fila de títulos y las columnas que llena la app (clave → inicio del título).
export const HOJAS = {
  CONTRATOS: { hoja: "GASTOS", capacidad: 15, ancla: "N.º", cols: { tipo: "TIPO", objeto: "OBJETO", contratista: "CONTRATISTA", fechaLimite: "FECHA LIMITE", valor: "VALOR PACTADO" } },
  BITACORA: { capacidad: 400, ancla: "FECHA", cols: { fecha: "FECHA", jornada: "JORNADA", horas: "HORAS", clima: "CONDICION", precipitacion: "PRECIPITACION",
    afecto: "¿AFECTO", ausentes: "AUSENTES", charla: "CHARLA", epp: "USO DE EPP", incidentes: "INCIDENTES", ambiental: "MANEJO AMBIENTAL", novedades: "NOVEDADES" } },
  ACTIVIDADES: { capacidad: 1500, ancla: "FECHA", cols: { fecha: "FECHA", actividad: "ACTIVIDAD", cantidad: "CANTIDAD", frente: "DETALLE", equipo: "EQUIPO" } },
  GASTOS: { capacidad: 1000, ancla: "FECHA", cols: { fecha: "FECHA", tipo: "TIPO", detalle: "DETALLE", proveedor: "PROVEEDOR", factura: "NO. FACTURA",
    valor: "VALOR", item: "ITEM", inversionista: "INVERSIONISTA", otro: "SI ES OTRO", abonoA: "ABONO" } },
  PERSONAL: { capacidad: 40, ancla: "CARGO", cols: { cargo: "CARGO", nombre: "NOMBRE", cant: "CANT" } },
};

export async function llenarExcel(buf, datos) {
  const XLSX = window.XLSX, JSZip = window.JSZip;
  const libro = XLSX.read(buf, { type: "array", bookSheets: false, cellFormula: false });
  const zip = await JSZip.loadAsync(buf);
  const P = new DOMParser(), S = new XMLSerializer();
  const leer = async path => P.parseFromString(await zip.file(path).async("string"), "application/xml");
  const wbx = await leer("xl/workbook.xml");
  const rels = await leer("xl/_rels/workbook.xml.rels");
  const NS = wbx.documentElement.namespaceURI;
  const hojasWb = [...wbx.getElementsByTagNameNS(NS, "sheet")];
  const informe = [], faltan = [];

  for (const [clave, conf] of Object.entries(HOJAS)) {
    const filas = datos[clave] || [];
    if (!filas.length && conf.hoja && !datos[clave]) continue;
    const sh = hojasWb.find(s => nombreHoja(s.getAttribute("name")) === (conf.hoja || clave));
    if (!sh) { informe.push(`${clave}: no está en el archivo`); faltan.push(clave); continue; }
    const nombre = sh.getAttribute("name");
    // fila de títulos y columnas (con SheetJS, que ya resuelve textos compartidos)
    const aoa = XLSX.utils.sheet_to_json(libro.Sheets[nombre], { header: 1, raw: true, defval: "" });
    const ancla = sinTilde(conf.ancla).replace(/[º°]/g, "O").replace(/\s/g, "");
    const hr = aoa.findIndex(f => sinTilde(f[0]).replace(/[º°]/g, "O").replace(/\s/g, "") === ancla && (clave !== "GASTOS" || sinTilde(f[1]).startsWith("TIPO")));
    if (hr < 0) { informe.push(`${clave}: no encontré los títulos`); faltan.push(clave); continue; }
    const col = {};
    for (const [k, pref] of Object.entries(conf.cols)) {
      const i = aoa[hr].findIndex(t => sinTilde(t).startsWith(pref));
      if (i >= 0) col[k] = letra(i);
    }
    const r0 = hr + 2, rMax = hr + 1 + conf.capacidad;   // filas de Excel (base 1)
    if (filas.length > conf.capacidad) throw new Error(`La hoja ${nombre} admite ${conf.capacidad} filas y la app tiene ${filas.length}.`);
    const rid = sh.getAttributeNS(NS_R, "id");
    const rel = [...rels.getElementsByTagName("Relationship")].find(r => r.getAttribute("Id") === rid);
    const t = rel.getAttribute("Target"); const path = t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, "");
    const doc = await leer(path);
    const sd = doc.getElementsByTagNameNS(NS, "sheetData")[0];
    const filasEl = new Map([...sd.getElementsByTagNameNS(NS, "row")].map(r => [Number(r.getAttribute("r")), r]));
    const letras = Object.values(col);
    const celda = (row, ref) => [...row.getElementsByTagNameNS(NS, "c")].find(c => c.getAttribute("r") === ref);
    const tieneFormula = c => c && c.getElementsByTagNameNS(NS, "f").length > 0;
    // estilo de referencia por columna (primera fila de datos)
    const estilo = {};
    for (const L of letras) { const c = filasEl.get(r0) && celda(filasEl.get(r0), L + r0); if (c?.getAttribute("s")) estilo[L] = c.getAttribute("s"); }
    // última fila con datos de captura ya escritos (para limpiar sobrantes)
    let ultima = r0 - 1;
    for (const [r, row] of filasEl) if (r >= r0 && r <= rMax) for (const L of letras) {
      const c = celda(row, L + r); if (c && !tieneFormula(c) && (c.getElementsByTagNameNS(NS, "v").length || c.getElementsByTagNameNS(NS, "is").length)) ultima = Math.max(ultima, r);
    }
    const hasta = Math.max(ultima, r0 + filas.length - 1);
    for (let r = r0; r <= hasta; r++) {
      const vals = filas[r - r0] || {};
      let row = filasEl.get(r);
      if (!row) {
        if (!Object.values(vals).some(v => v !== "" && v != null)) continue;
        row = doc.createElementNS(NS, "row"); row.setAttribute("r", r);
        const sig = [...filasEl.keys()].filter(k => k > r).sort((a, b) => a - b)[0];
        sd.insertBefore(row, sig ? filasEl.get(sig) : null); filasEl.set(r, row);
      }
      for (const [k, L] of Object.entries(col)) {
        const ref = L + r; let c = celda(row, ref);
        if (tieneFormula(c)) continue;
        const v = vals[k];
        const vacio = v === "" || v == null || (typeof v === "number" && !isFinite(v));
        if (!c) {
          if (vacio) continue;
          c = doc.createElementNS(NS, "c"); c.setAttribute("r", ref); if (estilo[L]) c.setAttribute("s", estilo[L]);
          const sig = [...row.getElementsByTagNameNS(NS, "c")].find(x => numCol(x.getAttribute("r").replace(/\d+/g, "")) > numCol(L));
          row.insertBefore(c, sig || null);
        }
        while (c.firstChild) c.removeChild(c.firstChild);
        c.removeAttribute("t");
        if (vacio) continue;
        if (typeof v === "number") { const e = doc.createElementNS(NS, "v"); e.textContent = String(v); c.append(e); }
        else {
          c.setAttribute("t", "inlineStr");
          const is = doc.createElementNS(NS, "is"), te = doc.createElementNS(NS, "t");
          te.setAttributeNS(NS_XML, "xml:space", "preserve"); te.textContent = String(v);
          is.append(te); c.append(is);
        }
      }
    }
    zip.file(path, S.serializeToString(doc));
    informe.push(`${nombre}: ${filas.length} fila(s)`);
  }
  // quitar los resultados guardados de las fórmulas: así Excel, Numbers o LibreOffice las recalculan al abrir
  // (menos en las hojas que la app lee al importar: INICIO y PRESUPUESTO no cambian y necesitan sus valores)
  const rutaDe = sh => { const rid = sh.getAttributeNS(NS_R, "id"); const t = [...rels.getElementsByTagName("Relationship")].find(r => r.getAttribute("Id") === rid)?.getAttribute("Target") || "";
    return t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, ""); };
  const conservar = new Set(hojasWb.filter(sh => ["INICIO", "PRESUPUESTO", "CARGAR PRESUPUESTO"].includes(nombreHoja(sh.getAttribute("name")))).map(rutaDe));
  for (const path of Object.keys(zip.files).filter(n => /^xl\/worksheets\/[^/]+\.xml$/.test(n) && !conservar.has(n))) {
    const xml = await zip.file(path).async("string");
    const limpio = xml.replace(/(<c\b[^>]*>)(<f\b[^>]*\/>|<f\b[^>]*>[\s\S]*?<\/f>)<v>[\s\S]*?<\/v>/g, "$1$2");
    if (limpio !== xml) zip.file(path, limpio);
  }
  // que Excel recalcule todo al abrir
  const calc = wbx.getElementsByTagNameNS(NS, "calcPr")[0];
  if (calc) { calc.setAttribute("fullCalcOnLoad", "1"); zip.file("xl/workbook.xml", S.serializeToString(wbx)); }
  const macros = !!zip.file("xl/vbaProject.bin");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE",
    mimeType: macros ? "application/vnd.ms-excel.sheet.macroEnabled.12" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return { blob, informe, faltan };
}
