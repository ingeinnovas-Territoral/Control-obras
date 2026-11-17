// Módulo SST de obra: personal habilitado, charlas, ATS, inspecciones, permisos, listas de chequeo,
// EPP, reportes y botiquín, con firmas en pantalla y expedición en PDF.
import { FORMATOS, TAREAS, SUGERENCIAS_ATS } from "./sst-formatos.js";
import { pdfRegistro } from "./sst-pdf.js";

let C;                                    // utilidades de la app (h, db, pantalla, …)
export function iniciarSST(ctx) { C = ctx; }

const NIVELES_ALTURAS = ["Avanzado", "Coordinador", "Jefe de área", "Reentrenamiento", "No requiere"];
const CONCEPTOS = ["Apto", "Apto con restricciones", "Aplazado", "No apto"];
const ahoraHora = () => new Date().toTimeString().slice(0, 5);
const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

// ---------------------------------------------------------------- habilitación del personal (FO-14)
export function habilitacion(p) {
  const hoy = C.hoy(), falta = [], ojo = [];
  if (p.retiro) falta.push("retirado");
  if (!p.arl) falta.push("sin ARL");
  if (p.pila && diasEntre(p.pila, hoy) > 45) ojo.push("PILA de hace más de 45 días");
  if (!p.pila && p.arl) ojo.push("sin fecha de PILA");
  if (!p.concepto) falta.push("sin concepto médico"); else if (p.concepto === "No apto" || p.concepto === "Aplazado") falta.push("concepto " + p.concepto.toLowerCase());
  else if (p.concepto === "Apto con restricciones") ojo.push("con restricciones médicas");
  if (!p.induccion) ojo.push("sin inducción");
  const alturasOk = ["Avanzado", "Coordinador", "Reentrenamiento"].includes(p.alturasNivel) && p.alturasVence && p.alturasVence >= hoy;
  if (p.alturasNivel && p.alturasNivel !== "No requiere" && p.alturasVence && p.alturasVence >= hoy && diasEntre(hoy, p.alturasVence) <= 30) ojo.push("alturas vence pronto");
  if (p.alturasNivel && p.alturasNivel !== "No requiere" && (!p.alturasVence || p.alturasVence < hoy)) ojo.push("certificado de alturas vencido o sin fecha");
  return {
    estado: falta.length ? "mal" : ojo.length ? "ojo" : "bien", falta, ojo,
    cumple: { arl: !!p.arl && !p.retiro, medico: ["Apto", "Apto con restricciones"].includes(p.concepto), alturas: alturasOk,
      coordinador: p.alturasNivel === "Coordinador" && !!p.alturasVence && p.alturasVence >= hoy },
  };
}
const REQ_TXT = { arl: "ARL al día", medico: "concepto médico apto", alturas: "certificado de alturas vigente", coordinador: "certificado de coordinador vigente" };

// ---------------------------------------------------------------- datos
async function registros(id) { return (await C.db.deObra("sst", id)).sort((a, b) => (b.creado || "").localeCompare(a.creado || "")); }
async function siguienteNumero(id, clave) {
  const cod = FORMATOS[clave].codigo;
  const regs = (await C.db.deObra("sst", id)).filter(r => FORMATOS[r.formato]?.codigo === cod);
  return regs.reduce((m, r) => Math.max(m, r.numero || 0), 0) + 1;
}
function estadoRegistro(r) {
  const f = FORMATOS[r.formato];
  if (r.estado === "cerrado") return ["Cerrado", "info"];
  if (r.estado === "suspendido") return ["Suspendido", "mal"];
  if (r.estado === "no autorizado") return [f.grupo === "inspeccion" ? "No apto" : "No autorizado", "mal"];
  if (r.estado === "autorizado") return [f.grupo === "inspeccion" ? "Apto" : tieneCierre(f) ? "Abierto – falta cerrar" : "Autorizado", tieneCierre(f) ? "ojo" : "bien"];
  if (r.estado === "guardado") return ["Guardado", "bien"];
  return ["Borrador", "ojo"];
}
const tieneCierre = f => f.secciones.some(s => s.cierre);
const nombreFormato = (k) => { const f = FORMATOS[k]; return f.corto || `${f.codigo.replace("SST-", "")} · ${f.subtitulo || f.titulo}`.replace(/\s+/g, " "); };

// valores automáticos (obra, fecha, emergencias, números enlazados)
function autoValor(a, d, tarea, regsTarea) {
  const o = d.obra, e = o.sst || {};
  switch (a) {
    case "obra": return [o.nombre, o.contrato ? "Contrato " + o.contrato : ""].filter(Boolean).join(" · ");
    case "fecha": return C.hoy();
    case "hora": return ahoraHora();
    case "municipio": return o.municipio || "";
    case "arl": return e.arl || ""; case "centro": return e.centro || ""; case "traslado": return e.traslado || "";
    case "punto": return e.punto || ""; case "brigadista": return e.brigadista || "";
    case "ats": { const r = regsTarea.find(x => x.formato === "FO-06"); return r ? String(r.numero) : ""; }
    case "permiso": { const r = regsTarea.find(x => FORMATOS[x.formato].grupo === "permiso" && x.formato !== "PR-12-A2"); return r ? `${FORMATOS[r.formato].codigo} N.º ${r.numero}` : ""; }
  }
  return "";
}

// ---------------------------------------------------------------- evaluación: ¿se puede autorizar?
export function evaluar(r, personalObra) {
  const f = FORMATOS[r.formato], v = r.datos || {}, bloqueos = [], avisos = [];
  for (const s of f.secciones) {
    if (s.cierre) continue;
    for (const c of s.campos) {
      if (c.t === "lista" && c.malo) {
        const resp = v[c.k] || {};
        c.items.forEach((it, i) => {
          if (it.startsWith("#")) return;
          const val = resp[i]?.v, crit = it.endsWith(" *");
          if (!val && crit) bloqueos.push(`Sin responder: ${it.replace(/ \*$/, "")}`);
          else if (val === c.malo) (crit ? bloqueos : avisos).push(`${c.malo}: ${it.replace(/ \*$/, "")}`);
        });
      }
      if (c.t === "sel" && c.malo && v[c.k] === c.malo) bloqueos.push(`${c.l}: ${c.malo}`);
      if (c.t === "tabla") for (const fila of v[c.k] || []) for (const col of c.cols) if (col.malo && fila[col.k] === col.malo) bloqueos.push(`${col.l}: ${col.malo} (${fila[c.cols[0].k] || "fila"})`);
      if (c.t === "gases") for (const m of v[c.k] || []) if (m.o2 !== "" && m.o2 != null && gasMalo(m)) bloqueos.push(`Atmósfera no apta (${m.punto || m.hora})`);
      if (c.t === "personal") {
        const lista = v[c.k] || [];
        if (!lista.length && f.grupo !== "charla") bloqueos.push("No hay personal en el registro");
        for (const p of lista) {
          const po = personalObra.find(x => x.id === p.id);
          if (c.req && po) { const hb = habilitacion(po); for (const q of c.req) if (!hb.cumple[q]) bloqueos.push(`${po.nombre}: falta ${REQ_TXT[q]}`); }
          if (c.req && !po) bloqueos.push(`${p.nombre}: persona externa sin verificación de requisitos`);
          for (const col of c.cols || []) if (col.malo && p[col.k] === col.malo) bloqueos.push(`${p.nombre}: ${col.l} ${col.malo}`);
          if (f.grupo !== "charla" && c.firmas?.length && !p.firmas?.[c.firmas[0]]) avisos.push(`Falta la firma de ${p.nombre}`);
        }
      }
      if (c.t === "firmas") for (const rol of c.roles) {
        if (rol.opcional) continue;
        if (!r.firmas?.[`${c.k}.${rol.k}`]) (f.sinDecision ? avisos : bloqueos).push(`Falta la firma: ${rol.l}`);
        if (rol.req) { const nom = (v[`${c.k}.${rol.k}.nombre`] || "").trim().toLowerCase(); const po = personalObra.find(x => x.nombre.toLowerCase() === nom);
          if (nom && (!po || !habilitacion(po).cumple[rol.req])) bloqueos.push(`${rol.l}: no tiene ${REQ_TXT[rol.req]} en el personal de la obra`); }
      }
    }
  }
  return { bloqueos, avisos };
}
const gasMalo = m => { const n = x => Number(String(x).replace(",", ".")); return !(n(m.o2) >= 19.5 && n(m.o2) <= 23.5) || n(m.lie) >= 10 || n(m.h2s) >= 10 || n(m.co) >= 25; };

// ---------------------------------------------------------------- firma con el dedo
function pedirFirma(titulo) {
  const { h } = C;
  return new Promise(ok => {
    const cv = h("canvas", { class: "firma-cv", width: 600, height: 240 });
    const ctx = cv.getContext("2d"); ctx.lineWidth = 3.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0B1B3A";
    let pinta = false, hay = false, last = null;
    const pos = e => { const r = cv.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * cv.width / r.width, (t.clientY - r.top) * cv.height / r.height]; };
    const ini = e => { e.preventDefault(); pinta = true; last = pos(e); };
    const mov = e => { if (!pinta) return; e.preventDefault(); const p = pos(e); ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke(); last = p; hay = true; };
    const fin = () => { pinta = false; };
    cv.addEventListener("pointerdown", ini); cv.addEventListener("pointermove", mov); addEventListener("pointerup", fin);
    const cerrar = v => { capa.remove(); removeEventListener("pointerup", fin); ok(v); };
    const capa = h("div", { class: "hoja-capa" }, h("div", { class: "hoja" },
      h("div", { class: "t-nom" }, "Firma"), h("div", { class: "t-sub" }, titulo), cv,
      h("div", { class: "fila2" }, h("button", { class: "btn sec", onclick: () => { ctx.clearRect(0, 0, cv.width, cv.height); hay = false; } }, "Borrar"),
        h("button", { class: "btn", onclick: () => cerrar(hay ? cv.toDataURL("image/png") : null) }, "Guardar firma")),
      h("button", { class: "btn sec", onclick: () => cerrar(undefined) }, "Cancelar")));
    document.body.append(capa);
  });
}
function botonFirma(r, clave, titulo, alGuardar) {
  const { h } = C;
  const caja = h("div", { class: "firma-caja" });
  const pintar = () => {
    caja.innerHTML = "";
    const img = r.firmas?.[clave];
    caja.append(img ? h("img", { src: img, alt: "Firma" }) : h("span", { class: "nota" }, "Sin firma"),
      h("button", { type: "button", class: "btn mini " + (img ? "sec" : ""), onclick: async () => {
        const v = await pedirFirma(titulo); if (v === undefined) return;
        r.firmas = r.firmas || {}; if (v) r.firmas[clave] = v; else delete r.firmas[clave];
        pintar(); alGuardar && alGuardar();
      } }, img ? "Cambiar" : "Firmar"));
  };
  pintar(); return caja;
}

// ---------------------------------------------------------------- render de un campo
function campo(c, r, d, ctx) {
  const { h } = C; const v = r.datos;
  const bloqueado = ctx.soloLectura;
  const lab = (t, ...x) => h("label", { class: "campo" }, h("span", {}, t), ...x);
  const inp = (k, tipo = "text", extra = {}) => h("input", { type: tipo, value: v[k] ?? "", disabled: bloqueado, oninput: e => { v[k] = e.target.value; ctx.cambio(); }, ...extra });
  switch (c.t) {
    case "texto": return lab(c.l, inp(c.k));
    case "num": return lab(c.l, inp(c.k, "text", { inputmode: "decimal" }));
    case "fecha": return lab(c.l, inp(c.k, "date"));
    case "hora": return lab(c.l, inp(c.k, "time"));
    case "area": return lab(c.l, h("textarea", { rows: 3, disabled: bloqueado, oninput: e => { v[c.k] = e.target.value; ctx.cambio(); } }, v[c.k] || ""));
    case "nota": return h("p", { class: "nota" }, c.l);
    case "sel": { const ops = v[c.k] && !c.op.includes(v[c.k]) ? [v[c.k], ...c.op] : c.op;
      return lab(c.l, h("select", { disabled: bloqueado, onchange: e => { v[c.k] = e.target.value; ctx.cambio(); } }, h("option", { value: "" }, "—"), ops.map(o => h("option", { selected: v[c.k] === o }, o)))); }
    case "marcas": { const sel = new Set(v[c.k] || []);
      return h("fieldset", { class: "marcas" }, h("legend", {}, c.l), c.op.map(o => h("label", { class: "chk" },
        h("input", { type: "checkbox", checked: sel.has(o), disabled: bloqueado, onchange: e => { e.target.checked ? sel.add(o) : sel.delete(o); v[c.k] = [...sel]; ctx.cambio(); } }), o))); }
    case "lista": return listaChequeo(c, r, ctx);
    case "tabla": return tabla(c, r, ctx);
    case "inventario": return inventario(c, r, ctx);
    case "gases": return gases(c, r, ctx);
    case "personal": return personal(c, r, d, ctx);
    case "trabajador": return lab(c.l, h("select", { disabled: bloqueado, onchange: e => { const p = d.personal.find(x => x.id === e.target.value); v[c.k] = p ? { id: p.id, nombre: p.nombre, cc: p.cedula || "", cargo: p.cargo || "" } : null; ctx.cambio(); } },
      h("option", { value: "" }, "— Elija el trabajador —"), d.personal.map(p => h("option", { value: p.id, selected: v[c.k]?.id === p.id }, `${p.nombre} · ${p.cargo || ""}`))));
    case "fotos": return fotosCampo(c, r, ctx);
    case "decision": return decision(c, r, ctx);
    case "firmas": return firmas(c, r, d, ctx);
  }
  return null;
}
function listaChequeo(c, r, ctx) {
  const { h } = C; const resp = r.datos[c.k] = r.datos[c.k] || {};
  let n = 0;
  return h("div", { class: "lista-chk" }, c.items.map((it, i) => {
    if (it.startsWith("#")) return h("div", { class: "lc-grupo" }, it.slice(1).trim());
    n++;
    const crit = it.endsWith(" *"), txt = it.replace(/ \*$/, "");
    const fila = h("div", { class: "lc-fila" + (resp[i]?.v === c.malo ? " malo" : "") });
    const btns = h("div", { class: "lc-ops" }, c.op.map(o => h("button", { type: "button", disabled: ctx.soloLectura, class: "lc-op" + (resp[i]?.v === o ? " sel " + (o === c.malo ? "m" : o === "NA" ? "na" : "b") : ""),
      onclick: () => { resp[i] = { ...(resp[i] || {}), v: resp[i]?.v === o ? "" : o }; ctx.cambio(); ctx.repintar(); } }, o)));
    const obs = h("input", { class: "lc-obs", placeholder: c.serial ? "Código / serial · observación" : "Observación", value: resp[i]?.o || "", disabled: ctx.soloLectura,
      oninput: e => { resp[i] = { ...(resp[i] || {}), o: e.target.value }; ctx.cambio(); } });
    fila.append(h("div", { class: "lc-txt" }, h("span", { class: "lc-n" }, n), txt, crit ? h("b", { class: "lc-crit", title: "Crítico" }, " *") : null), btns,
      (resp[i]?.o || resp[i]?.v === c.malo || c.serial) ? obs : h("button", { type: "button", class: "lc-addobs", onclick: e => { e.target.replaceWith(obs); obs.focus(); } }, "+ observación"));
    return fila;
  }), c.malo ? h("div", { class: "nota" }, h("b", {}, "*"), " = ítem crítico. Si queda en ", c.malo, " no se puede autorizar.") : null,
  h("button", { type: "button", class: "btn mini sec", disabled: ctx.soloLectura, onclick: () => { c.items.forEach((it, i) => { if (!it.startsWith("#") && !resp[i]?.v) resp[i] = { ...(resp[i] || {}), v: c.op[0] }; }); ctx.cambio(); ctx.repintar(); } },
    `Marcar los vacíos como "${c.op[0]}"`));
}
function tabla(c, r, ctx) {
  const { h } = C; const filas = r.datos[c.k] = r.datos[c.k] || Array.from({ length: c.filas ?? 1 }, () => ({}));
  const caja = h("div", { class: "tabla-sst" });
  filas.forEach((f, i) => caja.append(h("div", { class: "ts-fila" }, h("div", { class: "ts-n" }, i + 1),
    h("div", { class: "ts-campos" }, c.cols.map(col => h("label", { class: "campo" }, h("span", {}, col.l), col.op
      ? h("select", { disabled: ctx.soloLectura, onchange: e => { f[col.k] = e.target.value; ctx.cambio(); } }, h("option", { value: "" }, "—"), col.op.map(o => h("option", { selected: f[col.k] === o }, o)))
      : h(col.k === "controles" || col.k === "riesgos" ? "textarea" : "input", { type: col.t === "fecha" ? "date" : "text", rows: 2, value: f[col.k] || "", disabled: ctx.soloLectura,
          oninput: e => { f[col.k] = e.target.value; ctx.cambio(); } }, col.k === "controles" || col.k === "riesgos" ? f[col.k] || "" : null)))),
    ctx.soloLectura ? null : h("button", { type: "button", class: "quitar mini", "aria-label": "Quitar fila", onclick: () => { filas.splice(i, 1); ctx.cambio(); ctx.repintar(); } }, "×"))));
  if (!ctx.soloLectura) {
    caja.append(h("button", { type: "button", class: "btn mini sec", onclick: () => { filas.push({}); ctx.cambio(); ctx.repintar(); } }, "+ Agregar fila"));
    if (c.sugerir) caja.append(h("details", { class: "opcional" }, h("summary", {}, "Agregar desde la matriz de peligros"),
      ...SUGERENCIAS_ATS.map(s => h("button", { type: "button", class: "sug", onclick: () => { filas.push({ ...s, resp: "" }); ctx.cambio(); ctx.repintar(); } }, h("span", {}, s.paso), h("small", {}, s.peligros)))));
  }
  return caja;
}
function inventario(c, r, ctx) {
  const { h } = C; const v = r.datos[c.k] = r.datos[c.k] || {};
  return h("div", { class: "tabla-sst" }, c.items.map(([el, min], i) => { const f = v[i] = v[i] || {};
    return h("div", { class: "inv-fila" + (f.e === "M" ? " malo" : "") }, h("div", { class: "lc-txt" }, el, h("small", {}, ` · mínimo ${min}`)),
      h("div", { class: "inv-campos" }, h("input", { placeholder: "Encontrada", inputmode: "numeric", value: f.cant || "", disabled: ctx.soloLectura, oninput: e => { f.cant = e.target.value; ctx.cambio(); } }),
        h("input", { type: "date", value: f.vence || "", title: "Vencimiento", disabled: ctx.soloLectura, oninput: e => { f.vence = e.target.value; ctx.cambio(); } }),
        h("div", { class: "lc-ops" }, ["B", "M"].map(o => h("button", { type: "button", disabled: ctx.soloLectura, class: "lc-op" + (f.e === o ? " sel " + (o === "M" ? "m" : "b") : ""), onclick: () => { f.e = f.e === o ? "" : o; ctx.cambio(); ctx.repintar(); } }, o))))); }));
}
function gases(c, r, ctx) {
  const { h } = C; const filas = r.datos[c.k] = r.datos[c.k] || c.filas.map(p => ({ punto: p }));
  return h("div", { class: "tabla-sst" }, h("p", { class: "nota" }, "Aceptable: O2 entre 19,5 y 23,5 % · LIE menos de 10 % · H2S menos de 10 ppm · CO menos de 25 ppm."),
    filas.map((m, i) => h("div", { class: "ts-fila" + (m.o2 && gasMalo(m) ? " malo" : "") }, h("div", { class: "ts-campos gases" },
      ["punto", "hora", "o2", "lie", "h2s", "co", "medido"].map(k => h("label", { class: "campo" }, h("span", {}, { punto: "Momento / punto", hora: "Hora", o2: "O2 (%)", lie: "LIE (%)", h2s: "H2S (ppm)", co: "CO (ppm)", medido: "Medido por" }[k]),
        h("input", { type: k === "hora" ? "time" : "text", inputmode: ["o2", "lie", "h2s", "co"].includes(k) ? "decimal" : null, value: m[k] || "", disabled: ctx.soloLectura && k !== "medido",
          oninput: e => { m[k] = e.target.value; ctx.cambio(); } })))),
      m.o2 ? h("div", { class: "est " + (gasMalo(m) ? "mal" : "bien") }, gasMalo(m) ? "NO APTO" : "Apto") : null)),
    h("button", { type: "button", class: "btn mini sec", onclick: () => { filas.push({ punto: `Periódica ${filas.length - 2}`, hora: ahoraHora() }); ctx.cambio(); ctx.repintar(); } }, "+ Medición periódica"));
}
function personal(c, r, d, ctx) {
  const { h } = C; const lista = r.datos[c.k] = r.datos[c.k] || [];
  const ids = new Set(lista.map(p => p.id));
  const caja = h("div", { class: "personal-sst" });
  for (const p of lista) {
    const po = d.personal.find(x => x.id === p.id); const hb = po ? habilitacion(po) : null;
    const faltan = c.req && po ? c.req.filter(q => !hb.cumple[q]) : [];
    caja.append(h("div", { class: "ps-fila" + (faltan.length ? " malo" : "") },
      h("div", { class: "ps-top" }, h("div", {}, h("b", {}, p.nombre), h("div", { class: "t-sub" }, [p.cargo, p.cc ? "C.C. " + p.cc : ""].filter(Boolean).join(" · "))),
        ctx.soloLectura ? null : h("button", { type: "button", class: "quitar mini", "aria-label": "Quitar", onclick: () => { lista.splice(lista.indexOf(p), 1); ctx.cambio(); ctx.repintar(); } }, "×")),
      c.req && po ? h("div", { class: "ps-req" }, c.req.map(q => h("span", { class: "est " + (hb.cumple[q] ? "bien" : "mal") }, (hb.cumple[q] ? "✓ " : "✗ ") + REQ_TXT[q]))) : null,
      (c.cols || []).length ? h("div", { class: "ts-campos" }, c.cols.map(col => h("label", { class: "campo" }, h("span", {}, col.l), col.op
        ? h("select", { disabled: ctx.soloLectura, onchange: e => { p[col.k] = e.target.value; ctx.cambio(); } }, h("option", { value: "" }, "—"), col.op.map(o => h("option", { selected: p[col.k] === o }, o)))
        : h("input", { value: p[col.k] ?? (col.def === "empresa" ? (d.obra.empresa || "") : ""), disabled: ctx.soloLectura, oninput: e => { p[col.k] = e.target.value; ctx.cambio(); } })))) : null,
      h("div", { class: "ps-firmas" }, (c.firmas || []).map(fk => {
        if (fk === "cierre" && !ctx.enCierre) return null;
        const clave = `${c.k}.${p.id}.${fk}`;
        return h("div", {}, h("small", {}, { firma: "Firma", inicio: "Firma inicio", cierre: "Firma cierre", instala: "Firma instalación", retiro: "Firma retiro" }[fk] || fk),
          botonFirma(r, clave, `${p.nombre} – ${fk}`, () => { p.firmas = p.firmas || {}; p.firmas[fk] = !!r.firmas[clave]; ctx.cambio(); }));
      }))));
  }
  if (!ctx.soloLectura) {
    const disponibles = d.personal.filter(x => !ids.has(x.id) && !x.retiro);
    const sel = h("div", { class: "ps-agregar" }, disponibles.map(x => { const hb = habilitacion(x); const faltan = (c.req || []).filter(q => !hb.cumple[q]);
      return h("button", { type: "button", class: "sug" + (faltan.length ? " deshab" : ""), onclick: () => {
        if (faltan.length) return alert(`${x.nombre} no puede quedar en este registro: falta ${faltan.map(q => REQ_TXT[q]).join(", ")}.\n\nActualice sus datos en SST › Personal.`);
        lista.push({ id: x.id, nombre: x.nombre, cc: x.cedula || "", cargo: x.cargo || "" }); ctx.cambio(); ctx.repintar(); } },
        h("span", {}, x.nombre), h("small", {}, faltan.length ? "✗ " + faltan.map(q => REQ_TXT[q]).join(", ") : x.cargo || "")); }));
    ctx.abiertos = ctx.abiertos || {};
    const abierto = ctx.abiertos[c.k] ?? !lista.length;
    caja.append(h("details", { class: "opcional", open: abierto, ontoggle: e => { ctx.abiertos[c.k] = e.target.open; } }, h("summary", {}, "+ Agregar personas de la obra"), sel,
      disponibles.length > 1 && !c.req ? h("button", { type: "button", class: "btn mini sec", onclick: () => { for (const x of disponibles) lista.push({ id: x.id, nombre: x.nombre, cc: x.cedula || "", cargo: x.cargo || "" }); ctx.cambio(); ctx.repintar(); } }, "Agregar a todos") : null,
      c.req ? null : h("button", { type: "button", class: "btn mini sec", onclick: () => { const n = prompt("Nombre completo de la persona externa (visitante o contratista):"); if (!n) return;
        const cc = prompt("Cédula:") || ""; lista.push({ id: "ext-" + Date.now(), nombre: n.trim(), cc, cargo: "Externo", externo: true }); ctx.cambio(); ctx.repintar(); } }, "+ Persona externa")));
  }
  return caja;
}
function fotosCampo(c, r, ctx) {
  const { h } = C; const fotos = r.datos[c.k] = r.datos[c.k] || [];
  const g = h("div", { class: "galeria" }, fotos.map((f, i) => h("div", { class: "foto-mini" }, h("img", { src: f }), ctx.soloLectura ? null : h("button", { type: "button", class: "quitar mini", onclick: () => { fotos.splice(i, 1); ctx.cambio(); ctx.repintar(); } }, "×"))));
  return h("div", { class: "campo" }, h("span", {}, c.l), g, ctx.soloLectura ? null : h("label", { class: "btn mini sec" }, C.ico("camara"), "Agregar foto",
    h("input", { type: "file", accept: "image/*", hidden: true, onchange: async e => { const f = e.target.files[0]; if (!f) return; const b = await C.comprimir(f, 1000, 0.6);
      fotos.push(await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); })); ctx.cambio(); ctx.repintar(); } })));
}
function decision(c, r, ctx) {
  const { h } = C; const ev = ctx.evaluacion;
  return h("div", { class: "decision " + (ev.bloqueos.length ? "mal" : "bien") },
    h("div", { class: "t-nom" }, ev.bloqueos.length ? (c.no || "No se puede autorizar todavía") : (c.si || "Listo para autorizar")),
    ev.bloqueos.length ? h("ul", {}, ev.bloqueos.slice(0, 12).map(b => h("li", {}, b)), ev.bloqueos.length > 12 ? h("li", {}, `… y ${ev.bloqueos.length - 12} más`) : null) : null,
    ev.avisos.length ? h("details", {}, h("summary", {}, `${ev.avisos.length} observación(es)`), h("ul", {}, ev.avisos.map(b => h("li", {}, b)))) : null);
}
function firmas(c, r, d, ctx) {
  const { h } = C; const v = r.datos;
  const enCierre = /Cierre/.test(c.k);
  return h("div", { class: "firmas-sst" }, c.roles.map(rol => {
    const kn = `${c.k}.${rol.k}.nombre`, kc = `${c.k}.${rol.k}.cc`;
    if (!v[kn] && rol.deTrabajador && v.trabajador) { v[kn] = v.trabajador.nombre; v[kc] = v.trabajador.cc; }
    const sololect = ctx.soloLectura && !(enCierre && ctx.enCierre);
    return h("div", { class: "firma-rol" }, h("div", { class: "fr-l" }, rol.l + (rol.opcional ? " (opcional)" : "")),
      h("div", { class: "fila2" }, h("input", { placeholder: "Nombre", value: v[kn] || "", list: "lista-personal-sst", disabled: sololect,
        oninput: e => { v[kn] = e.target.value; const p = d.personal.find(x => x.nombre === e.target.value); if (p && p.cedula) { v[kc] = p.cedula; } ctx.cambio(); } }),
        h("input", { placeholder: "C.C.", value: v[kc] || "", inputmode: "numeric", disabled: sololect, oninput: e => { v[kc] = e.target.value; ctx.cambio(); } })),
      rol.cert ? h("input", { placeholder: rol.cert, value: v[`${c.k}.${rol.k}.cert`] || "", disabled: sololect, oninput: e => { v[`${c.k}.${rol.k}.cert`] = e.target.value; ctx.cambio(); } }) : null,
      sololect && !r.firmas?.[`${c.k}.${rol.k}`] ? h("span", { class: "nota" }, "Sin firma") : botonFirma(r, `${c.k}.${rol.k}`, rol.l, () => { ctx.cambio(); ctx.repintar(); }));
  }));
}

// ---------------------------------------------------------------- pantalla de un registro
async function vistaRegistro(id, rid) {
  const { h, db } = C;
  const d = await C.cargarObra(id);
  const r = await db.uno("sst", rid); if (!r) return C.ir(`#/obra/${id}/sst`);
  const f = FORMATOS[r.formato];
  const cont = h("div", { class: "form" });
  let sucio = false;
  const guardar = async () => { r.actualizado = new Date().toISOString(); await db.guardar("sst", r); sucio = false; };
  const ctx = { cambio: () => { sucio = true; ctx.evaluacion = evaluar(r, d.personal); }, repintar: () => pintar(), soloLectura: false, enCierre: false };
  const pintar = () => {
    const y = scrollY;
    ctx.soloLectura = ["autorizado", "no autorizado", "cerrado", "suspendido", "guardado"].includes(r.estado) && !(r.estado === "guardado" && f.sinDecision && r.editando);
    ctx.enCierre = r.estado === "autorizado" && tieneCierre(f);
    ctx.evaluacion = evaluar(r, d.personal);
    pintarBadge();
    cont.innerHTML = "";
    if (f.nota) cont.append(h("p", { class: "nota nota-formato" }, f.nota));
    for (const s of f.secciones) {
      if (s.cierre && !(ctx.enCierre || r.estado === "cerrado" || (f.sinDecision && r.formato === "FO-12"))) continue;
      const ro = ctx.soloLectura && !(s.cierre && ctx.enCierre);
      const sub = { ...ctx, soloLectura: ro };
      cont.append(h("section", { class: "sec-sst" + (s.cierre ? " cierre" : "") }, s.titulo ? h("h2", {}, s.titulo) : null, ...s.campos.map(c => campo(c, r, d, sub))));
    }
    cont.append(h("datalist", { id: "lista-personal-sst" }, d.personal.map(p => h("option", { value: p.nombre }))));
    cont.append(acciones());
    requestAnimationFrame(() => scrollTo(0, y));
  };
  const acciones = () => {
    const a = h("div", { class: "acciones acc-sst" });
    const ev = ctx.evaluacion;
    if (!ctx.soloLectura) a.append(h("button", { class: "btn sec", onclick: async () => { await guardar(); C.toast("Guardado"); } }, "Guardar borrador"));
    if (!ctx.soloLectura && !f.sinDecision) a.append(h("button", { class: "btn grande " + (ev.bloqueos.length ? "peligro" : ""), onclick: async () => {
      if (ev.bloqueos.length) {
        if (!confirm(`No se puede autorizar:\n\n• ${ev.bloqueos.slice(0, 8).join("\n• ")}\n\n¿Guardar el registro como ${f.grupo === "inspeccion" ? "NO APTO" : "NO AUTORIZADO"}?`)) return;
        r.estado = "no autorizado"; r.motivos = ev.bloqueos.slice(0, 20);
      } else { r.estado = "autorizado"; delete r.motivos; }
      r.fechaDecision = new Date().toISOString(); await guardar(); C.toast(r.estado === "autorizado" ? (f.grupo === "inspeccion" ? "Equipo APTO" : "Autorizado") : "Registrado como no autorizado"); pintar();
    } }, ev.bloqueos.length ? (f.grupo === "inspeccion" ? "Registrar como NO APTO" : "Registrar como NO AUTORIZADO") : (f.grupo === "inspeccion" ? "Firmar: APTO para operar" : f.boton || "Autorizar e iniciar")));
    if (!ctx.soloLectura && f.sinDecision) a.append(h("button", { class: "btn grande", onclick: async () => { r.estado = "guardado"; r.editando = false; await guardar(); await alGuardarExtra(r, d); C.toast("Registro guardado"); pintar(); } }, "Guardar registro"));
    if (r.estado === "guardado" && f.sinDecision) a.append(h("button", { class: "btn sec", onclick: () => { r.editando = true; pintar(); } }, C.ico("lapiz"), "Editar"));
    if (ctx.enCierre) a.append(h("button", { class: "btn grande", onclick: async () => {
      if (f.secciones.some(s => s.cierre && s.campos.some(c => c.t === "firmas" && c.roles.some(rol => !r.firmas?.[`${c.k}.${rol.k}`])))) return alert("Falta la firma de cierre.");
      r.estado = "cerrado"; r.fechaCierre = new Date().toISOString(); await guardar(); C.toast("Cerrado"); pintar(); } }, "Cerrar " + (f.grupo === "permiso" ? "el permiso" : "el registro")));
    if (ctx.enCierre && f.suspension) a.append(h("button", { class: "btn peligro", onclick: async () => {
      const m = prompt("Motivo de la suspensión (clima, condición insegura, emergencia). Si se reanuda, se expide un permiso nuevo:"); if (!m) return;
      r.estado = "suspendido"; r.suspension = { motivo: m, hora: ahoraHora() }; await guardar(); pintar(); } }, "Suspender"));
    if (r.estado !== "borrador") a.append(h("button", { class: "btn verde", onclick: () => expedir(r, d) }, C.ico("doc"), "Expedir PDF"));
    a.append(h("button", { class: "btn peligro", onclick: async () => { if (!confirm(`¿Borrar ${nombreFormato(r.formato)} N.º ${r.numero}?`)) return; await db.borrar("sst", r.id); history.back(); } }, "Borrar"));
    return a;
  };
  const badge = h("span", { class: "est" });
  const pintarBadge = () => { const [est, cls] = estadoRegistro(r); badge.className = "est " + cls; badge.textContent = est; };
  C.pantalla(`${f.codigo.replace("SST-", "")} N.º ${r.numero}`, { atras: r.tareaId ? `#/obra/${id}/sst/tarea/${r.tareaId}` : `#/obra/${id}/sst`, subtitulo: (f.subtitulo || f.titulo) },
    h("div", { class: "g-top" }, h("span", { class: "t-emp" }, f.codigo + (f.sub ? " · " + f.sub : "")), badge), cont);
  window.onbeforeunload = () => sucio ? "Hay cambios sin guardar" : undefined;
  addEventListener("hashchange", async function salir() { removeEventListener("hashchange", salir); if (sucio) await guardar(); window.onbeforeunload = null; });
  pintar();
}
async function alGuardarExtra(r, d) {
  // la charla de 5 minutos queda también en la bitácora del día, si está vacía
  if (r.formato === "FO-13" && r.datos.tipo === "Charla de 5 minutos" && r.datos.tema) {
    const b = d.bitacora.find(x => x.fecha === r.datos.fecha);
    if (b && !b.charla) { b.charla = r.datos.tema; await C.db.guardar("bitacora", b); }
  }
}
async function expedir(r, d) {
  try { C.toast("Armando el PDF…"); const { blob, nombre } = await pdfRegistro(r, FORMATOS[r.formato], d, C.EMPRESAS); await C.entregarArchivo(blob, nombre, [], true); }
  catch (e) { console.error(e); alert("No pude armar el PDF: " + e.message); }
}

async function crearRegistro(id, clave, tareaId) {
  const d = await C.cargarObra(id);
  const regsTarea = tareaId ? (await C.db.deObra("sst", id)).filter(x => x.tareaId === tareaId) : [];
  const f = FORMATOS[clave], datos = {};
  for (const s of f.secciones) for (const c of s.campos) if (c.auto) datos[c.k] = autoValor(c.auto, d, null, regsTarea);
  if (tareaId) { const t = await C.db.uno("tareasSST", tareaId); if (t?.descripcion) { if ("tarea" in datos || f.secciones.some(s => s.campos.some(c => c.k === "tarea"))) datos.tarea = datos.tarea || t.descripcion; } }
  const r = await C.db.guardar("sst", { obraId: id, formato: clave, numero: await siguienteNumero(id, clave), estado: "borrador", datos, firmas: {}, tareaId: tareaId || undefined, creado: new Date().toISOString() });
  C.ir(`#/obra/${id}/sst/r/${r.id}`);
}

// ---------------------------------------------------------------- tarea crítica paso a paso
async function vistaNuevaTarea(id) {
  const { h } = C; const d = await C.cargarObra(id);
  const desc = h("input", { placeholder: "Ej.: cambio de tejas en la cubierta del salón" });
  C.pantalla("Nueva tarea crítica", { atras: `#/obra/${id}/sst`, subtitulo: d.obra.nombre },
    h("label", { class: "campo" }, h("span", {}, "¿Qué se va a hacer?"), desc),
    h("p", { class: "nota" }, "Elija el tipo de tarea. La app le muestra los formatos en el orden en que se diligencian: ATS, inspección de equipos, permiso y lista de chequeo."),
    h("div", { class: "acciones" }, Object.entries(TAREAS).map(([k, t]) => h("button", { class: "tarjeta fila tarea-op", onclick: async () => {
      const tr = await C.db.guardar("tareasSST", { obraId: id, tipo: k, descripcion: desc.value.trim(), fecha: C.hoy(), creado: new Date().toISOString() });
      C.ir(`#/obra/${id}/sst/tarea/${tr.id}`); } }, h("div", {}, h("div", { class: "t-nom" }, t.l), h("div", { class: "t-sub" }, t.pasos.map(p => FORMATOS[p].codigo.replace("SST-", "")).join(" → "))), C.ico("avance")))));
}
async function vistaTarea(id, tid) {
  const { h } = C; const t = await C.db.uno("tareasSST", tid); if (!t) return C.ir(`#/obra/${id}/sst`);
  const def = TAREAS[t.tipo]; const regs = (await C.db.deObra("sst", id)).filter(r => r.tareaId === tid);
  const pasos = [...def.pasos, ...(def.opcionales || [])];
  let anteriorOk = true;
  const filas = pasos.map((k, i) => {
    const opc = (def.opcionales || []).includes(k);
    const rs = regs.filter(r => r.formato === k);
    const ok = rs.some(r => ["autorizado", "cerrado", "guardado"].includes(r.estado));
    const habil = anteriorOk || opc;
    if (!opc) anteriorOk = anteriorOk && ok;
    return h("div", { class: "paso" + (ok ? " ok" : "") + (!habil ? " bloq" : "") },
      h("div", { class: "paso-n" }, ok ? "✓" : opc ? "+" : i + 1),
      h("div", { class: "paso-txt" }, h("div", { class: "t-nom" }, nombreFormato(k)), h("div", { class: "t-sub" }, FORMATOS[k].codigo + (FORMATOS[k].sub ? " · " + FORMATOS[k].sub : "") + (opc ? " · si aplica" : "")),
        rs.map(r => { const [e, c] = estadoRegistro(r); return h("a", { class: "paso-reg", href: `#/obra/${id}/sst/r/${r.id}` }, `N.º ${r.numero}`, h("span", { class: "est " + c }, e)); })),
      h("button", { class: "btn mini " + (rs.length ? "sec" : ""), onclick: () => { if (!habil && !confirm("El paso anterior no está terminado. ¿Abrir de todas formas?")) return; crearRegistro(id, k, tid); } }, rs.length ? "+ Otro" : "Llenar"));
  });
  const todo = def.pasos.every(k => regs.some(r => r.formato === k && ["autorizado", "cerrado", "guardado"].includes(r.estado)));
  const abiertos = regs.filter(r => r.estado === "autorizado" && tieneCierre(FORMATOS[r.formato]));
  C.pantalla(def.l, { atras: `#/obra/${id}/sst`, subtitulo: [t.descripcion, C.fechaCorta(t.fecha)].filter(Boolean).join(" · ") },
    h("div", { class: (todo ? "decision bien" : "alerta ambar") + " estado-tarea" }, todo ? (abiertos.length ? "Autorizada. Al terminar, cierre el permiso." : "Tarea terminada y cerrada.") : "Complete los pasos en orden. La tarea NO inicia hasta tener todo autorizado."),
    h("div", { class: "pasos" }, filas),
    h("button", { class: "btn peligro", onclick: async () => { if (!confirm("¿Borrar esta tarea? Los registros que ya llenó se conservan.")) return; for (const r of regs) { delete r.tareaId; await C.db.guardar("sst", r); } await C.db.borrar("tareasSST", tid); C.ir(`#/obra/${id}/sst`); } }, "Borrar tarea"));
}

// ---------------------------------------------------------------- personal SST (FO-14)
async function vistaPersonalSST(id) {
  const { h } = C; const d = await C.cargarObra(id);
  const filas = d.personal.map(p => { const hb = habilitacion(p);
    return h("a", { class: "fila-mat " + (hb.estado === "bien" ? "" : hb.estado), href: `#/obra/${id}/sst/trab/${p.id}` },
      h("div", { class: "fm-txt" }, h("div", { class: "fm-nom" }, p.nombre), h("div", { class: "fm-sub" }, hb.falta.concat(hb.ojo).join(" · ") || [p.cargo, p.alturasNivel && p.alturasNivel !== "No requiere" ? "Alturas: " + p.alturasNivel : ""].filter(Boolean).join(" · "))),
      h("span", { class: "est " + hb.estado }, { bien: "Habilitado", ojo: "Revisar", mal: "No habilitado" }[hb.estado])); });
  C.pantalla("Personal SST", { atras: `#/obra/${id}/sst`, subtitulo: "SST-FO-14 · " + d.obra.nombre },
    h("p", { class: "nota" }, "Ningún trabajador inicia labores sin afiliación a seguridad social ni concepto médico. Los que estén en rojo no aparecen para firmar permisos."),
    d.personal.length ? h("div", { class: "lista-mat" }, filas) : h("div", { class: "vacio" }, "Agregue el personal de la obra."),
    h("a", { class: "btn grande", href: `#/obra/${id}/sst/trab/nuevo` }, C.ico("sumar"), "Agregar trabajador"));
}
async function vistaTrabajador(id, pid) {
  const { h } = C; const d = await C.cargarObra(id);
  const p = pid === "nuevo" ? { obraId: id, creado: new Date().toISOString() } : d.personal.find(x => x.id === pid);
  if (!p) return C.ir(`#/obra/${id}/sst/personal`);
  const inp = (k, l, t = "text", extra = {}) => h("label", { class: "campo" }, h("span", {}, l), h("input", { type: t, value: p[k] || "", oninput: e => { p[k] = e.target.value; }, ...extra }));
  const sel = (k, l, op) => h("label", { class: "campo" }, h("span", {}, l), h("select", { onchange: e => { p[k] = e.target.value; } }, h("option", { value: "" }, "—"), op.map(o => h("option", { selected: p[k] === o }, o))));
  const soportes = p.soportes = p.soportes || [];
  const gal = h("div", { class: "galeria" });
  const pintarSop = () => { gal.innerHTML = ""; soportes.forEach((s, i) => gal.append(h("div", { class: "foto-mini" }, h("img", { src: s.img }), h("small", {}, s.tipo), h("button", { type: "button", class: "quitar mini", onclick: () => { soportes.splice(i, 1); pintarSop(); } }, "×")))); };
  pintarSop();
  const tipoSop = h("select", {}, ["ARL", "EPS", "Pensión", "PILA", "Concepto médico", "Certificado de alturas", "Certificado de coordinador", "Cédula", "Otro"].map(o => h("option", {}, o)));
  const hb = p.nombre ? habilitacion(p) : null;
  C.pantalla(p.nombre || "Nuevo trabajador", { atras: `#/obra/${id}/sst/personal`, subtitulo: "SST-FO-14" },
    hb ? h("div", { class: "decision " + (hb.estado === "mal" ? "mal" : hb.estado === "ojo" ? "ojo" : "bien") }, h("div", { class: "t-nom" }, { bien: "Habilitado para trabajar", ojo: "Habilitado, con pendientes", mal: "NO habilitado" }[hb.estado]),
      hb.falta.length || hb.ojo.length ? h("ul", {}, [...hb.falta, ...hb.ojo].map(x => h("li", {}, x))) : null) : null,
    h("div", { class: "form" },
      inp("nombre", "Nombre completo"), h("div", { class: "fila2" }, inp("cedula", "Cédula", "text", { inputmode: "numeric" }), inp("cargo", "Cargo")),
      inp("ingreso", "Fecha de ingreso", "date"),
      h("h2", {}, "Seguridad social"), h("div", { class: "fila2" }, inp("eps", "EPS"), inp("afp", "AFP (pensión)")),
      h("div", { class: "fila2" }, inp("arl", "ARL"), sel("claseRiesgo", "Clase de riesgo", ["I", "II", "III", "IV", "V"])),
      h("div", { class: "fila2" }, inp("caja", "Caja de compensación"), inp("pila", "Último aporte PILA (fecha)", "date")),
      h("h2", {}, "Salud y competencias"), h("div", { class: "fila2" }, sel("concepto", "Concepto médico", CONCEPTOS), inp("fechaConcepto", "Fecha del concepto", "date")),
      h("div", { class: "fila2" }, sel("alturasNivel", "Certificado de alturas", NIVELES_ALTURAS), inp("alturasVence", "Vigencia alturas (vence)", "date")),
      inp("induccion", "Fecha de inducción SST", "date"), inp("retiro", "Fecha de retiro", "date"), inp("obs", "Observaciones"),
      h("h2", {}, "Soportes (foto del documento)"), gal,
      h("div", { class: "fila2" }, tipoSop, h("label", { class: "btn sec" }, C.ico("camara"), "Agregar soporte",
        h("input", { type: "file", accept: "image/*", hidden: true, onchange: async e => { const f = e.target.files[0]; if (!f) return; const b = await C.comprimir(f, 1400, 0.7);
          soportes.push({ tipo: tipoSop.value, img: await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }) }); pintarSop(); } }))),
      h("button", { class: "btn grande", onclick: async () => { if (!p.nombre?.trim()) return alert("Escriba el nombre."); p.nombre = p.nombre.trim(); await C.db.guardar("personal", p); C.toast("Guardado"); C.ir(`#/obra/${id}/sst/personal`); } }, "Guardar")));
}

// ---------------------------------------------------------------- lista "antes de iniciar la obra" (se recuerda en cada obra nueva)
export async function pendientesInicio(id, d) {
  d = d || await C.cargarObra(id);
  const regs = await C.db.deObra("sst", id);
  const activos = d.personal.filter(p => !p.retiro);
  const hb = activos.map(p => habilitacion(p));
  const conEPP = new Set(regs.filter(r => r.formato === "FO-10" && r.estado === "guardado").map(r => r.datos.trabajador?.id));
  const e = d.obra.sst || {}, manual = e.checks || {};
  return [
    { k: "personal", l: "Personal con ARL, EPS, pensión y PILA (FO-14)", ok: activos.length > 0 && hb.every(x => x.cumple.arl), href: "personal",
      det: activos.length ? `${hb.filter(x => x.cumple.arl).length} de ${activos.length} con ARL` : "No hay personal registrado" },
    { k: "medico", l: "Exámenes médicos de ingreso con concepto (FO-16 / FO-17)", ok: activos.length > 0 && hb.every(x => x.cumple.medico), href: "personal",
      det: activos.length ? `${hb.filter(x => x.cumple.medico).length} de ${activos.length} con concepto apto` : "" },
    { k: "induccion", l: "Inducción SST de la obra (FO-13)", ok: regs.some(r => r.formato === "FO-13" && /Inducci/.test(r.datos.tipo || "") && r.estado === "guardado"), nuevo: "FO-13" },
    { k: "epp", l: "Entrega de EPP y dotación a cada trabajador (FO-10)", ok: activos.length > 0 && activos.every(p => conEPP.has(p.id)), nuevo: "FO-10",
      det: activos.length ? `${activos.filter(p => conEPP.has(p.id)).length} de ${activos.length} con entrega firmada` : "" },
    { k: "botiquin", l: "Botiquín, camilla y extintores revisados (FO-11)", ok: regs.some(r => r.formato === "FO-11" && r.estado === "guardado"), nuevo: "FO-11" },
    { k: "emergencias", l: "Emergencias y rescate: ARL, centro de salud, punto de encuentro", ok: !!(e.arl && e.centro && e.punto), href: "emergencias" },
    { k: "autorreporte", l: "Autorreporte de condiciones de salud firmado (FO-15, en papel)", ok: !!manual.autorreporte, manual: true },
  ];
}

// ---------------------------------------------------------------- inicio del módulo SST
async function vistaSST(id) {
  const { h } = C; const d = await C.cargarObra(id); const regs = await registros(id); const tareas = await C.db.deObra("tareasSST", id);
  const hbs = d.personal.filter(p => !p.retiro).map(p => habilitacion(p));
  const malos = hbs.filter(x => x.estado === "mal").length, ojos = hbs.filter(x => x.estado === "ojo").length;
  const abiertos = regs.filter(r => r.estado === "autorizado" && tieneCierre(FORMATOS[r.formato]));
  const ultBot = regs.find(r => r.formato === "FO-11" && r.estado === "guardado");
  const diasBot = ultBot ? diasEntre(ultBot.datos.fecha || ultBot.creado.slice(0, 10), C.hoy()) : null;
  const charlaHoy = regs.some(r => r.formato === "FO-13" && r.datos.fecha === C.hoy());
  const e = d.obra.sst || {};
  const ini = await pendientesInicio(id, d);
  const fila = (k, n, sub, extra) => h("button", { class: "tarjeta fila", onclick: () => crearRegistro(id, k) }, h("div", {}, h("div", { class: "t-nom" }, n), h("div", { class: "t-sub" }, sub)), extra || C.ico("sumar"));
  C.pantalla("SST de la obra", { atras: `#/obra/${id}/resumen`, subtitulo: d.obra.nombre },
    abiertos.length ? h("div", { class: "alerta ambar" }, C.ico("alerta"), `${abiertos.length} permiso(s) abierto(s): ciérrelos al terminar la tarea.`) : null,
    h("h2", {}, `1. Antes de iniciar la obra (${ini.filter(x => x.ok).length} de ${ini.length})`),
    h("div", { class: "lista-mat checklist" }, ini.map(x => h(x.manual ? "label" : "a", { class: "fila-mat" + (x.ok ? "" : " ojo"), href: x.href ? `#/obra/${id}/sst/${x.href}` : null,
        onclick: x.nuevo && !x.ok ? (ev => { ev.preventDefault(); crearRegistro(id, x.nuevo); }) : null },
      x.manual ? h("input", { type: "checkbox", checked: x.ok, onchange: async ev => { const o = await C.db.uno("obras", id); o.sst = o.sst || {}; o.sst.checks = { ...(o.sst.checks || {}), [x.k]: ev.target.checked }; await C.db.guardar("obras", o); vistaSST(id); } })
        : h("span", { class: "chk-ico" + (x.ok ? " ok" : "") }, x.ok ? "✓" : ""),
      h("div", { class: "fm-txt" }, h("div", { class: "fm-nom" }, x.l), x.det && !x.ok ? h("div", { class: "fm-sub" }, x.det) : null)))),
    h("a", { class: "btn sec", href: `#/obra/${id}/sst/personal` }, `Personal de la obra: ${hbs.length - malos - ojos} habilitado(s) · ${ojos} por revisar · ${malos} no habilitado(s)`),
    h("h2", {}, "2. Cada día"),
    fila("FO-13", "Charla de 5 minutos / capacitación", charlaHoy ? "Ya hay registro hoy" : "Registro de asistencia con firmas (FO-13)", charlaHoy ? h("span", { class: "est bien" }, "Hoy ✓") : null),
    h("h2", {}, "3. Antes de cada tarea crítica"),
    h("a", { class: "btn grande", href: `#/obra/${id}/sst/tarea/nueva` }, C.ico("alerta"), "Nueva tarea crítica (ATS → inspección → permiso)"),
    tareas.length ? h("details", { class: "opcional", open: true }, h("summary", {}, `Tareas registradas (${tareas.length})`),
      ...tareas.sort((a, b) => (b.creado || "").localeCompare(a.creado || "")).slice(0, 15).map(t => h("a", { class: "tarjeta fila", href: `#/obra/${id}/sst/tarea/${t.id}` },
        h("div", {}, h("div", { class: "t-nom" }, TAREAS[t.tipo].l), h("div", { class: "t-sub" }, [C.fechaCorta(t.fecha), t.descripcion].filter(Boolean).join(" · ")))))) : null,
    h("details", { class: "opcional" }, h("summary", {}, "Inspección de un equipo suelta (FO-02)"),
      ...[1, 2, 3, 4, 5, 6, 7].map(n => fila(`FO-02-${n}`, FORMATOS[`FO-02-${n}`].subtitulo, `Hoja ${n} de 7`))),
    h("h2", {}, "4. Cuando haga falta"),
    fila("FO-10", "Entrega de EPP y dotación", "Uno por trabajador, firmado (FO-10)"),
    fila("FO-12", "Reportar acto o condición insegura", "Con foto, se puede dejar sin nombre (FO-12)"),
    h("h2", {}, "5. Cada mes"),
    fila("FO-11", "Botiquín, camilla y extintores", ultBot ? `Última: ${C.fechaCorta(ultBot.datos.fecha)}` + (diasBot > 30 ? " · VENCIDA" : ` · próxima en ${30 - diasBot} días`) : "Sin inspección todavía",
      h("span", { class: "est " + (!ultBot || diasBot > 30 ? "mal" : diasBot > 25 ? "ojo" : "bien") }, !ultBot || diasBot > 30 ? "Pendiente" : "Al día")),
    h("h2", {}, `Registros (${regs.length})`),
    regs.length ? h("div", { class: "lista-mat" }, regs.slice(0, 40).map(r => { const [es, c] = estadoRegistro(r);
      return h("a", { class: "fila-mat", href: `#/obra/${id}/sst/r/${r.id}` }, h("div", { class: "fm-txt" }, h("div", { class: "fm-nom" }, `${nombreFormato(r.formato)} N.º ${r.numero}`),
        h("div", { class: "fm-sub" }, [C.fechaCorta(r.datos.fecha), r.datos.tarea || r.datos.tema || r.datos.equipo || r.datos.trabajador?.nombre || ""].filter(Boolean).join(" · "))), h("span", { class: "est " + c }, es)); }))
      : h("div", { class: "vacio" }, "Todavía no hay registros SST en esta obra."),
    C.tabs(id, "mas"));
}
async function vistaEmergencias(id) {
  const { h } = C; const o = await C.db.uno("obras", id); const e = o.sst = o.sst || {};
  const inp = (k, l, ph) => h("label", { class: "campo" }, h("span", {}, l), h("input", { value: e[k] || "", placeholder: ph || "", oninput: ev => { e[k] = ev.target.value; } }));
  C.pantalla("Emergencias y rescate", { atras: `#/obra/${id}/sst`, subtitulo: o.nombre },
    h("p", { class: "nota" }, "Estos datos se copian solos en el ATS y en los permisos."),
    h("div", { class: "form" }, inp("arl", "Línea de atención ARL SURA", "Verifique la línea vigente"), inp("centro", "Centro de salud / IPS más cercana"), inp("traslado", "Tiempo de traslado", "15 minutos"),
      inp("punto", "Punto de encuentro"), inp("brigadista", "Brigadista / primer respondiente"), inp("rescatistas", "Rescatistas de alturas en la obra"),
      h("button", { class: "btn grande", onclick: async () => { await C.db.guardar("obras", o); C.toast("Guardado"); C.ir(`#/obra/${id}/sst`); } }, "Guardar")));
}

export async function rutaSST(id, p) {
  // p = ["sst", ...]
  const [, a, b] = p;
  if (!a) return vistaSST(id);
  if (a === "personal") return vistaPersonalSST(id);
  if (a === "trab") return vistaTrabajador(id, b);
  if (a === "emergencias") return vistaEmergencias(id);
  if (a === "r") return vistaRegistro(id, b);
  if (a === "tarea") return b === "nueva" ? vistaNuevaTarea(id) : vistaTarea(id, b);
  if (a === "nuevo") return crearRegistro(id, b);
  return vistaSST(id);
}
