// Llena el Excel CONTROL DE OBRA del usuario con lo registrado en la app.
// Solo toca celdas de captura (las que el usuario llena a mano). Fórmulas, formatos, listas,
// actas, memorias, tablero y macros quedan como estaban.

const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_XML = "http://www.w3.org/XML/1998/namespace";
export const sinTilde = t => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
export const nombreHoja = n => sinTilde(n).replace(/^[\d.\-)\s]+/, "").trim();
const letra = i => { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const numCol = L => L.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const limpiarTexto = v => String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "").slice(0, 32000);
const anclaNorm = t => sinTilde(t).replace(/[º°]/g, "O").replace(/\s/g, "");

// Bloques de captura: hoja, texto de la columna A en la fila de títulos y columnas que llena la app (clave → inicio del título).
export const HOJAS = {
  CONTRATOS: { hoja: "GASTOS", capacidad: 15, ancla: "N.º", cols: { tipo: "TIPO", objeto: "OBJETO", contratista: "CONTRATISTA", fechaLimite: "FECHA LIMITE", valor: "VALOR PACTADO" } },
  BITACORA: { capacidad: 400, ancla: "FECHA", cols: { fecha: "FECHA", jornada: "JORNADA", horas: "HORAS", clima: "CONDICION", precipitacion: "PRECIPITACION",
    afecto: "¿AFECTO", ausentes: "AUSENTES", charla: "CHARLA", epp: "USO DE EPP", incidentes: "INCIDENTES", ambiental: "MANEJO AMBIENTAL", novedades: "NOVEDADES" } },
  ACTIVIDADES: { capacidad: 1500, ancla: "FECHA", cols: { fecha: "FECHA", actividad: "ACTIVIDAD", cantidad: "CANTIDAD", frente: "DETALLE", equipo: "EQUIPO" } },
  GASTOS: { capacidad: 1000, ancla: "FECHA", segunda: "TIPO", cols: { fecha: "FECHA", tipo: "TIPO", detalle: "DETALLE", proveedor: "PROVEEDOR", factura: "NO. FACTURA",
    valor: "VALOR", item: "ITEM", inversionista: "INVERSIONISTA", otro: "SI ES OTRO", abonoA: "ABONO" } },
  PERSONAL: { capacidad: 40, ancla: "CARGO", cols: { cargo: "CARGO", nombre: "NOMBRE", cant: "CANT" } },
};
// Datos de la obra en INICIO: etiqueta de la columna A → valor en la columna B
export const ETIQUETAS_INICIO = { nombre: "OBJETO", contrato: "CONTRATO NO", entidad: "ENTIDAD", municipio: "MUNICIPIO", depto: "DEPARTAMENTO",
  inicio: "FECHA DE INICIO", plazo: "PLAZO", empresa: "CONTRATISTA", residente: "FIRMA 1 – NOMBRE", supervisor: "FIRMA 3 – NOMBRE" };

export async function llenarExcel(buf, datos) {
  const XLSX = window.XLSX, JSZip = window.JSZip;
  const libro = XLSX.read(buf, { type: "array", cellFormula: false });
  const zip = await JSZip.loadAsync(buf);
  const P = new DOMParser(), S = new XMLSerializer();
  const leerXml = async path => P.parseFromString(await zip.file(path).async("string"), "application/xml");
  const wbx = await leerXml("xl/workbook.xml");
  const rels = await leerXml("xl/_rels/workbook.xml.rels");
  const NS = wbx.documentElement.namespaceURI;
  const hojasWb = [...wbx.getElementsByTagNameNS(NS, "sheet")];
  const rutaDe = sh => { const rid = sh.getAttributeNS(NS_R, "id"); const t = [...rels.getElementsByTagName("Relationship")].find(r => r.getAttribute("Id") === rid)?.getAttribute("Target") || "";
    return t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, ""); };
  const hojaPor = nombre => hojasWb.find(s => nombreHoja(s.getAttribute("name")) === nombre);
  const informe = [], faltan = [], avisos = [];
  const docs = new Map();                       // ruta → documento XML (se escribe una sola vez al final)
  const docDe = async sh => { const p = rutaDe(sh); if (!docs.has(p)) docs.set(p, await leerXml(p)); return docs.get(p); };
  const aoaDe = sh => XLSX.utils.sheet_to_json(libro.Sheets[sh.getAttribute("name")], { header: 1, raw: true, defval: "" });

  // utilidades sobre una hoja
  const herramientas = doc => {
    const sd = doc.getElementsByTagNameNS(NS, "sheetData")[0];
    const filasEl = new Map([...sd.getElementsByTagNameNS(NS, "row")].map(r => [Number(r.getAttribute("r")), r]));
    const celda = (r, L) => { const row = filasEl.get(r); return row ? [...row.getElementsByTagNameNS(NS, "c")].find(c => c.getAttribute("r") === L + r) : null; };
    const formula = c => c ? c.getElementsByTagNameNS(NS, "f")[0] || null : null;
    const tieneValor = c => c && (c.getElementsByTagNameNS(NS, "v").length || c.getElementsByTagNameNS(NS, "is").length);
    const fila = r => {
      let row = filasEl.get(r);
      if (!row) {
        row = doc.createElementNS(NS, "row"); row.setAttribute("r", r);
        const sig = [...filasEl.keys()].filter(k => k > r).sort((a, b) => a - b)[0];
        sd.insertBefore(row, sig ? filasEl.get(sig) : null); filasEl.set(r, row);
      }
      return row;
    };
    // escribe un valor; devuelve false si la celda tiene una fórmula que no se debe tocar
    const escribir = (r, L, v, estilo) => {
      const vacio = v === "" || v == null || (typeof v === "number" && !isFinite(v));
      let c = celda(r, L);
      const f = formula(c);
      if (f) {
        if (f.getAttribute("t") === "shared" || f.getAttribute("t") === "array") return false;     // nunca romper fórmulas compartidas
        const cache = c.getElementsByTagNameNS(NS, "v")[0]?.textContent;
        if (!vacio && cache != null && (typeof v === "number" ? Math.abs(Number(cache) - v) < 0.005 : cache === String(v))) return true;   // fórmula escrita a mano con el mismo resultado: se conserva
      }
      if (!c) {
        if (vacio) return true;
        const row = fila(r);
        c = doc.createElementNS(NS, "c"); c.setAttribute("r", L + r); if (estilo) c.setAttribute("s", estilo);
        const sig = [...row.getElementsByTagNameNS(NS, "c")].find(x => numCol(x.getAttribute("r").replace(/\d+/g, "")) > numCol(L));
        row.insertBefore(c, sig || null);
      }
      while (c.firstChild) c.removeChild(c.firstChild);
      c.removeAttribute("t");
      if (vacio) return true;
      if (typeof v === "number") { const e = doc.createElementNS(NS, "v"); e.textContent = String(v); c.append(e); }
      else {
        c.setAttribute("t", "inlineStr");
        const is = doc.createElementNS(NS, "is"), te = doc.createElementNS(NS, "t");
        te.setAttributeNS(NS_XML, "xml:space", "preserve"); te.textContent = limpiarTexto(v);
        is.append(te); c.append(is);
      }
      return true;
    };
    return { filasEl, celda, formula, tieneValor, escribir };
  };

  // ---- 1) bloques de captura (tablas que se llenan día a día)
  for (const [clave, conf] of Object.entries(HOJAS)) {
    if (!(clave in datos)) continue;
    const filas = datos[clave] || [];
    const sh = hojaPor(conf.hoja || clave);
    if (!sh) { informe.push(`${clave}: no está en el archivo`); faltan.push(clave); continue; }
    const nombre = sh.getAttribute("name");
    const aoa = aoaDe(sh);
    const hr = aoa.findIndex(f => anclaNorm(f[0]) === anclaNorm(conf.ancla) && (!conf.segunda || sinTilde(f[1]).startsWith(conf.segunda)));
    if (hr < 0) { informe.push(`${clave}: no encontré los títulos`); faltan.push(clave); continue; }
    const col = {};
    for (const [k, pref] of Object.entries(conf.cols)) { const i = aoa[hr].findIndex(t => sinTilde(t).startsWith(pref)); if (i >= 0) col[k] = letra(i); }
    const r0 = hr + 2, rMax = hr + 1 + conf.capacidad;   // filas de Excel (base 1)
    if (filas.length > conf.capacidad) throw new Error(`La hoja ${nombre} admite ${conf.capacidad} filas y la app tiene ${filas.length}.`);
    const doc = await docDe(sh);
    const T = herramientas(doc);
    // columnas que en la plantilla son de fórmula (la última fila de captura trae fórmula): nunca se escriben
    for (const [k, L] of Object.entries(col)) if (T.formula(T.celda(rMax, L))) delete col[k];
    const letras = Object.values(col);
    const estilo = {};
    for (const L of letras) { const c = T.celda(r0, L) || T.celda(r0 + 1, L); if (c?.getAttribute("s")) estilo[L] = c.getAttribute("s"); }
    let ultima = r0 - 1;
    for (const [r] of T.filasEl) if (r >= r0 && r <= rMax) for (const L of letras) { const c = T.celda(r, L); if (T.tieneValor(c)) { ultima = Math.max(ultima, r); break; } }
    const hasta = Math.max(ultima, r0 + filas.length - 1);
    let conservadas = 0;
    for (let r = r0; r <= hasta; r++) {
      const vals = filas[r - r0] || {};
      for (const [k, L] of Object.entries(col)) if (!T.escribir(r, L, vals[k], estilo[L])) conservadas++;
    }
    if (conservadas) avisos.push(`${nombre}: ${conservadas} celda(s) con fórmula compartida no se cambiaron.`);
    informe.push(`${nombre}${conf.hoja ? " (" + clave.toLowerCase() + ")" : ""}: ${filas.filter(Boolean).length} fila(s)`);
  }

  // ---- 2) datos de la obra en INICIO (solo los que la app tiene)
  if (datos.INICIO) {
    const sh = hojaPor("INICIO");
    if (sh) {
      const aoa = aoaDe(sh); const doc = await docDe(sh); const T = herramientas(doc);
      let n = 0;
      for (const [k, pref] of Object.entries(ETIQUETAS_INICIO)) {
        const v = datos.INICIO[k]; if (v === "" || v == null) continue;
        const r = aoa.findIndex(f => sinTilde(f[0]).startsWith(sinTilde(pref)));
        if (r < 0 || T.formula(T.celda(r + 1, "B"))) continue;
        T.escribir(r + 1, "B", v, T.celda(r + 1, "B")?.getAttribute("s")); n++;
      }
      informe.push(`${sh.getAttribute("name")}: ${n} dato(s) de la obra`);
    }
  }

  // ---- 3) presupuesto (solo si en la app es distinto al del Excel)
  let presupuestoReescrito = false;
  if (datos.CARGAR) {
    const sh = hojaPor("CARGAR PRESUPUESTO");
    if (!sh) { avisos.push("No encontré la hoja CARGAR PRESUPUESTO: el presupuesto de la app no quedó en el Excel."); }
    else {
      const aoa = aoaDe(sh); const doc = await docDe(sh); const T = herramientas(doc);
      let hr = aoa.findIndex((f, i) => i >= 7 && f.some(t => /ITEM/.test(sinTilde(t))) && f.some(t => /DETALLE|DESCRIP/.test(sinTilde(t))));
      if (hr < 0) { hr = 8; ["ITEM", "DETALLE", "UND", "CANTIDAD", "V/UNITARIO", "V/TOTAL"].forEach((t, i) => T.escribir(hr + 1, letra(i), t)); }   // fila 9 de Excel
      const r0 = hr + 2;
      if (datos.CARGAR.length > 590) throw new Error("El presupuesto tiene más de 590 renglones; el Excel admite hasta 600.");
      const ultimaFila = Math.max(r0 - 1, ...[...T.filasEl.keys()].filter(r => r >= r0 && r <= 620));
      for (let r = r0; r <= Math.max(ultimaFila, r0 + datos.CARGAR.length - 1); r++) {
        const it = datos.CARGAR[r - r0];
        for (let ci = 0; ci < 25; ci++) {
          const L = letra(ci);
          const v = it ? ([it.codigo, it.descripcion, it.und, it.cantidad, it.vu, it.total][ci] ?? "") : "";
          if (v === "" && !T.tieneValor(T.celda(r, L)) && !T.formula(T.celda(r, L))) continue;
          T.escribir(r, L, v, T.celda(r0, L)?.getAttribute("s"));
        }
      }
      presupuestoReescrito = true;
      informe.push(`${sh.getAttribute("name")}: ${datos.CARGAR.length} renglón(es)`);
    }
  }

  // ---- 4) escribir hojas y quitar resultados viejos de fórmulas para que todo se recalcule al abrir
  // (menos INICIO y CARGAR PRESUPUESTO, y PRESUPUESTO si no cambió: la app los lee al importar)
  for (const [p, doc] of docs) {
    // la "dimensión" de la hoja debe cubrir las celdas nuevas (otros programas leen solo ese rango)
    let maxR = 1, maxC = 1;
    for (const c of doc.getElementsByTagNameNS(NS, "c")) {
      const m = /^([A-Z]+)(\d+)$/.exec(c.getAttribute("r") || ""); if (!m) continue;
      maxR = Math.max(maxR, Number(m[2])); maxC = Math.max(maxC, numCol(m[1]));
    }
    const dim = doc.getElementsByTagNameNS(NS, "dimension")[0];
    if (dim) {
      const [ini, fin = ini] = (dim.getAttribute("ref") || "A1").split(":");
      const mf = /^([A-Z]+)(\d+)$/.exec(fin) || [null, "A", "1"];
      dim.setAttribute("ref", `${ini}:${letra(Math.max(maxC, numCol(mf[1])) - 1)}${Math.max(maxR, Number(mf[2]))}`);
    }
    zip.file(p, S.serializeToString(doc), { createFolders: false });
  }
  const conservar = new Set(hojasWb.filter(sh => ["INICIO", "CARGAR PRESUPUESTO"].includes(nombreHoja(sh.getAttribute("name"))) ||
    (!presupuestoReescrito && nombreHoja(sh.getAttribute("name")) === "PRESUPUESTO")).map(rutaDe));
  for (const path of Object.keys(zip.files).filter(n => /^xl\/worksheets\/[^/]+\.xml$/.test(n) && !conservar.has(n))) {
    const xml = await zip.file(path).async("string");
    const limpio = xml.replace(/(<c\b[^>]*>)(<f\b[^>]*\/>|<f\b[^>]*>[\s\S]*?<\/f>)<v>[\s\S]*?<\/v>/g, "$1$2");
    if (limpio !== xml) zip.file(path, limpio, { createFolders: false });
  }
  const calc = wbx.getElementsByTagNameNS(NS, "calcPr")[0];
  if (calc) { calc.setAttribute("fullCalcOnLoad", "1"); zip.file("xl/workbook.xml", S.serializeToString(wbx), { createFolders: false }); }
  const macros = !!zip.file("xl/vbaProject.bin");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE",
    mimeType: macros ? "application/vnd.ms-excel.sheet.macroEnabled.12" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return { blob, informe, faltan, avisos };
}

// Lee del Excel base lo que hace falta para revisar antes de exportar: ítems del presupuesto y AIU escrito a mano.
export function leerBase(buf) {
  const XLSX = window.XLSX;
  const wb = XLSX.read(buf, { type: "array" });
  const hoja = n => { const s = wb.SheetNames.find(x => nombreHoja(x) === n); return s ? XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, raw: true, defval: "" }) : null; };
  const pres = hoja("PRESUPUESTO"), car = hoja("CARGAR PRESUPUESTO"), gas = hoja("GASTOS");
  const items = [];
  for (let r = 8; pres && r < pres.length; r++) {
    const f = pres[r]; const desc = String(f[1] ?? "").trim(), cant = Number(f[3]), vu = Number(f[4]);
    if (desc && cant > 0 && vu > 0) items.push({ codigo: typeof f[0] === "number" ? String(Math.round(f[0] * 1000) / 1000) : String(f[0] ?? "").trim(),
      descripcion: desc, cantidad: cant, vu, etiqueta: String(f[10] ?? "").trim() });
  }
  let aiuManual = null;
  if (car) {
    const n = v => Number(v) || 0;
    const A = n(car[1]?.[2]), I = n(car[2]?.[2]), U = n(car[3]?.[2]), IVA = n(car[4]?.[2]);
    if (A + I + U > 0) aiuManual = A + I + U * (1 + IVA);
  }
  return { items, aiuManual, tieneCargar: !!car, tieneContratos: !!gas?.some(f => anclaNorm(f[0]) === anclaNorm("N.º")) };
}
