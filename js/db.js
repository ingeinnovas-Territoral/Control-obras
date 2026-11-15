// Almacenamiento local (IndexedDB). Todo se guarda primero en el celular; la cola "pendientes"
// guarda lo que falta por subir cuando se conecte la sincronización en la nube.
const DB_NAME = "control-obras";
const DB_VER = 2;
const STORES = ["obras", "items", "personal", "bitacora", "avances", "fotos", "gastos", "documentos", "pendientes"];

let _db = null;
function abrir() {
  if (_db) return Promise.resolve(_db);
  return new Promise((ok, mal) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (db.objectStoreNames.contains(s)) continue;
        const os = db.createObjectStore(s, { keyPath: "id" });
        if (s !== "obras" && s !== "pendientes") os.createIndex("obraId", "obraId");
      }
    };
    req.onsuccess = () => { _db = req.result; ok(_db); };
    req.onerror = () => mal(req.error);
  });
}

function tx(store, modo, fn) {
  return abrir().then(db => new Promise((ok, mal) => {
    const t = db.transaction(Array.isArray(store) ? store : [store], modo);
    let res;
    t.oncomplete = () => ok(res);
    t.onerror = () => mal(t.error);
    t.onabort = () => mal(t.error);
    res = fn(t);
  }));
}
function reqP(r) { return new Promise((ok, mal) => { r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); }); }

export function nuevoId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

export async function guardar(store, obj) {
  obj.actualizado = new Date().toISOString();
  if (!obj.id) obj.id = nuevoId();
  await tx([store, "pendientes"], "readwrite", t => {
    t.objectStore(store).put(obj);
    t.objectStore("pendientes").put({ id: store + ":" + obj.id, store, recId: obj.id, op: "put", ts: obj.actualizado });
  });
  avisar();
  return obj;
}

export async function borrar(store, id) {
  await tx([store, "pendientes"], "readwrite", t => {
    t.objectStore(store).delete(id);
    t.objectStore("pendientes").put({ id: store + ":" + id, store, recId: id, op: "del", ts: new Date().toISOString() });
  });
  avisar();
}

export async function uno(store, id) {
  const db = await abrir();
  return reqP(db.transaction(store).objectStore(store).get(id));
}

export async function todos(store) {
  const db = await abrir();
  return reqP(db.transaction(store).objectStore(store).getAll());
}

export async function deObra(store, obraId) {
  const db = await abrir();
  return reqP(db.transaction(store).objectStore(store).index("obraId").getAll(obraId));
}

export async function contarPendientes() {
  const db = await abrir();
  return reqP(db.transaction("pendientes").objectStore("pendientes").count());
}

// Reemplaza todos los registros de una obra en un almacén (p. ej. al volver a cargar el presupuesto)
export async function reemplazarDeObra(store, obraId, lista) {
  const viejos = await deObra(store, obraId);
  const ahora = new Date().toISOString();
  await tx([store, "pendientes"], "readwrite", t => {
    const os = t.objectStore(store), pe = t.objectStore("pendientes");
    for (const v of viejos) { os.delete(v.id); pe.put({ id: store + ":" + v.id, store, recId: v.id, op: "del", ts: ahora }); }
    for (const n of lista) {
      n.obraId = obraId; n.actualizado = ahora; if (!n.id) n.id = nuevoId();
      os.put(n); pe.put({ id: store + ":" + n.id, store, recId: n.id, op: "put", ts: ahora });
    }
  });
  avisar();
}

// Copia de seguridad completa (incluye fotos en base64)
export async function exportarTodo() {
  const out = { app: "control-obras", version: 1, fecha: new Date().toISOString(), datos: {} };
  for (const s of STORES) {
    if (s === "pendientes") continue;
    const regs = await todos(s);
    if (s === "fotos") {
      for (const f of regs) if (f.blob) { f.blob64 = await blobA64(f.blob); delete f.blob; }
    }
    out.datos[s] = regs;
  }
  return out;
}

export async function importarTodo(json) {
  if (!json || json.app !== "control-obras") throw new Error("El archivo no es una copia de seguridad de Control de Obras.");
  for (const s of Object.keys(json.datos)) {
    if (!STORES.includes(s) || s === "pendientes") continue;
    const regs = json.datos[s];
    if (s === "fotos") for (const f of regs) if (f.blob64) { f.blob = await (await fetch(f.blob64)).blob(); delete f.blob64; }
    await tx(s, "readwrite", t => { const os = t.objectStore(s); for (const r of regs) os.put(r); });
  }
  avisar();
}

function blobA64(b) {
  return new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
}

const oyentes = new Set();
export function alCambiar(fn) { oyentes.add(fn); }
function avisar() { for (const fn of oyentes) try { fn(); } catch (e) { console.error(e); } }
