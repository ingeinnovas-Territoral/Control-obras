// Lee un contrato u orden de servicio (PDF o Word) en el celular, sin internet, y saca los datos principales.

export async function extraerTexto(file) {
  const nombre = (file.name || "").toLowerCase();
  const buf = await file.arrayBuffer();
  if (nombre.endsWith(".pdf") || file.type === "application/pdf") return await textoPDF(buf);
  if (nombre.endsWith(".docx")) return textoDOCX(buf);
  if (nombre.endsWith(".txt")) return new TextDecoder().decode(buf);
  throw new Error("Use un archivo PDF o Word (.docx). Si es un .doc antiguo, guárdelo como .docx o PDF.");
}

async function textoPDF(buf) {
  const pdfjs = await import("./vendor/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", import.meta.url).href;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  let out = "";
  const n = Math.min(pdf.numPages, 40);
  for (let p = 1; p <= n; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    let lineaY = null;
    for (const it of tc.items) {
      const y = it.transform ? Math.round(it.transform[5]) : null;
      if (lineaY !== null && y !== null && Math.abs(y - lineaY) > 3) out += "\n";
      out += it.str + (it.hasEOL ? "\n" : " ");
      lineaY = y;
    }
    out += "\n";
  }
  return out;
}

function textoDOCX(buf) {
  // SheetJS (ya cargado en la página) trae un lector de ZIP
  const zip = XLSX.CFB.read(new Uint8Array(buf), { type: "array" });
  const ent = XLSX.CFB.find(zip, "word/document.xml") || XLSX.CFB.find(zip, "/word/document.xml");
  if (!ent) throw new Error("No pude leer el documento de Word.");
  const xml = new TextDecoder().decode(ent.content);
  return xml.replace(/<w:tab\/>/g, " ").replace(/<\/w:p>/g, "\n").replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

// ------------------------------------------------------------------ datos
const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const NUM_TXT = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cuarenta_y_cinco: 45, sesenta: 60, noventa: 90, ciento_veinte: 120, ciento_ochenta: 180 };

function limpiar(s) { return (s || "").replace(/\s+/g, " ").replace(/^[\s:.\-–,]+|[\s:.\-–,;]+$/g, "").trim(); }
function aNumero(s) {
  s = String(s).replace(/[^\d.,]/g, "");
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{1,2}$/.test(s) && (s.match(/\./g) || []).length === 1 && s.includes(",")) s = s.replace(/,/g, "");
  else s = s.replace(/[.,]/g, "");
  return Number(s);
}
function iso(y, m, d) { return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }

export function extraerDatos(texto) {
  const t = texto.replace(/ /g, " ");
  const plano = t.replace(/\s+/g, " ");
  const r = {};

  // N.º de contrato u orden
  let m = plano.match(/(contrato|orden de (?:servicio|servicios|compra|trabajo|obra)|convenio)(?:\s+de\s+(?:obra|prestaci[oó]n de servicios|consultor[ií]a|suministro))?\s*(?:n[°ºo.]{0,2}|n[uú]mero|#)\s*[:.]?\s*([A-Z0-9][A-Z0-9\-\/\.]{1,30})/i);
  if (m) { r.tipoDoc = /orden/i.test(m[1]) ? limpiar(m[1]) : "Contrato"; r.contrato = m[2].replace(/[.,;]+$/, ""); }

  // Objeto
  m = plano.match(/objeto(?:\s+del\s+(?:presente\s+)?(?:contrato|convenio|orden))?\s*(?:es|ser[aá])?\s*[:.\-–]\s*(.{15,700}?)(?=\s+(?:segunda|cl[aá]usula|par[aá]grafo|alcance|valor|plazo|obligaciones|\d{1,2}\.\s+[A-ZÁÉÍÓÚ])|$)/i);
  if (m) r.objeto = limpiar(m[1]).replace(/^["“]|["”]$/g, "");

  // Valor
  m = plano.match(/valor(?:\s+total)?(?:\s+del\s+(?:presente\s+)?(?:contrato|convenio|orden(?:\s+de\s+\w+)?))?[^$]{0,220}?\$\s*([\d.,]{5,})/i)
   || plano.match(/\$\s*([\d.,]{7,})/);
  if (m) { const v = aNumero(m[1]); if (v > 1000) r.valor = v; }

  // Plazo
  m = plano.match(/plazo(?:\s+de\s+ejecuci[oó]n)?[^.]{0,160}?(\d{1,4})\)?\s*(?:\([^)]{1,40}\)\s*)?(d[ií]as|meses|semanas)(\s+calendario|\s+h[aá]biles)?/i);
  if (m) {
    const n = Number(m[1]); const u = m[2].toLowerCase();
    r.plazo = u.startsWith("mes") ? n * 30 : u.startsWith("sem") ? n * 7 : n;
    r.plazoTxt = `${m[1]} ${m[2]}${m[3] || ""}`.trim();
  } else {
    m = plano.match(/plazo[^.]{0,160}?\b(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|sesenta|noventa)\s*(d[ií]as|meses)/i);
    if (m) { const n = NUM_TXT[m[1].toLowerCase()]; r.plazo = m[2].toLowerCase().startsWith("mes") ? n * 30 : n; r.plazoTxt = `${m[1]} ${m[2]}`; }
  }

  // Entidad contratante
  m = plano.match(/\b(ALCALD[IÍ]A (?:MUNICIPAL )?DE [A-ZÁÉÍÓÚÑ]+(?: [A-ZÁÉÍÓÚÑ]+){0,3}|GOBERNACI[OÓ]N DE(?:L)? [A-ZÁÉÍÓÚÑ]+(?: [A-ZÁÉÍÓÚÑ]+){0,2}|FEDERACI[OÓ]N NACIONAL DE CAFETEROS(?: DE COLOMBIA)?|COMIT[EÉ] (?:DEPARTAMENTAL )?DE CAFETEROS(?: DE(?:L)? [A-ZÁÉÍÓÚÑ]+)?|E\.?S\.?E\.? [A-ZÁÉÍÓÚÑ ]{3,60}?(?= NIT|,|\.)|EMPRESA SOCIAL DEL ESTADO [A-ZÁÉÍÓÚÑ ]{3,60}?(?= NIT|,|\.)|UNIVERSIDAD [A-ZÁÉÍÓÚÑ ]{3,60}?(?= NIT|,|\.)|BANCO AGRARIO DE COLOMBIA|INSTITUTO [A-ZÁÉÍÓÚÑ ]{3,60}?(?= NIT|,|\.)|MUNICIPIO DE [A-ZÁÉÍÓÚÑ]+(?: [A-ZÁÉÍÓÚÑ]+){0,2})(?![A-Za-zÁÉÍÓÚÑáéíóúñ])/);
  if (m) r.entidad = limpiar(m[1]);
  else {
    m = plano.match(/(?:contratante|entidad)\s*[:\-]\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .,&]{5,90}?)(?=\s+(?:NIT|identificad|representad|con\s)|[,;])/);
    if (m) r.entidad = limpiar(m[1]);
  }

  // Municipio y departamento
  m = plano.match(/municipio de ([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?: [A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+){0,2})/i);
  if (m) r.municipio = capital(m[1]);
  m = plano.match(/departamento (?:del|de) ([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?: [A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+)?)/i);
  if (m) r.depto = capital(m[1]);

  // Supervisor / interventor: nombre propio después de "ejercida por", "a cargo de", etc.
  const NOMBRE = "((?:[Ii]ng\\.?|[Ii]ngenier[oa]|[Aa]rq\\.?|[Aa]rquitect[oa])\\s+)?((?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+|[A-ZÁÉÍÓÚÑ]{2,})(?:\\s+(?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+|[A-ZÁÉÍÓÚÑ]{2,}|de|del)){1,5})";
  const PALABRAS_NO = /^(La|El|Los|Las|Entidad|Secretar|Contratante|Supervis|Interventor)/;
  for (const re of [
    new RegExp("(?:[Ss]upervis|[Ii]nterventor)[^.]{0,160}?(?:[Aa] cargo de|[Ee]jercid[ao] por|[Ee]n cabeza de|[Dd]esign(?:a|ado|ada) a|[Ss]er[aá] (?:el|la))\\s+(?:el|la)?\\s*(?:se[ñn]or(?:a)?\\s+)?" + NOMBRE),
    new RegExp("(?:SUPERVISOR(?:A)?|INTERVENTOR(?:A)?|Supervisor(?:a)?|Interventor(?:a)?)\\s*:\\s*" + NOMBRE)]) {
    m = plano.match(re);
    if (m && !PALABRAS_NO.test(m[2])) { r.supervisor = limpiar((m[1] ? m[1].trim() + " " : "") + m[2]).replace(/\s+(de|del)$/i, ""); break; }
  }

  // Anticipo
  m = plano.match(/anticipo[^.%]{0,120}?(\d{1,2}(?:[.,]\d+)?)\s*%/i) || plano.match(/(\d{1,2}(?:[.,]\d+)?)\s*%[^.]{0,60}anticipo/i);
  if (m) r.anticipoPct = Number(m[1].replace(",", "."));

  // Fecha de firma
  m = plano.match(/(?:a los|el d[ií]a)\s+(\w+)\s*\(?(\d{1,2})?\)?\s*d[ií]as?\s+del\s+mes\s+de\s+([a-záéíóú]+)\s+de(?:l a[ñn]o)?\s+(?:[^\d(]{0,60}\()?(\d{4})/i);
  if (m) {
    const d = Number(m[2] || NUM_TXT[m[1].toLowerCase()] || m[1]); const mes = MESES[m[3].toLowerCase()];
    if (d && mes) r.fechaContrato = iso(m[4], mes, d);
  }
  if (!r.fechaContrato) {
    m = plano.match(/(\d{1,2}) de ([a-záéíóú]+) de(?:l)? (\d{4})/i);
    if (m && MESES[m[2].toLowerCase()]) r.fechaContrato = iso(m[3], MESES[m[2].toLowerCase()], Number(m[1]));
  }

  // Contratista
  if (/flass+ervic/i.test(plano)) r.empresa = "FLASSSERVIC S.A.S.";
  else if (/ingeinnova/i.test(plano)) r.empresa = "INGEINNOVA TERRITORIAL S.A.S.";

  r._caracteres = plano.length;
  return r;
}
function capital(s) { return s.toLowerCase().replace(/(^|\s)\S/g, x => x.toUpperCase()); }
