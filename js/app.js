// Control de Obras — app de campo (funciona sin internet).
import * as db from "./db.js";
import { extraerTexto, extraerDatos } from "./contrato.js";

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
const pesos = n => "$ " + Math.round(n || 0).toLocaleString("es-CO");
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
function etiquetaItem(it) { return (it.codigo ? it.codigo + " – " : "") + it.descripcion; }
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
function pantalla(titulo, { atras, subtitulo, acciones } = {}, ...cuerpo) {
  const app = $("#app"); app.innerHTML = "";
  app.append(
    h("header", { class: "barra" },
      atras ? h("button", { class: "atras", onclick: () => ir(atras), "aria-label": "Atrás" }, "‹") : h("span", { class: "marca" }, "▣"),
      h("div", { class: "titulos" }, h("h1", {}, titulo), subtitulo ? h("div", { class: "sub" }, subtitulo) : null),
      acciones || null),
    h("div", { id: "sync", class: "sync" }),
    h("main", {}, ...cuerpo));
  pintarSync();
  window.scrollTo(0, 0);
}
function tabs(obraId, activa) {
  const t = [["resumen", "Resumen", "◉"], ["bitacora", "Bitácora", "✎"], ["avance", "Avance", "▲"], ["fotos", "Fotos", "◫"], ["mas", "Más", "≡"]];
  return h("nav", { class: "tabs" }, t.map(([k, n, i]) =>
    h("a", { href: `#/obra/${obraId}/${k}`, class: k === activa ? "activa" : "" }, h("span", { class: "ico" }, i), n)));
}

// ------------------------------------------------------------------ INICIO: lista de obras
async function vistaInicio() {
  const obras = (await db.todos("obras")).sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
  const tarjetas = [];
  for (const o of obras) {
    const d = await cargarObra(o.id);
    const ult = d.bitacora.map(b => b.fecha).sort().pop();
    tarjetas.push(h("a", { class: "tarjeta obra", href: `#/obra/${o.id}/resumen` },
      h("div", { class: "t-emp" }, o.empresa || ""),
      h("div", { class: "t-nom" }, o.nombre || "(sin nombre)"),
      h("div", { class: "t-sub" }, [o.municipio, o.contrato ? "Contrato " + o.contrato : ""].filter(Boolean).join(" · ")),
      h("div", { class: "prog" }, h("div", { style: `width:${Math.min(100, d.avance * 100)}%` })),
      h("div", { class: "t-pie" }, h("span", {}, "Avance " + pct(d.avance)), h("span", {}, ult ? "Última bitácora " + fechaCorta(ult) : "Sin bitácora"))));
  }
  pantalla("Control de Obras", { subtitulo: "Sus obras" },
    tarjetas.length ? tarjetas : h("div", { class: "vacio" }, "Todavía no hay obras. Cree la primera."),
    h("button", { class: "btn grande", onclick: () => ir("#/nueva") }, "+ Nueva obra"),
    h("details", { class: "aparte" },
      h("summary", {}, "Copia de seguridad"),
      h("p", { class: "nota" }, "Mientras se activa la nube, los datos viven en este celular. Saque una copia cada semana y guárdela en su correo o en Archivos."),
      h("button", { class: "btn sec", onclick: copiaSeguridad }, "Descargar copia de seguridad"),
      h("label", { class: "btn sec" }, "Restaurar una copia", h("input", { type: "file", accept: ".json,application/json", hidden: true, onchange: restaurarCopia }))));
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
  pantalla(o.nombre, { atras: "#/", subtitulo: [o.empresa, o.municipio].filter(Boolean).join(" · ") },
    h("div", { class: "kpis" },
      kpi("Avance de obra", pct(d.avance), d.cd ? pesos(d.cdEj * d.factor) + " de " + pesos(d.cd * d.factor) : (o.valor ? "Contrato " + pesos(o.valor) + " · cargue el presupuesto" : "Cargue el presupuesto")),
      kpi("Tiempo", pct(d.tiempo), o.plazo ? `${Math.min(d.dias, o.plazo)} de ${o.plazo} días` : "Sin plazo"),
      kpi("Bitácora", d.bitacora.length, "días registrados"),
      kpi("Fotos", d.fotos.length, "en la obra")),
    d.cd && d.avance < d.tiempo - 0.1 ? h("div", { class: "alerta" }, "⚠ El avance va por debajo del tiempo") : null,
    h("div", { class: "acciones" },
      h("button", { class: "btn grande", onclick: () => ir(`#/obra/${id}/bitacora/${hoy()}`) }, "✎ Registrar el día de hoy"),
      h("button", { class: "btn grande sec", onclick: () => ir(`#/obra/${id}/avance/nuevo`) }, "▲ Registrar avance"),
      h("button", { class: "btn grande sec", onclick: () => tomarFotos(id) }, "◫ Tomar fotos")),
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
    h("button", { class: "btn grande", onclick: () => ir(`#/obra/${id}/bitacora/${hoy()}`) }, "✎ Registrar el día de hoy"),
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
  const form = h("form", { class: "form", onsubmit: async ev => {
      ev.preventDefault();
      const fd = new FormData(form);
      for (const k of ["clima", "precipitacion", "afecto", "jornada", "horas", "charla", "epp", "incidentes", "ambiental", "novedades"]) b[k] = fd.get(k) ?? "";
      b.horas = Number(b.horas) || 0;
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
      h("button", { class: "btn sec", onclick: () => tomarFotos(id, { fecha }) }, "◫ Tomar fotos de este día")),
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
    d.items.length ? h("button", { class: "btn grande", onclick: () => ir(`#/obra/${id}/avance/nuevo`) }, "▲ Registrar avance")
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
    h("button", { class: "btn grande", onclick: () => tomarFotos(id) }, "◫ Tomar fotos"),
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
async function vistaMas(id) {
  const d = await cargarObra(id);
  pantalla("Más", { atras: `#/obra/${id}/resumen`, subtitulo: d.obra.nombre },
    h("a", { class: "tarjeta menu", href: `#/obra/${id}/presupuesto` }, h("div", { class: "t-nom" }, "Presupuesto"), h("div", { class: "t-sub" }, d.items.length ? `${d.items.length} ítems · costo directo ${pesos(d.cd)}` : "Sin cargar")),
    h("a", { class: "tarjeta menu", href: `#/obra/${id}/personal` }, h("div", { class: "t-nom" }, "Personal"), h("div", { class: "t-sub" }, `${d.personal.length} persona(s)`)),
    h("a", { class: "tarjeta menu", href: `#/obra/${id}/datos` }, h("div", { class: "t-nom" }, "Datos de la obra"), h("div", { class: "t-sub" }, [d.obra.contrato, d.obra.entidad].filter(Boolean).join(" · ") || "Contrato, entidad, plazo…")),
    h("section", {}, h("h2", {}, "Documentos"),
      ...(await db.deObra("documentos", id)).map(doc => h("div", { class: "tarjeta fila" },
        h("div", {}, h("div", { class: "t-nom" }, doc.tipo || "Documento"), h("div", { class: "t-sub" }, doc.nombre)),
        h("button", { class: "btn mini sec", onclick: () => entregarArchivo(doc.blob, doc.nombre) }, "Abrir"))),
      h("a", { class: "btn sec", href: `#/obra/${id}/datos` }, "📄 Cargar contrato u orden de servicio")),
    h("button", { class: "btn grande", onclick: () => exportarExcel(id) }, "Exportar a Excel"),
    h("p", { class: "nota" }, "El Excel trae las hojas BITÁCORA y ACTIVIDADES con las mismas columnas de su CONTROL DE OBRA: copie las filas y péguelas allá para sacar actas y memorias."),
    h("button", { class: "btn peligro", onclick: async () => {
      if (prompt('Para borrar la obra completa escriba BORRAR') !== "BORRAR") return;
      for (const s of ["items", "personal", "bitacora", "avances", "fotos", "gastos", "documentos"]) for (const r of await db.deObra(s, id)) await db.borrar(s, r.id);
      await db.borrar("obras", id); ir("#/"); } }, "Borrar esta obra"),
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
