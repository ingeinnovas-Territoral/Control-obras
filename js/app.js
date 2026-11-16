// Control de Obras — app de campo (funciona sin internet).
import * as db from "./db.js";
import { extraerTexto, extraerDatos } from "./contrato.js";
import { llenarExcel } from "./miexcel.js";

const EMPRESAS = {
  "FLASSSERVIC S.A.S.": { nit: "900.740.386-7" },
  "INGEINNOVA TERRITORIAL S.A.S.": { nit: "902.114.773-7" },
  "Otra": { nit: "" },
};
const CLIMA = ["Día soleado", "Parcialmente nublado", "Nublado", "Lluvia ligera", "Lluvia fuerte"];
const PRECIP = ["Sin precipitaciones", "Lluvia ligera", "Lluvia moderada", "Lluvia fuerte"];
const EPP = ["Cumple", "Cumple parcialmente", "No cumple"];

// ------------------------------------------------------------------ utilidades
const $ = s => document.querySelector(s);
function h(tag, attrs = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "value") el.value = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of hijos.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const pesos = n => (n < 0 ? "-$ " : "$ ") + Math.abs(Math.round(n || 0)).toLocaleString("es-CO");
const num = (n, d = 2) => (n || 0).toLocaleString("es-CO", { maximumFractionDigits: d });
const pct = n => (isFinite(n) ? (n * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 }) : "0") + " %";
function hoy() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
function fechaLarga(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fechaCorta(iso) { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }
function toast(msg) {
  const t = h("div", { class: "toast" }, msg);
  document.body.append(t); setTimeout(() => t.classList.add("ver"), 10);
  setTimeout(() => { t.classList.remove("ver"); setTimeout(() => t.remove(), 300); }, 2600);
}
const ICONOS = {
  home: "M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6",
  bitacora: "M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM9 4v16M13 8h2M13 12h2",
  avance: "M3 17l6-6 4 4 8-8M14 7h7v7",
  camara: "M5 7h1a2 2 0 0 0 2-2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2M9 13a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  mas: "M4 6h16M4 12h16M4 18h16",
  sumar: "M12 5v14M5 12h14",
  subir: "M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 9l5-5 5 5M12 4v12",
  bajar: "M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 11l5 5 5-5M12 4v12",
  atras: "M15 6l-6 6 6 6",
  pin: "M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0M17.66 16.66L13.41 20.9a2 2 0 0 1-2.83 0l-4.24-4.24a8 8 0 1 1 11.32 0z",
  alerta: "M12 9v4M12 16h.01M10.24 3.96L2.65 17a2 2 0 0 0 1.73 3h15.24a2 2 0 0 0 1.73-3L13.76 3.96a2 2 0 0 0-3.52 0z",
  nube: "M7 18a4.6 4.4 0 0 1 0-9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7H7M9.5 14.5l2 2 3.5-3.5",
  obra: "M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01",
  doc: "M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2zM9 13h6M9 17h6",
  papelera: "M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3",
  plata: "M17 8V5a1 1 0 0 0-1-1H6a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6M20 12v4h-4a2 2 0 0 1 0-4h4",
  excel: "M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2zM9 12l4 5M13 12l-4 5",
  lapiz: "M4 20h4L18.5 9.5a2.83 2.83 0 0 0-4-4L4 16v4M13.5 6.5l4 4",
};
function ico(n) { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "ic"); s.setAttribute("aria-hidden", "true");
  s.innerHTML = `<path d="${ICONOS[n]}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`; return s; }
function anillo(p) {
  const C = 2 * Math.PI * 34, v = Math.max(0, Math.min(1, p)) * C;
  return h("span", { html: `<svg width="84" height="84" viewBox="0 0 80 80"><circle class="pista" cx="40" cy="40" r="34" fill="none" stroke-width="8"/><circle class="valor" cx="40" cy="40" r="34" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="${v.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 40 40)"/><text class="pct" x="40" y="45" text-anchor="middle" font-size="15">${(p * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%</text></svg>` });
}
function etiquetaItem(it) { return it.etiqueta || ((it.codigo ? it.codigo + " – " : "") + it.descripcion); }
function ir(hash) { location.hash = hash; }

// ------------------------------------------------------------------ estado de sincronización
async function pintarSync() {
  const n = await db.contarPendientes();
  const el = $("#sync"); if (!el) return;
  const linea = navigator.onLine ? "En línea" : "Sin internet";
  el.className = "sync " + (navigator.onLine ? "on" : "off");
  el.textContent = `${linea} · ${n === 0 ? "todo guardado" : n + " cambio" + (n === 1 ? "" : "s") + " guardado" + (n === 1 ? "" : "s") + " en el celular"}`;
}
db.alCambiar(pintarSync);
addEventListener("online", pintarSync); addEventListener("offline", pintarSync);

// ------------------------------------------------------------------ cálculos de una obra
async function cargarObra(id) {
  const [obra, items, avances, bitacora, fotos, personal] = await Promise.all([
    db.uno("obras", id), db.deObra("items", id), db.deObra("avances", id),
    db.deObra("bitacora", id), db.deObra("fotos", id), db.deObra("personal", id)]);
  items.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const ejec = {};
  for (const a of avances) ejec[a.itemId] = (ejec[a.itemId] || 0) + (Number(a.cantidad) || 0);
  let cd = 0, cdEj = 0;
  for (const it of items) { cd += it.cantidad * it.vu; cdEj += (ejec[it.id] || 0) * it.vu; }
  const factor = obra.totalPresupuesto && cd ? obra.totalPresupuesto / cd : 1 + (Number(obra.aiu) || 0) / 100;
  const dias = obra.inicio ? Math.max(0, Math.floor((new Date(hoy()) - new Date(obra.inicio)) / 864e5) + 1) : 0;
  return { obra, items, avances, bitacora, fotos, personal, ejec, cd, cdEj, factor,
           avance: cd ? cdEj / cd : 0, dias, tiempo: obra.plazo ? Math.min(1, dias / obra.plazo) : 0 };
}

// ------------------------------------------------------------------ marco de pantalla
function pantalla(titulo, { atras, subtitulo, acciones, alta } = {}, ...cuerpo) {
  const app = $("#app"); app.innerHTML = "";
  app.append(
    h("header", { class: "barra" + (alta ? " alta" : "") },
      atras ? h("button", { class: "atras", onclick: () => ir(atras), "aria-label": "Atrás" }, ico("atras")) : h("span", { class: "marca" }, ico("obra")),
      h("div", { class: "titulos" }, h("h1", {}, titulo), subtitulo ? h("div", { class: "sub" }, subtitulo) : null),
      acciones || null),
    h("div", { id: "sync", class: "sync" }),
    h("main", {}, ...cuerpo));
  pintarSync();
  window.scrollTo(0, 0);
}
function tabs(obraId, activa) {
  const t = [["resumen", "Resumen", "home"], ["bitacora", "Bitácora", "bitacora"], ["avance", "Avance", "avance"], ["fotos", "Fotos", "camara"], ["gastos", "Gastos", "plata"], ["mas", "Más", "mas"]];
  return h("nav", { class: "tabs" }, t.map(([k, n, i]) =>
    h("a", { href: `#/obra/${obraId}/${k}`, class: k === activa ? "activa" : "" }, ico(i), n)));
}

// ------------------------------------------------------------------ INICIO: lista de obras
async function vistaInicio() {
  const obras = (await db.todos("obras")).sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
  const tarjetas = [];
  for (const o of obras) {
    const d = await cargarObra(o.id);
    const ult = d.bitacora.map(b => b.fecha).sort().pop();
    tarjetas.push(h("a", { class: "tarjeta obra", href: `#/obra/${o.id}/resumen` },
      h("button", { class: "quitar", "aria-label": "Borrar obra", onclick: async e => {
        e.preventDefault(); e.stopPropagation();
        if (await borrarObra(o.id, o.nombre)) vistaInicio(); } }, ico("papelera")),
      h("div", { class: "t-emp" }, o.empresa || ""),
      h("div", { class: "t-nom" }, o.nombre || "(sin nombre)"),
      h("div", { class: "t-sub" }, [o.municipio, o.contrato ? "Contrato " + o.contrato : ""].filter(Boolean).join(" · ")),
      h("div", { class: "prog" }, h("div", { style: `width:${Math.min(100, d.avance * 100)}%` })),
      h("div", { class: "t-pie" }, h("span", {}, "Avance " + pct(d.avance)), h("span", {}, ult ? "Última bitácora " + fechaCorta(ult) : "Sin bitácora"))));
  }
  pantalla("Control de Obras", { subtitulo: "Sus obras" },
    tarjetas.length ? tarjetas : h("div", { class: "vacio" }, "Todavía no hay obras. Cree la primera."),
    h("div", { class: "mosaico" },
    h("button", { class: "tile", onclick: () => ir("#/nueva") }, ico("sumar"), "Nueva obra"),
    h("label", { class: "tile verde" }, ico("subir"), "Importar desde mi Excel",
      h("input", { type: "file", hidden: true, accept: ".xlsm,.xlsx,.xls", onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        toast("Leyendo el Excel…");
        try { const r = await importarControl(f); toast(r.resumen); ir(`#/obra/${r.id}/resumen`); }
        catch (err) { console.error(err); alert(err.message); }
      } }))),
    h("details", { class: "aparte" },
      h("summary", {}, "Copia de seguridad"),
      h("p", { class: "nota" }, "Mientras se activa la nube, los datos viven en este celular. Saque una copia cada semana y guárdela en su correo o en Archivos."),
      h("button", { class: "btn sec", onclick: copiaSeguridad }, "Descargar copia de seguridad"),
      h("label", { class: "btn sec" }, "Restaurar una copia", h("input", { type: "file", accept: ".json,application/json", hidden: true, onchange: restaurarCopia }))));
}

async function borrarObra(id, nombre) {
  const r = prompt(`Va a borrar la obra "${nombre || "sin nombre"}" con toda su bitácora, avances y fotos. No se puede deshacer.\n\nSi está seguro, escriba BORRAR`);
  if ((r || "").trim().toUpperCase() !== "BORRAR") { if (r !== null) toast("No se borró: debe escribir BORRAR"); return false; }
  for (const s of ["items", "personal", "bitacora", "avances", "fotos", "gastos", "documentos"]) for (const x of await db.deObra(s, id)) await db.borrar(s, x.id);
  await db.borrar("obras", id); toast("Obra borrada"); return true;
}

async function copiaSeguridad() {
  toast("Preparando copia…");
  const json = await db.exportarTodo();
  const blob = new Blob([JSON.stringify(json)], { type: "application/json" });
  await entregarArchivo(blob, `Copia Control de Obras ${hoy()}.json`);
}
async function restaurarCopia(e) {
  const f = e.target.files[0]; if (!f) return;
  if (!confirm("¿Restaurar esta copia? Se agregan o reemplazan los registros que contiene.")) return;
  try { await db.importarTodo(JSON.parse(await f.text())); toast("Copia restaurada"); vistaInicio(); }
  catch (err) { alert(err.message); }
}

// ------------------------------------------------------------------ OBRA: crear / editar datos
async function vistaDatosObra(id) {
  const o = id ? await db.uno("obras", id) : { empresa: "FLASSSERVIC S.A.S.", inicio: hoy(), plazo: 60 };
  const campo = (lab, name, tipo = "text", extra = {}) =>
    h("label", { class: "campo" }, h("span", {}, lab), h("input", { name, type: tipo, value: o[name] ?? "", ...extra }));
  let docPendiente = null;
  const revision = h("div", { class: "revision" });
  const form = h("form", { class: "form", onsubmit: async ev => {
      ev.preventDefault();
      const fd = new FormData(form);
      for (const [k, v] of fd.entries()) o[k] = v;
      o.plazo = Number(o.plazo) || 0; o.aiu = o.aiu === "" ? "" : Number(o.aiu);
      o.valor = o.valor === "" ? "" : Number(String(o.valor).replace(/[^\d]/g, "")) || "";
      o.anticipoPct = o.anticipoPct === "" ? "" : Number(o.anticipoPct);
      if (!o.creado) o.creado = new Date().toISOString();
      await db.guardar("obras", o);
      if (docPendiente) { docPendiente.obraId = o.id; await db.guardar("documentos", docPendiente); }
      toast("Obra guardada");
      ir(`#/obra/${o.id}/${id ? "mas" : "resumen"}`);
    } },
    h("label", { class: "btn sec" }, "📄 Cargar contrato u orden de servicio (PDF o Word)",
      h("input", { type: "file", hidden: true, accept: ".pdf,.docx,application/pdf", onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        revision.innerHTML = ""; revision.append(h("div", { class: "nota" }, "Leyendo el documento…"));
        try {
          const texto = await extraerTexto(f);
          docPendiente = { tipo: "Contrato / orden de servicio", nombre: f.name, blob: f, creado: new Date().toISOString() };
          if (texto.replace(/\s/g, "").length < 200) {
            revision.innerHTML = "";
            revision.append(h("div", { class: "alerta" }, "El documento parece escaneado (una imagen): no se puede leer el texto sin internet. Llene los datos a mano; el documento quedará guardado en la obra."));
            return;
          }
          const datos = extraerDatos(texto); docPendiente.datos = datos;
          mostrarRevision(datos);
        } catch (err) { revision.innerHTML = ""; revision.append(h("div", { class: "alerta" }, err.message)); }
      } })),
    revision,
    campo("Objeto / nombre de la obra *", "nombre", "text", { required: true }),
    h("label", { class: "campo" }, h("span", {}, "Empresa que ejecuta"),
      h("select", { name: "empresa" }, Object.keys(EMPRESAS).map(e => h("option", { value: e, selected: o.empresa === e }, e)))),
    campo("Contrato N.º", "contrato"),
    campo("Entidad contratante", "entidad"),
    h("div", { class: "fila2" }, campo("Municipio", "municipio"), campo("Departamento", "depto")),
    h("div", { class: "fila2" }, campo("Fecha de inicio", "inicio", "date"), campo("Plazo (días)", "plazo", "number", { min: 0, inputmode: "numeric" })),
    h("div", { class: "fila2" }, campo("Valor del contrato ($)", "valor", "text", { inputmode: "numeric" }), campo("Anticipo (%)", "anticipoPct", "number", { step: "0.01", inputmode: "decimal" })),
    campo("Fecha de firma del contrato", "fechaContrato", "date"),
    campo("Residente de obra", "residente"),
    campo("Supervisor / interventor", "supervisor"),
    campo("AIU % (solo si el presupuesto no trae VALOR TOTAL)", "aiu", "number", { step: "0.01", inputmode: "decimal" }),
    h("button", { class: "btn grande", type: "submit" }, id ? "Guardar cambios" : "Crear obra"));
  function mostrarRevision(datos) {
    const campos = [["empresa", "Contratista"], ["tipoDoc", "Tipo de documento", true], ["contrato", "N.º"], ["nombre", "Objeto", false, "objeto"], ["entidad", "Entidad contratante"],
      ["valor", "Valor"], ["plazo", "Plazo (días)"], ["municipio", "Municipio"], ["depto", "Departamento"], ["supervisor", "Supervisor"],
      ["anticipoPct", "Anticipo (%)"], ["fechaContrato", "Fecha de firma"]];
    revision.innerHTML = "";
    const filas = [];
    for (const [k, lab, soloInfo, origen] of campos) {
      const v = datos[origen || k];
      if (v === undefined || v === "") { filas.push(h("div", { class: "rev no" }, h("span", {}, lab), h("i", {}, "no encontrado"))); continue; }
      const mostrar = k === "valor" ? pesos(v) : k === "fechaContrato" ? fechaCorta(v) : k === "plazo" ? `${v} días (${datos.plazoTxt || ""})` : String(v);
      filas.push(h("label", { class: "rev" }, soloInfo ? h("span", {}) : h("input", { type: "checkbox", checked: true, "data-k": k, "data-v": String(v) }),
        h("span", {}, lab), h("b", {}, mostrar)));
    }
    revision.append(h("div", { class: "tarjeta" },
      h("div", { class: "t-nom" }, "Esto encontré en el documento"),
      h("div", { class: "nota" }, "Revise. Lo marcado se copia al formulario y lo puede corregir antes de guardar."),
      ...filas,
      h("button", { class: "btn", type: "button", onclick: () => {
        for (const c of revision.querySelectorAll("input[data-k]")) if (c.checked) {
          const el = form.elements[c.dataset.k]; if (el) el.value = c.dataset.v;
        }
        revision.innerHTML = ""; revision.append(h("div", { class: "nota" }, "✔ Datos copiados. Revise el formulario y guarde."));
      } }, "Usar estos datos")));
  }
  pantalla(id ? "Datos de la obra" : "Nueva obra", { atras: id ? `#/obra/${id}/mas` : "#/" }, form);
}

// ------------------------------------------------------------------ OBRA: resumen
async function vistaResumen(id) {
  const d = await cargarObra(id); const o = d.obra;
  const ultFotos = d.fotos.sort((a, b) => (b.creado || "").localeCompare(a.creado || "")).slice(0, 6);
  const top = d.items.filter(i => d.ejec[i.id]).slice(0, 8);
  const sub = h("span", {}, ico("pin"), [o.empresa, o.municipio].filter(Boolean).join(" · "));
  pantalla(o.nombre, { atras: "#/", subtitulo: sub, alta: true },
    h("div", { class: "anillo" }, anillo(d.avance),
      h("div", { class: "anillo-txt" }, d.cd ? [h("span", {}, "Ejecutado"), h("b", {}, pesos(d.cdEj * d.factor)), h("span", {}, "de " + pesos(d.cd * d.factor))]
        : [h("span", {}, "Avance de obra"), h("b", {}, o.valor ? pesos(o.valor) : "—"), h("span", {}, "Cargue el presupuesto en Más")])),
    h("div", { class: "kpis" },
      kpi("Tiempo", o.plazo ? `Día ${Math.min(d.dias, o.plazo)}/${o.plazo}` : "—", o.plazo ? pct(d.tiempo) + " del plazo" : "Sin plazo"),
      kpi("Bitácora", d.bitacora.length + (d.bitacora.length === 1 ? " día" : " días"), "registrados"),
      kpi("Fotos", d.fotos.length, "en la obra"),
      kpi("Personal", d.personal.length, "en la cuadrilla")),
    d.cd && d.avance < d.tiempo - 0.1 ? h("div", { class: "alerta ambar" }, ico("alerta"), `Va ${Math.round((d.tiempo - d.avance) * 100)} puntos atrás del tiempo`) : null,
    h("div", { class: "mosaico" },
      h("button", { class: "tile", onclick: () => ir(`#/obra/${id}/bitacora/${hoy()}`) }, ico("bitacora"), "Bitácora de hoy"),
      h("button", { class: "tile verde", onclick: () => tomarFotos(id) }, ico("camara"), "Foto rápida"),
      h("button", { class: "tile claro", onclick: () => ir(`#/obra/${id}/avance/nuevo`) }, ico("avance"), "Registrar avance"),
      h("button", { class: "tile claro", onclick: () => ir(`#/obra/${id}/gastos/nuevo`) }, ico("plata"), "Registrar gasto"),
      h("button", { class: "tile claro ancho", onclick: () => ir(`#/obra/${id}/tablero`) }, ico("avance"), "Tablero · ¿cómo va la plata?")),
    top.length ? h("section", {}, h("h2", {}, "Ítems con avance"), ...top.map(it => filaItem(it, d.ejec[it.id] || 0))) : null,
    ultFotos.length ? h("section", {}, h("h2", {}, "Últimas fotos"), galeria(ultFotos, id)) : null,
    tabs(id, "resumen"));
}
const kpi = (lab, val, sub) => h("div", { class: "kpi" }, h("div", { class: "k-lab" }, lab), h("div", { class: "k-val" }, String(val)), h("div", { class: "k-sub" }, sub));
function filaItem(it, ej) {
  const p = it.cantidad ? ej / it.cantidad : 0;
  return h("div", { class: "item" + (p > 1.0001 ? " pasado" : "") },
    h("div", { class: "i-txt" }, h("b", {}, it.codigo || ""), " ", it.descripcion),
    h("div", { class: "prog" }, h("div", { style: `width:${Math.min(100, p * 100)}%` })),
    h("div", { class: "i-num" }, `${num(ej)} de ${num(it.cantidad)} ${it.und || ""} · ${pct(p)}`));
}

// ------------------------------------------------------------------ OBRA: bitácora
async function vistaBitacora(id) {
  const d = await cargarObra(id);
  const dias = d.bitacora.sort((a, b) => b.fecha.localeCompare(a.fecha));
  pantalla("Bitácora", { atras: `#/obra/${id}/resumen`, subtitulo: d.obra.nombre },
    h("button", { class: "btn grande", onclick: () => ir(`#/obra/${id}/bitacora/${hoy()}`) }, ico("lapiz"), "Registrar el día de hoy"),
    h("label", { class: "campo inline" }, h("span", {}, "Otro día:"),
      h("input", { type: "date", onchange: e => e.target.value && ir(`#/obra/${id}/bitacora/${e.target.value}`) })),
    dias.length ? dias.map(b => {
      const nAv = d.avances.filter(a => a.fecha === b.fecha).length, nFo = d.fotos.filter(f => f.fecha === b.fecha).length;
      return h("a", { class: "tarjeta dia", href: `#/obra/${id}/bitacora/${b.fecha}` },
        h("div", { class: "t-nom" }, fechaLarga(b.fecha)),
        h("div", { class: "t-sub" }, [b.clima, b.jornada && b.jornada !== "Normal" ? b.jornada : "", `${nAv} avance(s)`, `${nFo} foto(s)`].filter(Boolean).join(" · ")),
        b.novedades ? h("div", { class: "t-txt" }, b.novedades) : null);
    }) : h("div", { class: "vacio" }, "Sin días registrados."),
    tabs(id, "bitacora"));
}

async function vistaDia(id, fecha) {
  const d = await cargarObra(id);
  const b = d.bitacora.find(x => x.fecha === fecha) || { obraId: id, fecha, clima: CLIMA[0], precipitacion: PRECIP[0], afecto: "No",
    jornada: "Normal", horas: 9, epp: "Cumple", incidentes: "Ninguno", ausentes: [] };
  const ausentes = new Set(b.ausentes || []);
  const sel = (name, ops) => h("select", { name }, ops.map(x => h("option", { selected: b[name] === x }, x)));
  const area = (lab, name, ph) => h("label", { class: "campo" }, h("span", {}, lab), h("textarea", { name, rows: 3, placeholder: ph || "" }, b[name] || ""));
  const avDia = d.avances.filter(a => a.fecha === fecha);
  const foDia = d.fotos.filter(f => f.fecha === fecha);
  const gaDia = (await db.deObra("gastos", id)).filter(g => g.fecha === fecha);
  const form = h("form", { class: "form", onsubmit: async ev => {
      ev.preventDefault();
      const fd = new FormData(form);
      for (const k of ["clima", "precipitacion", "afecto", "jornada", "horas", "charla", "epp", "incidentes", "ambiental", "novedades"]) b[k] = fd.get(k) ?? "";
      b.horas = String(b.horas).trim() === "" ? "" : Number(b.horas) || 0;
      b.ausentes = [...form.querySelectorAll("input[name=presente]")].filter(c => !c.checked).map(c => c.value);
      await db.guardar("bitacora", b);
      toast("Día guardado"); ir(`#/obra/${id}/bitacora`);
    } },
    h("div", { class: "fila2" },
      h("label", { class: "campo" }, h("span", {}, "Condición del día"), sel("clima", CLIMA)),
      h("label", { class: "campo" }, h("span", {}, "Precipitación"), sel("precipitacion", PRECIP))),
    h("div", { class: "fila2" },
      h("label", { class: "campo" }, h("span", {}, "¿Afectó la obra?"), sel("afecto", ["No", "Sí"])),
      h("label", { class: "campo" }, h("span", {}, "Horas trabajadas"), h("input", { name: "horas", type: "number", inputmode: "decimal", value: b.horas }))),
    h("label", { class: "campo" }, h("span", {}, "Jornada"), h("input", { name: "jornada", value: b.jornada || "Normal" })),
    h("fieldset", { class: "personal" }, h("legend", {}, "Personal en obra (quite a los ausentes)"),
      d.personal.length ? d.personal.map(p => h("label", { class: "chk" },
        h("input", { type: "checkbox", name: "presente", value: p.nombre, checked: !ausentes.has(p.nombre) }), `${p.nombre} · ${p.cargo}`))
        : h("div", { class: "nota" }, "Agregue el personal en Más › Personal.")),
    h("label", { class: "campo" }, h("span", {}, "Charla de 5 minutos – tema"), h("input", { name: "charla", value: b.charla || "" })),
    h("div", { class: "fila2" },
      h("label", { class: "campo" }, h("span", {}, "Uso de EPP"), sel("epp", EPP)),
      h("label", { class: "campo" }, h("span", {}, "Incidentes / accidentes"), h("input", { name: "incidentes", value: b.incidentes || "" }))),
    area("Manejo ambiental", "ambiental"),
    area("Novedades, visitas, órdenes y materiales recibidos", "novedades"),
    h("button", { class: "btn grande", type: "submit" }, "Guardar el día"));
  pantalla(fechaLarga(fecha), { atras: `#/obra/${id}/bitacora`, subtitulo: "Bitácora · " + d.obra.nombre },
    form,
    h("section", {}, h("h2", {}, "Avance de este día"),
      avDia.length ? avDia.map(a => filaAvance(a, d, id)) : h("div", { class: "nota" }, "Sin avance registrado este día."),
      h("button", { class: "btn sec", onclick: () => ir(`#/obra/${id}/avance/nuevo/${fecha}`) }, "+ Registrar avance de este día")),
    h("section", {}, h("h2", {}, "Fotos de este día"),
      foDia.length ? galeria(foDia, id) : h("div", { class: "nota" }, "Sin fotos este día."),
      h("button", { class: "btn sec", onclick: () => tomarFotos(id, { fecha }) }, ico("camara"), "Tomar fotos de este día")),
    h("section", {}, h("h2", {}, "Gastos de este día"),
      gaDia.length ? gaDia.map(g => filaGasto(g, id)) : h("div", { class: "nota" }, "Sin gastos este día."),
      h("button", { class: "btn sec", onclick: () => ir(`#/obra/${id}/gastos/nuevo/${fecha}`) }, ico("plata"), "Registrar gasto de este día")),
    d.bitacora.find(x => x.fecha === fecha) ? h("button", { class: "btn peligro", onclick: async () => {
      if (!confirm("¿Borrar la bitácora de este día? (no borra el avance ni las fotos)")) return;
      await db.borrar("bitacora", b.id); ir(`#/obra/${id}/bitacora`); } }, "Borrar este día") : null);
}

// ------------------------------------------------------------------ OBRA: avance
function filaAvance(a, d, id) {
  const it = d.items.find(i => i.id === a.itemId);
  return h("a", { class: "tarjeta av", href: `#/obra/${id}/avance/${a.id}` },
    h("div", { class: "t-nom" }, it ? etiquetaItem(it) : "(ítem borrado del presupuesto)"),
    h("div", { class: "t-sub" }, `${fechaCorta(a.fecha)} · ${num(a.cantidad)} ${it?.und || ""}` + (a.frente ? " · " + a.frente : "")));
}
async function vistaAvance(id) {
  const d = await cargarObra(id);
  const lista = d.avances.sort((a, b) => (b.fecha + b.creado).localeCompare(a.fecha + a.creado));
  pantalla("Avance de obra", { atras: `#/obra/${id}/resumen`, subtitulo: d.obra.nombre },
    d.items.length ? h("button", { class: "btn grande", onclick: () => ir(`#/obra/${id}/avance/nuevo`) }, ico("avance"), "Registrar avance")
      : h("div", { class: "alerta" }, "Primero cargue el presupuesto en Más › Presupuesto."),
    h("details", { class: "aparte" }, h("summary", {}, "Avance por ítem del presupuesto"),
      ...d.items.map(it => filaItem(it, d.ejec[it.id] || 0))),
    h("h2", {}, "Registros"),
    lista.length ? lista.map(a => filaAvance(a, d, id)) : h("div", { class: "vacio" }, "Sin avances registrados."),
    tabs(id, "avance"));
}
async function vistaFormAvance(id, avId, fechaIni) {
  const d = await cargarObra(id);
  const a = (avId && avId !== "nuevo") ? d.avances.find(x => x.id === avId) : { obraId: id, fecha: fechaIni || hoy(), creado: new Date().toISOString() };
  if (!a) return ir(`#/obra/${id}/avance`);
  const info = h("div", { class: "nota" });
  const selItem = h("select", { name: "itemId", required: true, onchange: () => pintarInfo() },
    h("option", { value: "" }, "— Elija la actividad del presupuesto —"),
    d.items.map(it => h("option", { value: it.id, selected: a.itemId === it.id }, etiquetaItem(it))));
  const filtro = h("input", { type: "search", placeholder: "Buscar actividad…", oninput: () => {
    const q = filtro.value.toLowerCase();
    for (const op of selItem.options) if (op.value) op.hidden = q && !op.textContent.toLowerCase().includes(q);
  } });
  function pintarInfo() {
    const it = d.items.find(i => i.id === selItem.value);
    info.textContent = it ? `Contratado: ${num(it.cantidad)} ${it.und} · ejecutado hasta hoy: ${num((d.ejec[it.id] || 0) - (a.itemId === it.id ? Number(a.cantidad) || 0 : 0))} ${it.und}` : "";
  }
  const form = h("form", { class: "form", onsubmit: async ev => {
      ev.preventDefault();
      const fd = new FormData(form);
      a.fecha = fd.get("fecha"); a.itemId = fd.get("itemId"); a.cantidad = Number(String(fd.get("cantidad")).replace(",", ".")) || 0;
      a.frente = fd.get("frente"); a.equipo = fd.get("equipo");
      if (!a.itemId || !a.cantidad) return alert("Elija la actividad y escriba la cantidad.");
      await db.guardar("avances", a);
      toast("Avance guardado");
      if (form.dataset.foto) return tomarFotos(id, { fecha: a.fecha, itemId: a.itemId, volver: `#/obra/${id}/avance` });
      ir(`#/obra/${id}/avance`);
    } },
    h("label", { class: "campo" }, h("span", {}, "Fecha"), h("input", { type: "date", name: "fecha", value: a.fecha, required: true })),
    h("label", { class: "campo" }, h("span", {}, "Actividad"), filtro, selItem),
    info,
    h("label", { class: "campo" }, h("span", {}, "Cantidad ejecutada este día"), h("input", { name: "cantidad", inputmode: "decimal", value: a.cantidad ?? "", required: true })),
    h("label", { class: "campo" }, h("span", {}, "Detalle / frente de trabajo"), h("textarea", { name: "frente", rows: 2 }, a.frente || "")),
    h("label", { class: "campo" }, h("span", {}, "Equipo y herramienta"), h("input", { name: "equipo", value: a.equipo || "" })),
    h("button", { class: "btn grande", type: "submit" }, "Guardar avance"),
    h("button", { class: "btn grande sec", type: "submit", onclick: e => { e.target.form.dataset.foto = "1"; } }, "Guardar y tomar foto"));
  pantalla(avId === "nuevo" || !avId ? "Registrar avance" : "Editar avance", { atras: `#/obra/${id}/avance` }, form,
    avId && avId !== "nuevo" ? h("button", { class: "btn peligro", onclick: async () => {
      if (!confirm("¿Borrar este avance?")) return; await db.borrar("avances", a.id); ir(`#/obra/${id}/avance`); } }, "Borrar avance") : null);
  pintarInfo();
}

// ------------------------------------------------------------------ OBRA: fotos
const urls = new Map();
function urlFoto(f) { if (!urls.has(f.id) && f.blob) urls.set(f.id, URL.createObjectURL(f.blob)); return urls.get(f.id); }
function galeria(fotos, id) {
  return h("div", { class: "galeria" }, fotos.map(f => h("a", { href: `#/obra/${id}/foto/${f.id}` }, h("img", { src: urlFoto(f), alt: f.descripcion || "", loading: "lazy" }))));
}
async function vistaFotos(id) {
  const d = await cargarObra(id);
  const porDia = {};
  for (const f of d.fotos.sort((a, b) => (b.creado || "").localeCompare(a.creado || ""))) (porDia[f.fecha] ||= []).push(f);
  pantalla("Registro fotográfico", { atras: `#/obra/${id}/resumen`, subtitulo: d.obra.nombre },
    h("button", { class: "btn grande verde", onclick: () => tomarFotos(id) }, ico("camara"), "Tomar fotos"),
    Object.keys(porDia).length ? Object.keys(porDia).sort().reverse().map(f => h("section", {}, h("h2", {}, fechaLarga(f)), galeria(porDia[f], id)))
      : h("div", { class: "vacio" }, "Sin fotos todavía."),
    tabs(id, "fotos"));
}
async function vistaFoto(id, fotoId) {
  const d = await cargarObra(id);
  const f = d.fotos.find(x => x.id === fotoId); if (!f) return ir(`#/obra/${id}/fotos`);
  const form = h("form", { class: "form", onsubmit: async ev => {
      ev.preventDefault(); const fd = new FormData(form);
      f.descripcion = fd.get("descripcion"); f.itemId = fd.get("itemId") || ""; f.fecha = fd.get("fecha");
      await db.guardar("fotos", f); toast("Foto guardada"); history.back();
    } },
    h("label", { class: "campo" }, h("span", {}, "Descripción"), h("textarea", { name: "descripcion", rows: 2 }, f.descripcion || "")),
    h("label", { class: "campo" }, h("span", {}, "Ítem del presupuesto (opcional)"),
      h("select", { name: "itemId" }, h("option", { value: "" }, "— Ninguno —"), d.items.map(it => h("option", { value: it.id, selected: f.itemId === it.id }, etiquetaItem(it))))),
    h("label", { class: "campo" }, h("span", {}, "Fecha"), h("input", { type: "date", name: "fecha", value: f.fecha })),
    f.lat ? h("div", { class: "nota" }, `Ubicación: ${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}`) : null,
    h("button", { class: "btn grande", type: "submit" }, "Guardar"));
  pantalla("Foto", { atras: `#/obra/${id}/fotos`, subtitulo: fechaLarga(f.fecha) },
    h("img", { class: "foto-grande", src: urlFoto(f), alt: f.descripcion || "" }),
    form,
    h("button", { class: "btn sec", onclick: () => entregarArchivo(f.blob, `Foto ${f.fecha} ${f.id}.jpg`) }, "Compartir / guardar foto"),
    h("button", { class: "btn peligro", onclick: async () => { if (!confirm("¿Borrar esta foto?")) return; await db.borrar("fotos", f.id); ir(`#/obra/${id}/fotos`); } }, "Borrar foto"));
}

function tomarFotos(obraId, { fecha, itemId, volver } = {}) {
  const inp = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true });
  inp.addEventListener("change", async () => {
    const files = [...inp.files]; if (!files.length) return;
    toast(`Guardando ${files.length} foto(s)…`);
    const pos = await ubicacion();
    let ultima = null;
    for (const file of files) {
      const blob = await comprimir(file);
      ultima = await db.guardar("fotos", { obraId, fecha: fecha || hoy(), itemId: itemId || "", descripcion: "", blob,
        lat: pos?.lat, lng: pos?.lng, creado: new Date().toISOString() });
    }
    inp.remove();
    toast(`${files.length} foto(s) guardada(s)`);
    if (files.length === 1 && ultima) ir(`#/obra/${obraId}/foto/${ultima.id}`);
    else ir(volver || `#/obra/${obraId}/fotos`);
  });
  document.body.append(inp); inp.click();
}
function ubicacion() {
  return new Promise(ok => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lng: p.coords.longitude }), () => ok(null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 120000 });
  });
}
async function comprimir(file, max = 1600, calidad = 0.72) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(ok => c.toBlob(ok, "image/jpeg", calidad));
  } catch (e) { console.warn("sin compresión", e); return file; }
}

// ------------------------------------------------------------------ OBRA: más (presupuesto, personal, exportar)
// ------------------------------------------------------------------ OBRA: tablero (¿cómo va la plata?)
const TIPOS_GASTO = ["Materiales", "Mano de obra", "Equipos", "Transporte", "Administración", "Otros"];
const INVERSIONISTAS = ["Héctor Suárez", "Andrés Correa", "Otro"];
async function vistaTablero(id) {
  const d = await cargarObra(id); const o = d.obra;
  const gastos = await db.deObra("gastos", id);
  const valorContrato = d.cd * d.factor, ejecutado = d.cdEj * d.factor;
  const gastado = gastos.reduce((t, g) => t + (Number(g.valor) || 0), 0);
  const utilidad = ejecutado - gastado;
  const avance = valorContrato ? ejecutado / valorContrato : 0;
  const norm = t => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const porTipo = Object.fromEntries(TIPOS_GASTO.map(t => [t, 0]));
  for (const g of gastos) { const t = TIPOS_GASTO.find(x => norm(x) === norm(g.tipo)) || "Otros"; porTipo[t] += Number(g.valor) || 0; }
  const porInv = { "Héctor Suárez": 0, "Andrés Correa": 0, "Otros": 0, "Sin asignar": 0 };
  for (const g of gastos) {
    const i = norm(g.inversionista), v = Number(g.valor) || 0;
    if (i.startsWith("hector")) porInv["Héctor Suárez"] += v; else if (i.startsWith("andres")) porInv["Andrés Correa"] += v;
    else if (i) porInv["Otros"] += v; else porInv["Sin asignar"] += v;
  }
  let estado, clase;
  if (!ejecutado) { estado = "Registre avances para ver el estado de la obra"; clase = "info"; }
  else if (gastado > ejecutado) { estado = "La obra está perdiendo plata: se ha gastado más de lo ejecutado"; clase = "mal"; }
  else if (avance < d.tiempo - 0.1) { estado = "La obra va atrasada: el avance va por debajo del tiempo"; clase = "ojo"; }
  else { estado = "La obra va bien: avance al día y gasto por debajo de lo ejecutado"; clase = "bien"; }
  const barras = (obj, total) => h("div", { class: "barras" }, Object.entries(obj).filter(([, v]) => v > 0 || total === 0).map(([k, v]) =>
    h("div", { class: "barra-f" }, h("div", { class: "bf-top" }, h("span", {}, k), h("b", {}, pesos(v)), h("span", { class: "bf-pct" }, total ? pct(v / total) : "")),
      h("div", { class: "prog" }, h("div", { style: `width:${total ? Math.min(100, v / total * 100) : 0}%` })))));
  pantalla("¿Cómo va la plata?", { atras: `#/obra/${id}/resumen`, subtitulo: o.nombre },
    h("div", { class: "estado " + clase }, ico(clase === "bien" ? "nube" : "alerta"), estado),
    h("div", { class: "kpis" },
      kpi("Avance de obra", pct(avance), "de " + pesos(valorContrato)),
      kpi("Tiempo", pct(d.tiempo), o.plazo ? `${Math.min(d.dias, o.plazo)} de ${o.plazo} días` : "Sin plazo"),
      kpi("Ejecutado", pesos(ejecutado), "con AIU"),
      kpi("Gastado", pesos(gastado), `${gastos.length} gasto(s)`)),
    h("div", { class: "kpi utilidad " + (utilidad < 0 ? "neg" : "pos") }, h("div", { class: "k-lab" }, "Utilidad a la fecha (ejecutado − gastado)"), h("div", { class: "k-val" }, pesos(utilidad))),
    h("section", { class: "tarjeta" }, h("h2", {}, "Tiempo vs avance"), curva(d, gastos, valorContrato)),
    h("section", { class: "tarjeta" }, h("h2", {}, "¿En qué se gastó?"), gastado ? barras(porTipo, gastado) : h("div", { class: "nota" }, "Sin gastos registrados.")),
    h("section", { class: "tarjeta" }, h("h2", {}, "¿Quién ha financiado la obra?"), gastado ? barras(porInv, gastado) : h("div", { class: "nota" }, "Sin gastos registrados.")),
    h("section", { class: "tarjeta" }, h("h2", {}, "Cifras de la obra"),
      ...[["Valor del contrato (del presupuesto)", pesos(valorContrato)], ["Ejecutado (con AIU)", pesos(ejecutado)], ["Gastado", pesos(gastado)],
          ["Días transcurridos", o.plazo ? Math.min(d.dias, o.plazo) : d.dias], ["% tiempo", pct(d.tiempo)], ["Días con registro en bitácora", d.bitacora.length]]
        .map(([a, b]) => h("div", { class: "cifra" }, h("span", {}, a), h("b", {}, String(b))))),
    !gastos.length ? h("p", { class: "nota" }, "Los gastos se traen al importar su Excel de control. Pronto también se podrán registrar aquí.") : null,
    tabs(id, "resumen"));
}
function curva(d, gastos, valorContrato) {
  const o = d.obra, dia = s => { const [y, m, dd] = s.split("-").map(Number); return Date.UTC(y, m - 1, dd) / 864e5; };
  const fechas = [...d.avances.map(a => a.fecha), ...gastos.map(g => g.fecha)].filter(Boolean).sort();
  const ini = o.inicio ? dia(o.inicio) : (fechas.length ? dia(fechas[0]) : null);
  if (ini === null) return h("div", { class: "nota" }, "Ponga la fecha de inicio y el plazo en Datos de la obra para ver la curva.");
  const hoyD = dia(hoy()), fin = o.plazo ? ini + Number(o.plazo) - 1 : Math.max(hoyD, fechas.length ? dia(fechas.at(-1)) : hoyD);
  const vu = Object.fromEntries(d.items.map(i => [i.id, i.vu]));
  const ej = d.avances.map(a => [dia(a.fecha), (Number(a.cantidad) || 0) * (vu[a.itemId] || 0) * d.factor]);
  const ga = gastos.filter(g => g.fecha).map(g => [dia(g.fecha), Number(g.valor) || 0]);
  const acum = (lst, t) => lst.reduce((s, [f, v]) => s + (f <= t ? v : 0), 0);
  const W = 320, H = 170, L = 6, R = 6, T = 10, B = 22, n = Math.max(1, fin - ini);
  const ymax = Math.max(valorContrato, acum(ga, Infinity), acum(ej, Infinity), 1);
  const X = t => L + (t - ini) / n * (W - L - R), Y = v => T + (1 - v / ymax) * (H - T - B);
  const linea = (fn, hasta) => { const pts = []; for (let t = ini; t <= Math.min(fin, hasta); t++) pts.push(`${X(t).toFixed(1)},${Y(fn(t)).toFixed(1)}`); return pts.join(" "); };
  const prog = t => valorContrato * Math.min(1, (t - ini + 1) / (n + 1));
  const fmt = t => { const x = new Date(t * 864e5); return `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}`; };
  const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Curva programado contra ejecutado y gastado">
    <line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="eje"/>
    ${o.plazo ? `<polyline points="${linea(prog, fin)}" fill="none" class="l-prog"/>` : ""}
    <polyline points="${linea(t => acum(ga, t), hoyD)}" fill="none" class="l-gas"/>
    <polyline points="${linea(t => acum(ej, t), hoyD)}" fill="none" class="l-ej"/>
    <text x="${L}" y="${H - 6}" class="ej-t">${fmt(ini)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end" class="ej-t">${fmt(fin)}</text></svg>`;
  return h("div", {}, h("div", { html: svg }),
    h("div", { class: "leyenda" }, o.plazo ? h("span", { class: "lg lg-prog" }, "Programado") : null, h("span", { class: "lg lg-ej" }, "Ejecutado"), h("span", { class: "lg lg-gas" }, "Gastado")));
}

// ------------------------------------------------------------------ OBRA: gastos
function filaGasto(g, id) {
  return h("a", { class: "tarjeta gasto", href: `#/obra/${id}/gastos/${g.id}` },
    h("div", { class: "g-top" }, h("span", { class: "t-emp" }, g.tipo || "Gasto"), h("b", { class: "g-val" }, pesos(g.valor))),
    h("div", { class: "t-nom" }, g.detalle || "(sin detalle)"),
    h("div", { class: "t-sub" }, [fechaCorta(g.fecha), g.proveedor, g.inversionista === "Otro" ? (g.otro || "Otro") : g.inversionista, g.soporte ? "con soporte" : ""].filter(Boolean).join(" · ")));
}
async function vistaGastos(id) {
  const d = await cargarObra(id);
  const gastos = (await db.deObra("gastos", id)).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || (b.creado || "").localeCompare(a.creado || ""));
  const total = gastos.reduce((t, g) => t + (Number(g.valor) || 0), 0);
  const mes = hoy().slice(0, 7), delMes = gastos.filter(g => (g.fecha || "").startsWith(mes)).reduce((t, g) => t + (Number(g.valor) || 0), 0);
  pantalla("Gastos de la obra", { atras: `#/obra/${id}/resumen`, subtitulo: d.obra.nombre },
    h("div", { class: "kpis" }, kpi("Total gastado", pesos(total), `${gastos.length} gasto(s)`), kpi("Este mes", pesos(delMes), "")),
    h("button", { class: "btn grande verde", onclick: () => ir(`#/obra/${id}/gastos/nuevo`) }, ico("sumar"), "Registrar gasto"),
    h("a", { class: "btn sec", href: `#/obra/${id}/tablero` }, ico("avance"), "Ver tablero · ¿cómo va la plata?"),
    gastos.length ? gastos.map(g => filaGasto(g, id)) : h("div", { class: "vacio" }, "Sin gastos registrados."),
    tabs(id, "gastos"));
}
async function vistaFormGasto(id, gId, fechaIni) {
  const d = await cargarObra(id);
  const g = gId !== "nuevo" ? await db.uno("gastos", gId) : { obraId: id, fecha: fechaIni || hoy(), tipo: "Materiales", inversionista: "", creado: new Date().toISOString() };
  if (!g) return ir(`#/obra/${id}/gastos`);
  let soporte = g.soporte || null;
  const vistaSop = h("div", {});
  const pintarSop = () => { vistaSop.innerHTML = ""; if (soporte) vistaSop.append(h("img", { class: "foto-grande", src: URL.createObjectURL(soporte), alt: "Soporte" })); };
  const sel = (name, ops, val) => h("select", { name }, ops.map(x => h("option", { value: x, selected: val === x }, x || "— Sin asignar —")));
  const valor = h("input", { name: "valor", inputmode: "numeric", required: true, value: g.valor ? Math.round(g.valor).toLocaleString("es-CO") : "",
    oninput: () => { const n = valor.value.replace(/\D/g, ""); valor.value = n ? Number(n).toLocaleString("es-CO") : ""; } });
  const form = h("form", { class: "form", onsubmit: async ev => {
      ev.preventDefault(); const fd = new FormData(form);
      g.valor = Number(String(fd.get("valor")).replace(/\D/g, "")) || 0;
      if (!g.valor) return alert("Escriba el valor del gasto.");
      for (const k of ["fecha", "tipo", "detalle", "proveedor", "factura", "item", "inversionista", "otro"]) g[k] = (fd.get(k) ?? "").trim();
      g.soporte = soporte || undefined;
      await db.guardar("gastos", g); toast("Gasto guardado"); history.back();
    } },
    h("div", { class: "fila2" },
      h("label", { class: "campo" }, h("span", {}, "Fecha"), h("input", { type: "date", name: "fecha", value: g.fecha, required: true })),
      h("label", { class: "campo" }, h("span", {}, "Tipo de gasto"), sel("tipo", TIPOS_GASTO, g.tipo))),
    h("label", { class: "campo" }, h("span", {}, "Valor ($)"), valor),
    h("label", { class: "campo" }, h("span", {}, "Detalle"), h("input", { name: "detalle", value: g.detalle || "", placeholder: "Compra de cemento, pago maestro…" })),
    h("label", { class: "campo" }, h("span", {}, "Proveedor / beneficiario"), h("input", { name: "proveedor", value: g.proveedor || "" })),
    h("label", { class: "campo" }, h("span", {}, "No. factura / soporte"), h("input", { name: "factura", value: g.factura || "" })),
    h("div", { class: "fila2" },
      h("label", { class: "campo" }, h("span", {}, "Inversionista"), sel("inversionista", ["", ...INVERSIONISTAS], g.inversionista || "")),
      h("label", { class: "campo" }, h("span", {}, "Si es otro: ¿quién?"), h("input", { name: "otro", value: g.otro || "" }))),
    h("label", { class: "campo" }, h("span", {}, "Ítem del presupuesto (opcional)"),
      h("select", { name: "item" }, h("option", { value: "" }, "— Ninguno —"), d.items.map(it => h("option", { selected: g.item === etiquetaItem(it) }, etiquetaItem(it))))),
    h("label", { class: "btn sec" }, ico("camara"), "Foto de la factura o soporte",
      h("input", { type: "file", accept: "image/*", hidden: true, onchange: async e => { const f = e.target.files[0]; if (f) { soporte = await comprimir(f); pintarSop(); } } })),
    vistaSop,
    h("button", { class: "btn grande", type: "submit" }, "Guardar gasto"));
  pintarSop();
  pantalla(gId === "nuevo" ? "Registrar gasto" : "Editar gasto", { atras: `#/obra/${id}/gastos`, subtitulo: d.obra.nombre }, form,
    gId !== "nuevo" ? h("button", { class: "btn peligro", onclick: async () => {
      if (!confirm("¿Borrar este gasto?")) return; await db.borrar("gastos", g.id); history.back(); } }, "Borrar gasto") : null);
}

// ------------------------------------------------------------------ OBRA: mi Excel de control al día
async function plantillaDe(id) {
  return (await db.deObra("documentos", id)).filter(x => x.tipo === "excel-control").sort((a, b) => (b.creado || "").localeCompare(a.creado || ""))[0];
}
async function seccionMiExcel(id) {
  const pl = await plantillaDe(id);
  const elegir = h("label", { class: "btn " + (pl ? "sec" : "") }, ico("subir"), pl ? "Usar otro archivo de Excel" : "Elegir mi Excel de control",
    h("input", { type: "file", hidden: true, accept: ".xlsm,.xlsx", onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      await db.guardar("documentos", { obraId: id, tipo: "excel-control", nombre: f.name, blob: new Blob([await f.arrayBuffer()], { type: f.type }), creado: new Date().toISOString() });
      await descargarMiExcel(id);
    } }));
  const subir = h("label", { class: "btn verde" }, ico("subir"), "Cargar Excel actualizado del computador",
    h("input", { type: "file", hidden: true, accept: ".xlsm,.xlsx", onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      toast("Leyendo el Excel…");
      try { const r = await actualizarDesdeExcel(id, f); if (r) { toast(r.resumen); ir(`#/obra/${id}/resumen`); } }
      catch (err) { console.error(err); alert(err.message); }
      e.target.value = "";
    } }));
  return h("section", { class: "tarjeta" }, h("h2", {}, "Mi Excel de control"),
    h("p", { class: "nota" }, pl ? `Archivo: ${pl.nombre}. La app le devuelve ese mismo Excel con bitácora, actividades, gastos y personal al día; fórmulas, actas y macros quedan igual.`
      : "Elija su archivo CONTROL DE OBRA y la app se lo devuelve con bitácora, actividades, gastos y personal al día."),
    h("div", { class: "acciones" },
      pl ? h("button", { class: "btn grande", onclick: () => descargarMiExcel(id) }, ico("excel"), "Descargar mi Excel al día") : null,
      subir,
      pl ? null : elegir),
    pl ? h("p", { class: "nota" }, "¿Lo trabajó en el computador? Use \"Cargar mi Excel actualizado\" y la obra queda igual al archivo. Desde ese momento, \"Descargar\" parte de ese archivo.") : null,
    pl ? h("details", {}, h("summary", { class: "nota" }, "Otras opciones"), elegir) : null);
}
async function descargarMiExcel(id) {
  const pl = await plantillaDe(id); if (!pl) return;
  toast("Armando su Excel…");
  try {
    const d = await cargarObra(id);
    const enOrden = (a, b) => (a.orden ?? 1e9) - (b.orden ?? 1e9) || (a.creado || "").localeCompare(b.creado || "");
    const gastos = (await db.deObra("gastos", id)).sort(enOrden);
    const serie = s => { if (!s) return ""; const [y, m, dd] = s.split("-").map(Number); return (Date.UTC(y, m - 1, dd) - Date.UTC(1899, 11, 30)) / 864e5; };
    const datos = {
      BITACORA: d.bitacora.sort((a, b) => a.fecha.localeCompare(b.fecha)).map(b => ({ fecha: serie(b.fecha), jornada: b.jornada === "Normal" ? "" : b.jornada,
        horas: b.horas === "" || b.horas == null ? "" : Number(b.horas), clima: b.clima, precipitacion: b.precipitacion, afecto: b.afecto, ausentes: (b.ausentes || []).join(", "),
        charla: b.charla, epp: b.epp, incidentes: b.incidentes, ambiental: b.ambiental, novedades: b.novedades })),
      ACTIVIDADES: d.avances.sort(enOrden).map(a => {
        const it = d.items.find(i => i.id === a.itemId);
        return { fecha: serie(a.fecha), actividad: it ? etiquetaItem(it) : "", cantidad: Number(a.cantidad) || 0, frente: a.frente, equipo: a.equipo };
      }),
      GASTOS: gastos.map(g => ({ fecha: serie(g.fecha), tipo: g.tipo, detalle: g.detalle, proveedor: g.proveedor, factura: g.factura, valor: Number(g.valor) || 0,
        item: g.item, inversionista: g.inversionista, otro: g.otro, abonoA: g.abonoA })),
      PERSONAL: d.personal.map(p => ({ cargo: p.cargo, nombre: p.nombre, cant: Number(p.cant) || 1 })),
    };
    const { blob, informe } = await llenarExcel(await pl.blob.arrayBuffer(), datos);
    console.log("Mi Excel:", informe.join(" | "));
    const base = pl.nombre.replace(/\.(xlsm|xlsx)$/i, "").replace(/ \(al \d{2}-\d{2}-\d{4}\)$/, "");
    const ext = /\.xlsx$/i.test(pl.nombre) ? ".xlsx" : ".xlsm";
    await entregarArchivo(blob, `${base} (al ${fechaCorta(hoy()).replace(/\//g, "-")})${ext}`);
  } catch (err) { console.error(err); alert("No pude armar el Excel: " + err.message); }
}

async function vistaMas(id) {
  const d = await cargarObra(id);
  pantalla("Más", { atras: `#/obra/${id}/resumen`, subtitulo: d.obra.nombre },
    h("a", { class: "tarjeta menu", href: `#/obra/${id}/tablero` }, h("div", { class: "t-nom" }, "Tablero · ¿cómo va la plata?"), h("div", { class: "t-sub" }, "Avance, gasto, utilidad e inversionistas")),
    h("a", { class: "tarjeta menu", href: `#/obra/${id}/presupuesto` }, h("div", { class: "t-nom" }, "Presupuesto"), h("div", { class: "t-sub" }, d.items.length ? `${d.items.length} ítems · costo directo ${pesos(d.cd)}` : "Sin cargar")),
    h("a", { class: "tarjeta menu", href: `#/obra/${id}/personal` }, h("div", { class: "t-nom" }, "Personal"), h("div", { class: "t-sub" }, `${d.personal.length} persona(s)`)),
    h("a", { class: "tarjeta menu", href: `#/obra/${id}/datos` }, h("div", { class: "t-nom" }, "Datos de la obra"), h("div", { class: "t-sub" }, [d.obra.contrato, d.obra.entidad].filter(Boolean).join(" · ") || "Contrato, entidad, plazo…")),
    h("section", {}, h("h2", {}, "Documentos"),
      ...(await db.deObra("documentos", id)).map(doc => h("div", { class: "tarjeta fila" },
        h("div", {}, h("div", { class: "t-nom" }, doc.tipo === "excel-control" ? "Excel de control (original importado)" : (doc.tipo || "Documento")), h("div", { class: "t-sub" }, doc.nombre)),
        h("button", { class: "btn mini sec", onclick: () => entregarArchivo(doc.blob, doc.nombre) }, "Abrir"))),
      h("a", { class: "btn sec", href: `#/obra/${id}/datos` }, "📄 Cargar contrato u orden de servicio")),
    await seccionMiExcel(id),
    h("button", { class: "btn sec", onclick: () => exportarExcel(id) }, ico("bajar"), "Exportar tablas sueltas (Excel simple)"),
    h("p", { class: "nota" }, "El Excel trae las hojas BITÁCORA y ACTIVIDADES con las mismas columnas de su CONTROL DE OBRA: copie las filas y péguelas allá para sacar actas y memorias."),
    h("button", { class: "btn peligro", onclick: async () => {
      if (await borrarObra(id, d.obra.nombre)) ir("#/"); } }, "Borrar esta obra"),
    tabs(id, "mas"));
}

async function vistaPersonal(id) {
  const d = await cargarObra(id);
  const form = h("form", { class: "form fila-add", onsubmit: async ev => {
      ev.preventDefault(); const fd = new FormData(form);
      if (!fd.get("nombre")) return;
      await db.guardar("personal", { obraId: id, cargo: fd.get("cargo"), nombre: fd.get("nombre").trim() });
      vistaPersonal(id);
    } },
    h("input", { name: "nombre", placeholder: "Nombre", required: true }),
    h("input", { name: "cargo", placeholder: "Cargo (maestro, oficial…)" }),
    h("button", { class: "btn", type: "submit" }, "Agregar"));
  pantalla("Personal", { atras: `#/obra/${id}/mas`, subtitulo: d.obra.nombre }, form,
    d.personal.map(p => h("div", { class: "tarjeta fila" }, h("div", {}, h("div", { class: "t-nom" }, p.nombre), h("div", { class: "t-sub" }, p.cargo || "")),
      h("button", { class: "btn mini peligro", onclick: async () => { if (confirm("¿Quitar a " + p.nombre + "?")) { await db.borrar("personal", p.id); vistaPersonal(id); } } }, "Quitar"))));
}

// ------------------------------------------------------------------ presupuesto: importar
async function vistaPresupuesto(id) {
  const d = await cargarObra(id);
  const pegar = h("textarea", { rows: 5, placeholder: "Copie en Excel la tabla del presupuesto (con la fila de títulos) y péguela aquí." });
  pantalla("Presupuesto", { atras: `#/obra/${id}/mas`, subtitulo: d.obra.nombre },
    h("details", { class: "aparte", open: !d.items.length },
      h("summary", {}, d.items.length ? "Volver a cargar el presupuesto" : "Cargar el presupuesto"),
      h("p", { class: "nota" }, "Use el Excel de la entidad. El programa busca solo la fila de títulos (ÍTEM, DESCRIPCIÓN, UND, CANTIDAD, VALOR UNITARIO) y la fila VALOR TOTAL."),
      h("label", { class: "btn" }, "Elegir archivo de Excel", h("input", { type: "file", hidden: true, accept: ".xlsx,.xls,.xlsm,.csv", onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
        let mejor = null;
        for (const n of wb.SheetNames) {
          const filas = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" });
          const r = leerPresupuesto(filas); if (r.items.length && (!mejor || r.items.length > mejor.items.length)) mejor = r;
        }
        if (!mejor) return alert("No encontré ítems con descripción, cantidad y valor unitario en ese archivo.");
        aplicarPresupuesto(id, d, mejor);
      } })),
      h("div", { class: "o" }, "o"),
      pegar,
      h("button", { class: "btn sec", onclick: () => {
        const filas = pegar.value.split(/\r?\n/).map(l => l.split("\t"));
        const r = leerPresupuesto(filas);
        if (!r.items.length) return alert("No encontré ítems en lo que pegó. Copie también la fila de títulos.");
        aplicarPresupuesto(id, d, r);
      } }, "Usar lo pegado")),
    d.items.length ? h("div", { class: "kpis" },
      kpi("Costo directo", pesos(d.cd), d.items.length + " ítems"),
      kpi("Valor del contrato", pesos(d.cd * d.factor), "AIU " + pct(d.factor - 1))) : null,
    ...d.items.map(it => filaItem(it, d.ejec[it.id] || 0)));
}

async function aplicarPresupuesto(id, d, r) {
  if (d.items.length && !confirm(`Se encontraron ${r.items.length} ítems. ¿Reemplazar el presupuesto actual? El avance ya registrado se conserva en los ítems que tengan el mismo código y descripción.`)) return;
  const viejos = new Map(d.items.map(i => [(i.codigo + "|" + i.descripcion).toLowerCase(), i.id]));
  r.items.forEach((it, k) => { it.orden = k; const v = viejos.get((it.codigo + "|" + it.descripcion).toLowerCase()); if (v) it.id = v; });
  await db.reemplazarDeObra("items", id, r.items);
  d.obra.totalPresupuesto = r.total || 0;
  await db.guardar("obras", d.obra);
  toast(`${r.items.length} ítems cargados`);
  vistaPresupuesto(id);
}

// Lee una tabla de presupuesto (filas = arreglos). Misma lógica del Excel: busca la fila de títulos.
function leerPresupuesto(filas) {
  const norm = v => String(v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const numero = v => {
    if (typeof v === "number") return v;
    let s = String(v ?? "").replace(/\$/g, "").replace(/\s/g, "");
    if (!s) return NaN;
    if (/,\d{1,2}$/.test(s) && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/,\d{1,2}$/.test(s)) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
    return Number(s);
  };
  let hr = -1, cI = 0, cD = 1, cU = 2, cC = 3, cV = 4;
  for (let r = 0; r < Math.min(filas.length, 60); r++) {
    const f = filas[r].map(norm);
    if (f.some(x => x.includes("descrip") || x.includes("actividad")) && f.some(x => x.startsWith("cant"))) {
      hr = r;
      const busca = (pred, def) => { const k = f.findIndex(pred); return k >= 0 ? k : def; };
      cD = busca(x => x.includes("descrip") || x.includes("actividad") || x.includes("concepto"), 1);
      cC = busca(x => x.startsWith("cant"), 3);
      cU = busca(x => /^(und|unid|un\.?|u\.?)$/.test(x) || x.startsWith("unid") || x.startsWith("und"), 2);
      cV = busca(x => x.includes("unit") || x.includes("v/u") || x.includes("v.u") || x.includes("precio"), 4);
      cI = busca(x => x.includes("item") || x.startsWith("n°") || x.startsWith("no") || x === "#" || x.startsWith("cod"), Math.max(0, cD - 1));
      break;
    }
  }
  const items = []; let total = 0;
  for (let r = hr + 1; r < filas.length; r++) {
    const f = filas[r]; if (!f) continue;
    const txt = f.map(norm).join(" ");
    if (/valor total|total presupuesto|costo total|total general|total obra/.test(txt)) {
      const nums = f.map(numero).filter(n => isFinite(n)); if (nums.length) total = Math.max(total, ...nums);
      continue;
    }
    const desc = String(f[cD] ?? "").trim(), cant = numero(f[cC]), vu = numero(f[cV]);
    if (!desc || !(cant > 0) || !(vu > 0)) continue;
    let cod = f[cI];
    if (typeof cod === "number") cod = String(Math.round(cod * 1000) / 1000);
    items.push({ codigo: String(cod ?? "").trim(), descripcion: desc, und: String(f[cU] ?? "").trim(), cantidad: cant, vu });
  }
  return { items, total };
}

// ------------------------------------------------------------------ importar una obra desde el Excel CONTROL DE OBRA
// Lee un Excel CONTROL DE OBRA y devuelve sus datos (sin guardar nada).
async function leerControl(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const hoja = nombre => {
    const n = wb.SheetNames.find(x => x.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^[\d.\-)\s]+/, "").trim().toUpperCase() === nombre);
    return n ? XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" }) : null;
  };
  const ini = hoja("INICIO"), pres = hoja("PRESUPUESTO"), per = hoja("PERSONAL"), bit = hoja("BITACORA"), act = hoja("ACTIVIDADES"), gas = hoja("GASTOS");
  if (!ini || !pres) throw new Error("Este Excel no parece un CONTROL DE OBRA (no encontré las hojas INICIO y PRESUPUESTO).");
  const txt = v => String(v ?? "").trim();
  const fechaIso = v => {
    if (typeof v === "number" && v > 20000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
    const m = txt(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
  };
  const codigo = v => typeof v === "number" ? String(Math.round(v * 1000) / 1000) : txt(v);

  // datos de la obra (por etiqueta, columna A → valor en B)
  const lab = {};
  for (const f of ini) if (txt(f[0])) lab[txt(f[0]).toLowerCase()] = f[1];
  const busca = pref => { const k = Object.keys(lab).find(x => x.startsWith(pref)); return k ? lab[k] : ""; };
  const emp = txt(busca("contratista")).toUpperCase();
  const obra = {
    nombre: txt(busca("objeto")), contrato: txt(busca("contrato")), entidad: txt(busca("entidad")), municipio: txt(busca("municipio")), depto: txt(busca("departamento")),
    inicio: fechaIso(busca("fecha de inicio")), plazo: Number(busca("plazo")) || 0,
    empresa: emp.includes("INGEINNOVA") ? "INGEINNOVA TERRITORIAL S.A.S." : emp.includes("FLASS") ? "FLASSSERVIC S.A.S." : "",
    residente: txt(busca("firma 1 – nombre")), supervisor: txt(busca("firma 3 – nombre")),
  };
  const vc = busca("valor del contrato"); if (typeof vc === "number") obra.totalPresupuesto = vc;
  const aiu = busca("aiu %"); if (typeof aiu === "number" && !obra.totalPresupuesto) obra.aiu = Math.round(aiu * 10000) / 100;

  const items = [];
  for (let r = 8; r < pres.length; r++) {
    const f = pres[r]; const desc = txt(f[1]), cant = Number(f[3]), vu = Number(f[4]);
    if (desc && cant > 0 && vu > 0) items.push({ codigo: codigo(f[0]), descripcion: desc, und: txt(f[2]), cantidad: cant, vu, orden: items.length,
      etiqueta: txt(f[10]).includes(desc.slice(0, 10)) ? txt(f[10]) : undefined });
  }
  const personal = [];
  for (let r = 8; per && r < per.length; r++) {
    const nom = txt(per[r][1]); if (nom) personal.push({ cargo: txt(per[r][0]), nombre: nom, cant: Number(per[r][2]) || 1 });
  }
  const bitacora = [];
  for (let r = 8; bit && r < bit.length; r++) {
    const f = bit[r]; const fecha = fechaIso(f[0]); if (!fecha) continue;
    bitacora.push({ fecha, jornada: txt(f[1]) || "Normal", horas: txt(f[2]) === "" ? "" : Number(f[2]) || 0, clima: txt(f[3]), precipitacion: txt(f[4]),
      afecto: txt(f[5]) || "No", ausentes: txt(f[6]) ? txt(f[6]).split(",").map(x => x.trim()).filter(Boolean) : [],
      charla: txt(f[8]), epp: txt(f[9]), incidentes: txt(f[10]), ambiental: txt(f[11]), novedades: txt(f[12]) });
  }
  const actividades = [];
  for (let r = 8; act && r < act.length; r++) {
    const f = act[r]; const fecha = fechaIso(f[0]); const cant = Number(f[3]);
    if (!fecha || !(cant > 0)) continue;
    actividades.push({ fecha, etiqueta: txt(f[1]), codigo: codigo(f[2]), cantidad: cant, frente: txt(f[6]), equipo: txt(f[7]), orden: r });
  }
  const gastos = [];
  if (gas) {
    const hr = gas.findIndex(f => txt(f[0]).toUpperCase() === "FECHA" && txt(f[1]).toUpperCase().startsWith("TIPO"));
    for (let r = hr + 1; hr >= 0 && r < gas.length; r++) {
      const f = gas[r]; const valor = Number(f[5]);
      if (!(valor > 0)) continue;
      gastos.push({ fecha: fechaIso(f[0]), tipo: txt(f[1]), detalle: txt(f[2]), proveedor: txt(f[3]), factura: txt(f[4]),
        valor, item: txt(f[6]), inversionista: txt(f[7]), otro: txt(f[8]), abonoA: txt(f[9]), orden: r });
    }
  }
  return { buf, obra, items, personal, bitacora, actividades, gastos };
}

// Guarda lo leído en una obra: nueva (obraId vacío) o existente (la actualiza con lo del Excel; conserva fotos).
async function aplicarControl(file, x, obraId) {
  const ahora = new Date().toISOString();
  let obra;
  if (obraId) {
    obra = await db.uno("obras", obraId);
    for (const [k, v] of Object.entries(x.obra)) if (v !== "" && v !== 0 && v != null) obra[k] = v;
    await db.guardar("obras", obra);
  } else {
    obra = { ...x.obra, nombre: x.obra.nombre || file.name.replace(/\.[^.]+$/, ""), empresa: x.obra.empresa || "Otra", creado: ahora, origen: file.name };
    await db.guardar("obras", obra);
  }
  const id = obra.id;
  // presupuesto: conserva los ids de ítems iguales (así las fotos y avances siguen ligados)
  const viejosIt = obraId ? await db.deObra("items", id) : [];
  const llave = i => (i.codigo + "|" + i.descripcion).toLowerCase();
  const mapaIt = new Map(viejosIt.map(i => [llave(i), i.id]));
  for (const it of x.items) { const v = mapaIt.get(llave(it)); if (v) it.id = v; }
  await db.reemplazarDeObra("items", id, x.items);
  const porCodigo = new Map(x.items.map(i => [i.codigo, i.id]));
  const porEtiqueta = new Map(x.items.map(i => [etiquetaItem(i).toLowerCase(), i.id]));
  await db.reemplazarDeObra("personal", id, x.personal);
  await db.reemplazarDeObra("bitacora", id, x.bitacora);
  let sinItem = 0;
  const avances = [];
  for (const a of x.actividades) {
    const itemId = porEtiqueta.get(a.etiqueta.toLowerCase()) || porCodigo.get(a.codigo) || porCodigo.get(a.etiqueta.split(" – ")[0]);
    if (!itemId) { sinItem++; continue; }
    avances.push({ fecha: a.fecha, itemId, cantidad: a.cantidad, frente: a.frente, equipo: a.equipo, orden: a.orden, creado: ahora });
  }
  await db.reemplazarDeObra("avances", id, avances);
  // gastos: conserva la foto de soporte de los que ya existían (misma fecha, valor y detalle)
  const viejosGa = obraId ? await db.deObra("gastos", id) : [];
  const llaveG = g => `${g.fecha}|${Math.round(g.valor)}|${(g.detalle || "").toLowerCase().trim()}`;
  const sop = new Map(viejosGa.filter(g => g.soporte).map(g => [llaveG(g), g.soporte]));
  for (const g of x.gastos) { g.creado = ahora; const s = sop.get(llaveG(g)); if (s) g.soporte = s; }
  await db.reemplazarDeObra("gastos", id, x.gastos);
  await db.guardar("documentos", { obraId: id, tipo: "excel-control", nombre: file.name, blob: new Blob([x.buf], { type: file.type || "application/vnd.ms-excel.sheet.macroEnabled.12" }), creado: ahora });
  const resumen = `${obraId ? "Actualizado" : "Importado"}: ${x.items.length} ítems, ${x.personal.length} personas, ${x.bitacora.length} días de bitácora, ${avances.length} avances` +
    (x.gastos.length ? `, ${x.gastos.length} gastos` : "") + (sinItem ? ` (${sinItem} actividad(es) sin ítem)` : "");
  return { id, resumen };
}

async function importarControl(file) { return aplicarControl(file, await leerControl(file), null); }

// Carga el Excel que el usuario actualizó en el computador sobre una obra que ya existe.
async function actualizarDesdeExcel(id, file) {
  const x = await leerControl(file);
  const [bit, av, ga] = await Promise.all([db.deObra("bitacora", id), db.deObra("avances", id), db.deObra("gastos", id)]);
  const o = await db.uno("obras", id);
  const otraObra = x.obra.contrato && o.contrato && x.obra.contrato !== o.contrato;
  const faltan = [];
  const fechasX = new Set(x.bitacora.map(b => b.fecha));
  const diasSolo = bit.filter(b => !fechasX.has(b.fecha)).length; if (diasSolo) faltan.push(`${diasSolo} día(s) de bitácora`);
  const items = await db.deObra("items", id);
  const etq = new Map(items.map(i => [i.id, etiquetaItem(i).toLowerCase()]));
  const kA = (f, e, c) => `${f}|${e}|${Math.round(Number(c) * 1000)}`;
  const avX = new Set(x.actividades.map(a => kA(a.fecha, a.etiqueta.toLowerCase(), a.cantidad)));
  const avSolo = av.filter(a => !avX.has(kA(a.fecha, etq.get(a.itemId) || "", a.cantidad))).length; if (avSolo) faltan.push(`${avSolo} avance(s)`);
  const kG = g => `${g.fecha}|${Math.round(Number(g.valor))}|${(g.detalle || "").toLowerCase().trim()}`;
  const gaX = new Set(x.gastos.map(kG));
  const gaSolo = ga.filter(g => !gaX.has(kG(g))).length; if (gaSolo) faltan.push(`${gaSolo} gasto(s)`);
  let msg = `El Excel trae ${x.bitacora.length} días de bitácora, ${x.actividades.length} actividades y ${x.gastos.length} gastos.\n` +
    `La app tiene ${bit.length}, ${av.length} y ${ga.length}.\n\nLa obra quedará exactamente como está en el Excel (las fotos se conservan).`;
  if (faltan.length) msg += `\n\n⚠ Ojo: en la app hay registros que no están en el Excel (${faltan.join(", ")}). Si sigue, se pierden. Para no perderlos, primero descargue "Mi Excel al día", ábralo en el computador y súbalo de nuevo.`;
  if (otraObra) msg += `\n\n⚠ El contrato del Excel (${x.obra.contrato}) no es el de esta obra (${o.contrato}).`;
  if (!confirm(msg + "\n\n¿Actualizar la obra con este Excel?")) return null;
  return aplicarControl(file, x, id);
}

// ------------------------------------------------------------------ exportar a Excel
async function exportarExcel(id) {
  const d = await cargarObra(id); const o = d.obra;
  const wb = XLSX.utils.book_new();
  // fecha como número de serie de Excel (evita corrimientos por zona horaria)
  const fecha = s => { if (!s) return ""; const [y, m, dd] = s.split("-").map(Number); return { t: "n", v: (Date.UTC(y, m - 1, dd) - Date.UTC(1899, 11, 30)) / 864e5, z: "dd/mm/yyyy" }; };
  const nPers = d.personal.length;
  const bit = [["FECHA", "JORNADA (vacío = normal)", "HORAS", "CONDICIÓN DEL DÍA", "PRECIPITACIÓN (24 h)", "¿AFECTÓ LA OBRA?",
    "AUSENTES (nombres separados por coma)", "PERSONAL EN OBRA", "CHARLA 5 MIN – TEMA", "USO DE EPP", "INCIDENTES / ACCIDENTES", "MANEJO AMBIENTAL",
    "NOVEDADES, VISITAS, ÓRDENES DE SUPERVISIÓN Y MATERIALES RECIBIDOS"]];
  for (const b of d.bitacora.sort((a, c) => a.fecha.localeCompare(c.fecha)))
    bit.push([fecha(b.fecha), b.jornada === "Normal" ? "" : b.jornada, b.horas, b.clima, b.precipitacion, b.afecto, (b.ausentes || []).join(", "),
      Math.max(0, nPers - (b.ausentes || []).length), b.charla, b.epp, b.incidentes, b.ambiental, b.novedades]);
  const act = [["FECHA", "ACTIVIDAD DEL PRESUPUESTO", "ÍTEM", "CANTIDAD DEL DÍA", "UND", "VALOR EJECUTADO", "DETALLE / FRENTE DE TRABAJO", "EQUIPO Y HERRAMIENTA"]];
  for (const a of d.avances.sort((x, y) => x.fecha.localeCompare(y.fecha))) {
    const it = d.items.find(i => i.id === a.itemId);
    act.push([fecha(a.fecha), it ? etiquetaItem(it) : "", it?.codigo || "", Number(a.cantidad), it?.und || "", it ? Math.round(a.cantidad * it.vu * d.factor) : "", a.frente || "", a.equipo || ""]);
  }
  const per = [["CARGO", "NOMBRE", "CANT."], ...d.personal.map(p => [p.cargo, p.nombre, 1])];
  const pre = [["ÍTEM", "DESCRIPCIÓN", "UND", "CANTIDAD", "VALOR UNITARIO", "VALOR TOTAL", "EJECUTADO", "% AVANCE"],
    ...d.items.map(it => [it.codigo, it.descripcion, it.und, it.cantidad, it.vu, it.cantidad * it.vu, d.ejec[it.id] || 0, it.cantidad ? (d.ejec[it.id] || 0) / it.cantidad : 0])];
  if (o.totalPresupuesto) pre.push([], ["", "VALOR TOTAL", "", "", "", o.totalPresupuesto]);
  const fot = [["FECHA", "DESCRIPCIÓN", "ÍTEM", "LATITUD", "LONGITUD", "ARCHIVO"],
    ...d.fotos.map(f => { const it = d.items.find(i => i.id === f.itemId); return [fecha(f.fecha), f.descripcion || "", it ? etiquetaItem(it) : "", f.lat || "", f.lng || "", `Foto ${f.fecha} ${f.id}.jpg`]; })];
  const hoja = (aoa, anchos) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = anchos.map(w => ({ wch: w })); return ws; };
  XLSX.utils.book_append_sheet(wb, hoja(bit, [11, 14, 7, 16, 16, 10, 24, 10, 30, 12, 16, 30, 50]), "BITACORA");
  XLSX.utils.book_append_sheet(wb, hoja(act, [11, 50, 8, 12, 7, 15, 50, 26]), "ACTIVIDADES");
  XLSX.utils.book_append_sheet(wb, hoja(per, [30, 36, 7]), "PERSONAL");
  XLSX.utils.book_append_sheet(wb, hoja(pre, [8, 50, 7, 11, 14, 16, 12, 10]), "PRESUPUESTO");
  XLSX.utils.book_append_sheet(wb, hoja(fot, [11, 40, 40, 11, 11, 30]), "FOTOS");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const nombre = `Obra ${(o.contrato || o.nombre || "").toString().replace(/[\\/:*?"<>|]/g, "").slice(0, 40)} ${hoy()}.xlsx`;
  await entregarArchivo(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nombre);
}

// En iPhone lo más confiable es la hoja de "Compartir" (correo, WhatsApp, Archivos…)
async function entregarArchivo(blob, nombre) {
  const file = new File([blob], nombre, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nombre }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = h("a", { href: URL.createObjectURL(blob), download: nombre }); document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

// ------------------------------------------------------------------ rutas
async function rutear() {
  const p = location.hash.replace(/^#\/?/, "").split("/");
  try {
    if (!p[0]) return await vistaInicio();
    if (p[0] === "nueva") return await vistaDatosObra(null);
    if (p[0] === "obra") {
      const id = p[1], v = p[2] || "resumen";
      if (!(await db.uno("obras", id))) return ir("#/");
      if (v === "resumen") return await vistaResumen(id);
      if (v === "bitacora") return p[3] ? await vistaDia(id, p[3]) : await vistaBitacora(id);
      if (v === "avance") return p[3] ? await vistaFormAvance(id, p[3], p[4]) : await vistaAvance(id);
      if (v === "fotos") return await vistaFotos(id);
      if (v === "foto") return await vistaFoto(id, p[3]);
      if (v === "mas") return await vistaMas(id);
      if (v === "tablero") return await vistaTablero(id);
      if (v === "gastos") return p[3] ? await vistaFormGasto(id, p[3], p[4]) : await vistaGastos(id);
      if (v === "presupuesto") return await vistaPresupuesto(id);
      if (v === "personal") return await vistaPersonal(id);
      if (v === "datos") return await vistaDatosObra(id);
    }
    ir("#/");
  } catch (e) {
    console.error(e);
    $("#app").innerHTML = ""; $("#app").append(h("div", { class: "alerta" }, "Ocurrió un error: " + e.message));
  }
}
addEventListener("hashchange", rutear);
rutear();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(e => console.warn(e));
if (navigator.storage?.persist) navigator.storage.persist();
