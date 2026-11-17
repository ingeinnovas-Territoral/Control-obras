// Formatos SST de obra (SG-SST de Ingeinnova, usados también por Flassservic).
// Cada formato es una lista de secciones con campos. Convenciones de las listas de chequeo:
//   "# Título" = subtítulo de grupo · texto terminado en " *" = ítem crítico (si queda malo, no se autoriza).

const SNNA = ["Sí", "No", "NA"], BMNA = ["B", "M", "NA"];
const DECISION = { k: "decision", t: "decision", l: "Decisión" };
const cabTarea = [
  { k: "obra", t: "texto", l: "Obra / frente", auto: "obra" },
  { k: "fecha", t: "fecha", l: "Fecha", auto: "fecha" },
  { k: "hora", t: "hora", l: "Hora", auto: "hora" },
  { k: "tarea", t: "texto", l: "Tarea / ubicación" },
  { k: "ats", t: "texto", l: "ATS N.º (SST-FO-06)", auto: "ats" },
  { k: "permiso", t: "texto", l: "Permiso N.º", auto: "permiso" },
];
const firmasVerifica = (a = "Supervisor / coordinador que verifica", b = "Residente de obra") =>
  ({ k: "firmas", t: "firmas", roles: [{ k: "verifica", l: a }, { k: "residente", l: b }] });
const lista7 = (n, titulo, extra, items, firmas) => ({
  codigo: "SST-FO-07", sub: `Lista ${n} de 7`, titulo: "LISTA DE CHEQUEO PARA TAREAS CRÍTICAS", subtitulo: titulo, grupo: "lista", lista: n,
  nota: "Marque Sí, No o NA. Si un ítem marcado con (*) queda en No, la tarea NO inicia hasta corregirlo.",
  secciones: [{ campos: [...cabTarea, ...extra] }, { titulo: "Verificación", campos: [{ k: "items", t: "lista", op: SNNA, malo: "No", items }] },
    { campos: [DECISION, firmas || firmasVerifica()] }],
});

// ---------------------------------------------------------------- FO-02 (7 hojas)
const cabEquipo = (serial = "Placa / serial / código") => [
  { k: "obra", t: "texto", l: "Obra / frente", auto: "obra" }, { k: "fecha", t: "fecha", l: "Fecha", auto: "fecha" }, { k: "hora", t: "hora", l: "Hora", auto: "hora" },
  { k: "equipo", t: "texto", l: "Equipo / marca / modelo" }, { k: "serial", t: "texto", l: serial },
  { k: "operador", t: "texto", l: "Operador / usuario" }, { k: "horometro", t: "texto", l: "Horómetro / km" }, { k: "licencia", t: "texto", l: "Licencia / certificado N.º" },
];
const hojaFO02 = (n, nombre, extra, items, serial) => ({
  codigo: "SST-FO-02", sub: `Hoja ${n} de 7`, titulo: "INSPECCIÓN PREOPERACIONAL DE EQUIPOS Y HERRAMIENTAS", subtitulo: nombre, grupo: "inspeccion", hoja: n,
  nota: "B = Bueno · M = Malo · NA = No aplica. Un ítem crítico (*) en M impide usar el equipo hasta repararlo.",
  secciones: [{ campos: [...cabEquipo(serial), ...(extra || [])] }, { titulo: "Inspección", campos: [{ k: "items", t: "lista", op: BMNA, malo: "M", items }] },
    { campos: [{ k: "decision", t: "decision", l: "Resultado de la inspección", si: "APTO para operar", no: "NO APTO – se retira, se marca 'Fuera de servicio' y se informa al residente" },
      { k: "accion", t: "area", l: "Acción correctiva / reparación" },
      { k: "firmas", t: "firmas", roles: [{ k: "inspecciona", l: "Operador / usuario que inspecciona" }, { k: "verifica", l: "Supervisor / residente de obra que verifica" }] }] }],
});

export const FORMATOS = {
  // ------------------------------------------------------------ FO-13
  "FO-13": { codigo: "SST-FO-13", titulo: "REGISTRO DE ASISTENCIA A INDUCCIÓN, CAPACITACIÓN Y CHARLAS DE 5 MINUTOS", grupo: "charla", corto: "Charla / capacitación", sinDecision: true,
    secciones: [{ campos: [
      { k: "tipo", t: "sel", l: "Tipo", op: ["Charla de 5 minutos", "Inducción", "Reinducción", "Capacitación", "Entrenamiento", "Simulacro", "Socialización", "Otro"] },
      { k: "tema", t: "texto", l: "Tema" }, { k: "fecha", t: "fecha", l: "Fecha", auto: "fecha" },
      { k: "hora", t: "hora", l: "Hora inicio", auto: "hora" }, { k: "horaFin", t: "hora", l: "Hora fin" },
      { k: "obra", t: "texto", l: "Obra / lugar", auto: "obra" }, { k: "facilitador", t: "texto", l: "Facilitador" }, { k: "cargoFac", t: "texto", l: "Cargo / entidad" },
      { k: "contenido", t: "area", l: "Contenido / temas tratados" },
      { k: "evaluacion", t: "sel", l: "Evaluación aplicada", op: ["No", "Sí"] }, { k: "material", t: "texto", l: "Material entregado" } ] },
    { titulo: "Asistentes", campos: [{ k: "personal", t: "personal", l: "Asistentes", firmas: ["firma"], cols: [{ k: "empresa", l: "Empresa", def: "empresa" }] }] },
    { campos: [{ k: "firmas", t: "firmas", roles: [{ k: "facilitador", l: "Facilitador" }, { k: "sst", l: "Responsable del SG-SST", opcional: true }] }] }] },

  // ------------------------------------------------------------ FO-06 ATS
  "FO-06": { codigo: "SST-FO-06", titulo: "ANÁLISIS DE TRABAJO SEGURO (ATS)", grupo: "ats", corto: "ATS", boton: "Aprobar el ATS",
    nota: "Se elabora en el sitio, con el equipo que hará la tarea, antes de empezar. Si cambian las condiciones se actualiza.",
    secciones: [{ titulo: "A. Datos de la tarea", campos: [
      { k: "obra", t: "texto", l: "Obra / contrato", auto: "obra" }, { k: "fecha", t: "fecha", l: "Fecha", auto: "fecha" }, { k: "hora", t: "hora", l: "Hora", auto: "hora" },
      { k: "tarea", t: "texto", l: "Tarea" }, { k: "frente", t: "texto", l: "Frente / ubicación" }, { k: "elaborado", t: "texto", l: "Elaborado por" },
      { k: "herramientas", t: "area", l: "Herramientas y equipos" },
      { k: "permisos", t: "marcas", l: "Permisos y listas asociados", op: ["Alturas SST-FO-01", "Espacio confinado SST-FO-09", "Trabajo en caliente SST-PR-07-A1", "Eléctrico SST-PR-12-A1", "Lista de chequeo SST-FO-07", "Ninguno"] } ] },
    { titulo: "B. Análisis por pasos", campos: [{ k: "pasos", t: "tabla", sugerir: true, filas: 3, cols: [
      { k: "paso", l: "Paso de la tarea" }, { k: "peligros", l: "Peligros" }, { k: "riesgos", l: "Riesgos (lo que puede pasar)" },
      { k: "controles", l: "Controles (eliminar, sustituir, ingeniería, administrativos)" }, { k: "epp", l: "EPP requerido" }, { k: "resp", l: "Responsable" }] },
      { k: "eppTarea", t: "marcas", l: "EPP de la tarea", op: ["Casco", "Gafas", "Careta", "Protector auditivo", "Tapabocas / respirador", "Guantes", "Botas con puntera", "Botas de caucho", "Chaleco reflectivo", "Arnés y eslinga", "Ropa manga larga", "Protector solar", "Polainas / anticorte"] } ] },
    { titulo: "C. Equipo de trabajo – participé en este análisis, conozco los peligros y aplicaré los controles", campos: [{ k: "personal", t: "personal", firmas: ["firma"] }] },
    { campos: [{ k: "firmas", t: "firmas", roles: [{ k: "elaboro", l: "Elaboró (maestro / supervisor de la tarea)" }, { k: "reviso", l: "Revisó (residente de obra)" }, { k: "verifico", l: "Verificó (responsable del SG-SST, cuando aplique)", opcional: true }] },
      { k: "punto", t: "texto", l: "Emergencias – punto de encuentro", auto: "punto" }, { k: "brigadista", t: "texto", l: "Brigadista / primer respondiente", auto: "brigadista" },
      { k: "arl", t: "texto", l: "Línea ARL SURA", auto: "arl" }, { k: "centro", t: "texto", l: "Centro de salud", auto: "centro" } ] }] },

  // ------------------------------------------------------------ FO-01 permiso de alturas
  "FO-01": { codigo: "SST-FO-01", titulo: "PERMISO DE TRABAJO EN ALTURAS", grupo: "permiso", corto: "Permiso de alturas", requisito: "alturas",
    nota: "Programa de protección contra caídas SST-PR-01 · Resolución 4272 de 2021 · Válido solo para la tarea y la jornada indicadas.",
    secciones: [{ titulo: "A. Datos de la obra y de la tarea", campos: [
      { k: "obra", t: "texto", l: "Obra / contrato", auto: "obra" }, { k: "fecha", t: "fecha", l: "Fecha", auto: "fecha" }, { k: "municipio", t: "texto", l: "Municipio", auto: "municipio" },
      { k: "frente", t: "texto", l: "Frente / ubicación exacta" }, { k: "hora", t: "hora", l: "Hora inicio", auto: "hora" }, { k: "horaFin", t: "hora", l: "Hora fin" },
      { k: "tarea", t: "area", l: "Descripción de la tarea" }, { k: "altura", t: "num", l: "Altura aprox. (m)" }, { k: "claridad", t: "num", l: "Distancia libre de caída calculada (m)" },
      { k: "suben", t: "texto", l: "Herramientas y materiales que se suben" },
      { k: "tipoTrabajo", t: "marcas", l: "Tipo de trabajo", op: ["Andamio", "Escalera", "Cubierta / techo", "Borde de losa o placa", "Fachada", "Estructura metálica", "Excavación con borde abierto", "Poste", "Árbol (poda)", "Otro"] } ] },
    { titulo: "B. Personal autorizado (certificado de alturas vigente, aptitud médica y ARL al día)", campos: [{ k: "personal", t: "personal", req: ["alturas", "medico", "arl"],
      cols: [{ k: "preuso", l: "Inspección preuso", op: ["Sí", "No"] }], firmas: ["inicio", "cierre"] }] },
    { titulo: "C. Peligros identificados en el sitio", campos: [{ k: "peligros", t: "lista", op: SNNA, items: ["Bordes abiertos, huecos o claraboyas", "Superficie resbalosa, frágil o inestable", "Lluvia, viento fuerte o tormenta eléctrica",
      "Líneas eléctricas cercanas", "Caída de herramientas u objetos", "Personas o tránsito debajo del área", "Andamio o escalera en mal estado", "Trauma por suspensión (rescate demorado)",
      "Radiación solar, calor o deshidratación", "Ofidios, abejas o avispas (trabajo en árboles)", "Iluminación deficiente"] }, { k: "peligroOtro", t: "texto", l: "Otro peligro / distancia a líneas eléctricas (m)" }] },
    { titulo: "D. Medidas de prevención y de protección", campos: [{ k: "medidas", t: "lista", op: ["Sí", "NA"], items: ["# Prevención (evitan la caída)",
      "Área delimitada y señalizada, con control de acceso", "Barandas de 1,0 m con travesaño intermedio y rodapié", "Huecos y orificios cubiertos o protegidos",
      "Andamio certificado, armado por persona competente, con tarjeta verde", "Escalera inspeccionada, amarrada y que sobresale 1 m", "Herramientas amarradas o en bolsa porta-herramientas",
      "Condiciones de clima aptas para iniciar", "# Protección (detienen la caída)", "Arnés de cuerpo completo certificado", "Eslinga con absorbedor de energía (doble terminal si hay desplazamiento)",
      "Eslinga de posicionamiento (cuando aplique)", "Línea de vida horizontal o vertical (con arrestador) certificada", "Conectores y mosquetones de doble seguro",
      "Distancia libre de caída suficiente para el sistema usado", "Casco con barbuquejo, gafas, guantes, botas"] }] },
    { titulo: "E. Inspección de equipos antes de usar (sin daños, etiqueta legible, dentro de vida útil)", campos: [{ k: "equipos", t: "lista", op: ["Sí", "No", "NA"], malo: "No", serial: true,
      items: ["Arnés *", "Eslinga con absorbedor *", "Eslinga de posicionamiento", "Línea de vida *", "Anclaje portátil / cinta", "Andamio", "Escalera", "Equipo de rescate *"] }] },
    { titulo: "F. Puntos de anclaje", campos: [{ k: "anclajes", t: "tabla", filas: 1, cols: [{ k: "ubicacion", l: "Ubicación / descripción del punto" }, { k: "tipo", l: "Tipo", op: ["Fijo", "Portátil", "Línea de vida"] },
      { k: "resiste", l: "Resiste 5.000 lb (22,2 kN) por persona", op: ["Sí", "No"], malo: "No" }, { k: "certificado", l: "Certificado por persona calificada", op: ["Sí", "No"], malo: "No" }, { k: "personas", l: "N.º de personas conectadas" }] }] },
    { titulo: "G. Plan de rescate", campos: [
      { k: "metodo", t: "marcas", l: "Método", op: ["Rescate desde arriba", "Rescate desde abajo", "Con escalera", "Con equipo de descenso / polipasto", "Plan de rescate de la obra socializado al equipo"] },
      { k: "rescatistas", t: "texto", l: "Rescatista(s) en el sitio" }, { k: "equipoRescate", t: "texto", l: "Equipo de rescate disponible" },
      { k: "arl", t: "texto", l: "ARL SURA (línea)", auto: "arl" }, { k: "centro", t: "texto", l: "Centro de salud más cercano", auto: "centro" }, { k: "traslado", t: "texto", l: "Tiempo de traslado", auto: "traslado" } ] },
    { titulo: "H. Autorización", campos: [DECISION, { k: "firmas", t: "firmas", roles: [{ k: "autoriza", l: "Autoriza – Coordinador de trabajo en alturas", cc: true, cert: "Certificado de coordinador N.º", req: "coordinador" },
      { k: "vobo", l: "Visto bueno residente / director de obra" }] }] },
    { titulo: "Cierre", cierre: true, campos: [{ k: "novedad", t: "sel", l: "Resultado", op: ["Sin novedad", "Con novedad / incidente"] }, { k: "novedadTxt", t: "area", l: "Novedad / incidente (describa)" },
      { k: "horaCierre", t: "hora", l: "Hora de cierre" }, { k: "firmasCierre", t: "firmas", roles: [{ k: "cierra", l: "Cierre – coordinador" }] }] }],
    suspension: true },

  // ------------------------------------------------------------ FO-09 espacio confinado
  "FO-09": { codigo: "SST-FO-09", titulo: "PERMISO DE ENTRADA A ESPACIO CONFINADO", grupo: "permiso", corto: "Permiso espacio confinado", requisito: "confinado",
    nota: "Programa SST-PR-06 · Resolución 0491 de 2020 · Válido solo para el espacio, la tarea y la jornada indicados. Si alguna lectura no es apta: NO ingresar o EVACUAR.",
    secciones: [{ titulo: "A. Datos del espacio y de la tarea", campos: [
      { k: "obra", t: "texto", l: "Obra / contrato", auto: "obra" }, { k: "fecha", t: "fecha", l: "Fecha", auto: "fecha" }, { k: "hora", t: "hora", l: "Hora inicio", auto: "hora" }, { k: "horaFin", t: "hora", l: "Hora fin" },
      { k: "espacio", t: "texto", l: "Espacio (código inventario)" }, { k: "ubicacion", t: "texto", l: "Ubicación exacta" }, { k: "profundidad", t: "num", l: "Profundidad (m)" },
      { k: "tipoEspacio", t: "sel", l: "Tipo de espacio", op: ["Pozo de inspección", "Alcantarilla / colector", "Box culvert", "Cámara / caja", "Tanque", "Excavación profunda", "Otro"] },
      { k: "tarea", t: "area", l: "Tarea a realizar" }, { k: "vertical", t: "sel", l: "Acceso vertical > 2,0 m (aplica SST-FO-01)", op: ["No", "Sí"] } ] },
    { titulo: "B. Peligros identificados", campos: [{ k: "peligros", t: "lista", op: SNNA, items: ["Deficiencia o exceso de oxígeno", "Atmósfera inflamable o explosiva", "Sulfuro de hidrógeno (H2S)",
      "Monóxido de carbono (CO) – motores cerca", "Ingreso súbito de agua o aguas residuales", "Atrapamiento o engullimiento (lodos, arena)", "Caída al ingresar o salir", "Energía eléctrica o mecánica",
      "Biológico (aguas residuales, roedores, insectos)", "Calor o espacio muy reducido"] }] },
    { titulo: "C. Aislamiento y ventilación", campos: [{ k: "aislamiento", t: "lista", op: SNNA, malo: "No", items: ["# Aislamiento", "Válvulas y bombas cerradas, bloqueadas y etiquetadas *", "Flujo desviado o taponado aguas arriba *",
      "Energía eléctrica cortada, bloqueada y etiquetada *", "Acceso delimitado y señalizado ('Espacio confinado')", "Tránsito vehicular controlado (pozos en vía)",
      "# Ventilación", "Ventilación mecánica instalada (inyección o extracción) *", "Ventilación previa antes de medir *", "Ventilación continua mientras haya personas adentro *",
      "Ventilador y planta lejos de la boca (sin gases de escape)", "Nunca se ventila con oxígeno puro *"] }] },
    { titulo: "D. Personal y roles (capacitación según el rol y aptitud médica vigentes)", campos: [{ k: "personal", t: "personal", req: ["medico", "arl"], firmas: ["firma"],
      cols: [{ k: "rol", l: "Rol", op: ["Supervisor de entrada", "Vigía (nunca entra)", "Entrante", "Rescatista"] }, { k: "capacitacion", l: "Capacitación vigente", op: ["Sí", "No"], malo: "No" },
        { k: "ingreso", l: "Hora ingreso" }, { k: "salida", l: "Hora salida" }] }] },
    { titulo: "E. Medición de la atmósfera (antes de ingresar y durante el trabajo)", campos: [
      { k: "detector", t: "texto", l: "Detector multigás (marca / serial)" }, { k: "calibracion", t: "fecha", l: "Última calibración" },
      { k: "bump", t: "sel", l: "Prueba de respuesta (bump test) hoy", op: ["Sí", "No"], malo: "No" },
      { k: "mediciones", t: "gases", filas: ["Inicial – parte alta", "Inicial – parte media", "Inicial – parte baja"] } ] },
    { titulo: "F. Equipos y rescate (nadie entra a rescatar sin protección respiratoria ni entrenamiento)", campos: [{ k: "equipos", t: "lista", op: ["Sí", "No"], malo: "No", items: [
      "Detector multigás calibrado y con batería *", "Ventilador / extractor y ducto *", "Trípode con malacate o sistema de recuperación *", "Arnés con línea de recuperación para cada entrante *",
      "Protección respiratoria", "Comunicación vigía–entrantes (voz, radio o señales) *", "Iluminación a prueba de explosión", "Escalera de acceso en buen estado y asegurada",
      "EPP: casco, botas de caucho, guantes, overol, gafas", "Botiquín, camilla y extintor en el sitio"] },
      { k: "rescate", t: "marcas", l: "Plan de rescate", op: ["Rescate sin ingreso (trípode y línea)", "Rescatista presente"] },
      { k: "arl", t: "texto", l: "Línea ARL SURA", auto: "arl" }, { k: "centro", t: "texto", l: "Centro de salud", auto: "centro" } ] },
    { titulo: "G. Autorización", campos: [DECISION, { k: "firmas", t: "firmas", roles: [{ k: "autoriza", l: "Autoriza – Supervisor de entrada: verifiqué mediciones, aislamiento, ventilación, personal y rescate" },
      { k: "vigia", l: "Recibe – Vigía: conozco el plan de rescate y controlo el ingreso y la salida" }] }] },
    { titulo: "Cierre", cierre: true, campos: [{ k: "cierreChk", t: "marcas", l: "Cierre", op: ["Entrantes afuera", "Equipos y aislamiento retirados", "Espacio cerrado"] },
      { k: "novedadTxt", t: "area", l: "Novedades" }, { k: "horaCierre", t: "hora", l: "Hora" }, { k: "firmasCierre", t: "firmas", roles: [{ k: "cierra", l: "Cierre – Supervisor de entrada" }] }] }],
    suspension: true },

  // ------------------------------------------------------------ PR-07-A1 permiso de trabajo en caliente
  "PR-07-A1": { codigo: "SST-PR-07-A1", titulo: "PERMISO DE TRABAJO EN CALIENTE", grupo: "permiso", corto: "Permiso trabajo en caliente",
    nota: "Válido solo para la jornada, el lugar y la tarea indicados. Si cambian las condiciones o se interrumpe por más de una hora, se revalida.",
    secciones: [{ campos: [
      { k: "obra", t: "texto", l: "Obra / ubicación exacta", auto: "obra" }, { k: "fecha", t: "fecha", l: "Fecha", auto: "fecha" }, { k: "hora", t: "hora", l: "Hora inicio", auto: "hora" }, { k: "horaFin", t: "hora", l: "Hora fin" },
      { k: "tipoTarea", t: "marcas", l: "Tarea", op: ["Soldadura", "Oxicorte", "Pulidora", "Otro"] }, { k: "tarea", t: "area", l: "Descripción del trabajo" },
      { k: "vigiaFuego", t: "texto", l: "Vigía de fuego" }, { k: "adicional", t: "marcas", l: "¿Requiere permiso adicional?", op: ["Alturas", "Espacio confinado"] } ] },
    { titulo: "Ejecutor(es)", campos: [{ k: "personal", t: "personal", req: ["medico", "arl"], firmas: ["firma"] }] },
    { titulo: "Verificación previa", campos: [{ k: "items", t: "lista", op: SNNA, malo: "No", items: [
      "Personal capacitado y con EPP completo (careta, gafas, guantes, peto, polainas, ropa de algodón) *", "Equipo de soldadura / oxicorte / pulidora inspeccionado y en buen estado *",
      "Cilindros asegurados, con válvulas antirretorno y sin fugas *", "Combustibles retirados en un radio de 11 m *", "Combustibles que no se pueden retirar protegidos con mantas o pantallas ignífugas *",
      "Aberturas en pisos y muros dentro de 11 m cubiertas", "Sin atmósfera inflamable; recipientes limpios y desgasificados *", "Extintor ABC de mínimo 20 lb, cargado e inspeccionado, en el sitio *",
      "Vigía de fuego designado y presente *", "Pantallas para proteger a otros trabajadores", "Ventilación o extracción de humos adecuada", "Área señalizada y personas ajenas retiradas"] }] },
    { titulo: "Autorización", campos: [DECISION, { k: "firmas", t: "firmas", roles: [{ k: "emite", l: "Emite (residente / supervisor)" }, { k: "ejecutor", l: "Ejecutor" }] }] },
    { titulo: "Cierre", cierre: true, campos: [{ k: "horaCierre", t: "hora", l: "Hora fin del trabajo" }, { k: "horaVigilancia", t: "hora", l: "Hora fin de vigilancia (mínimo 30 min después)" },
      { k: "sinFuego", t: "sel", l: "Área revisada sin fuego ni brasas", op: ["Sí", "No"] },
      { k: "firmasCierre", t: "firmas", roles: [{ k: "vigia", l: "Vigía de fuego" }, { k: "cierra", l: "Cierra el permiso" }] }] }] },

  // ------------------------------------------------------------ PR-12-A1 permiso eléctrico
  "PR-12-A1": { codigo: "SST-PR-12-A1", titulo: "PERMISO DE TRABAJO ELÉCTRICO", grupo: "permiso", corto: "Permiso eléctrico",
    secciones: [{ campos: [
      { k: "obra", t: "texto", l: "Obra / frente", auto: "obra" }, { k: "ubicacion", t: "texto", l: "Ubicación exacta" }, { k: "fecha", t: "fecha", l: "Fecha", auto: "fecha" },
      { k: "hora", t: "hora", l: "Hora inicio", auto: "hora" }, { k: "horaFin", t: "hora", l: "Hora fin" },
      { k: "tipoTrabajo", t: "marcas", l: "A. Tipo de trabajo", op: ["Trabajo en tablero o circuito de BT sin tensión", "Instalación provisional de obra", "Maquinaria o izaje cerca de redes", "Excavación cerca de redes subterráneas", "Poda o tala cerca de redes", "Otro"] },
      { k: "distancia", t: "texto", l: "Distancia medida (m) / tensión (kV), si aplica" }, { k: "descripcion", t: "area", l: "B. Descripción del trabajo y equipos a intervenir" } ] },
    { titulo: "C. Verificaciones previas", campos: [{ k: "items", t: "lista", op: SNNA, malo: "No", items: [
      "El ejecutor es persona calificada con matrícula vigente *", "ATS (SST-FO-06) diligenciado y socializado *", "Regla 1: corte efectivo de todas las fuentes, con corte visible *",
      "Regla 2: candados y tarjetas instalados (registrado en SST-PR-12-A2) *", "Regla 3: ausencia de tensión verificada con detector probado *", "Regla 4: puesta a tierra y en cortocircuito instalada (si aplica)",
      "Regla 5: zona señalizada y delimitada", "Coordinación con el operador de red (si aplica)", "Distancias de seguridad a redes verificadas y señalero asignado (maquinaria/izaje) *",
      "Herramienta aislada y equipos de medición en buen estado", "EPP dieléctrico completo (casco clase E, guantes dieléctricos, botas, gafas) *", "Condiciones climáticas adecuadas (sin lluvia ni tormenta eléctrica) *",
      "Extintor apto para fuego eléctrico (tipo C) y botiquín disponibles", "Plan de respuesta ante contacto eléctrico conocido por el equipo"] },
      { k: "matricula", t: "texto", l: "Matrícula N.º del ejecutor" }, { k: "constancia", t: "texto", l: "Constancia del operador de red N.º" } ] },
    { titulo: "D. Personal ejecutor", campos: [{ k: "personal", t: "personal", req: ["medico", "arl"], firmas: ["firma"], cols: [{ k: "matricula", l: "Cargo / matrícula" }] }] },
    { titulo: "E. Autorización", campos: [DECISION, { k: "firmas", t: "firmas", roles: [{ k: "ejecutor", l: "Ejecutor responsable" }, { k: "autoriza", l: "Autoriza (residente de obra)" }] }] },
    { titulo: "Cierre", cierre: true, campos: [{ k: "horaCierre", t: "hora", l: "Hora de cierre" },
      { k: "firmasCierre", t: "firmas", roles: [{ k: "cierra", l: "Cierre: trabajo terminado, herramientas y tierras retiradas, personal avisado, energía repuesta" }] }] }] },

  // ------------------------------------------------------------ PR-12-A2 LOTO
  "PR-12-A2": { codigo: "SST-PR-12-A2", titulo: "REGISTRO DE BLOQUEO Y ETIQUETADO (LOTO)", grupo: "permiso", corto: "Bloqueo y etiquetado (LOTO)", sinDecision: true,
    secciones: [{ campos: [{ k: "obra", t: "texto", l: "Obra / frente", auto: "obra" }, { k: "fecha", t: "fecha", l: "Fecha", auto: "fecha" },
      { k: "equipo", t: "texto", l: "Equipo o circuito bloqueado" }, { k: "codigo", t: "texto", l: "Código / placa" },
      { k: "motivo", t: "sel", l: "Motivo", op: ["Mantenimiento", "Limpieza", "Reparación", "Instalación"] }, { k: "permiso", t: "texto", l: "Permiso eléctrico N.º", auto: "permiso" } ] },
    { titulo: "A. Fuentes de energía identificadas y aislamiento", campos: [{ k: "fuentes", t: "tabla", filas: 1, cols: [{ k: "tipo", l: "Tipo de energía", op: ["Eléctrica", "Hidráulica", "Neumática", "Mecánica", "Gravitacional", "Térmica / otra"] },
      { k: "punto", l: "Punto de aislamiento" }, { k: "metodo", l: "Método de bloqueo" }, { k: "residual", l: "Liberación de energía residual" }, { k: "cero", l: "Verificación energía cero", op: ["Sí", "No"], malo: "No" }] }] },
    { titulo: "B. Candados y tarjetas instalados", campos: [{ k: "personal", t: "personal", firmas: ["instala", "retiro"], cols: [{ k: "candado", l: "N.º candado" }, { k: "horaIn", l: "Hora instalación" }, { k: "horaOut", l: "Hora retiro" }] }] },
    { titulo: "D. Cierre", cierre: true, campos: [{ k: "cierreChk", t: "marcas", l: "Cierre", op: ["Guardas reinstaladas", "Herramientas retiradas", "Personal fuera de zona", "Operador avisado", "Equipo probado"] },
      { k: "horaCierre", t: "hora", l: "Hora" }, { k: "firmasCierre", t: "firmas", roles: [{ k: "cierra", l: "Responsable del cierre" }] }] }] },

  // ------------------------------------------------------------ FO-07 (7 listas)
  "FO-07-1": lista7(1, "EXCAVACIONES Y ZANJAS", [{ k: "profundidad", t: "num", l: "Profundidad (m)" }, { k: "ancho", t: "num", l: "Ancho (m)" }, { k: "suelo", t: "texto", l: "Tipo de suelo" }], [
    "# Antes de excavar", "ATS elaborado y socializado con el equipo *", "Redes subterráneas identificadas (planos, consulta a empresas de servicios, detector) *", "Tipo de suelo y estabilidad evaluados por el residente *",
    "Sistema de protección definido: entibado, talud o escalonado según el suelo *", "Área delimitada y señalizada; pasos peatonales seguros", "Plan de manejo de tránsito si la excavación está en vía",
    "# Durante la excavación", "Material excavado y equipos a 0,60 m o más del borde", "Maquinaria trabaja lejos del borde y con señalero; nadie en su radio de giro *", "Escalera de acceso y salida dentro de la zanja",
    "Entibado instalado a medida que se profundiza *", "Sin agua acumulada; bombeo disponible", "Inspección de paredes al inicio de la jornada y después de cada lluvia *", "Barandas o cinta en el borde; tapas o pasarelas con baranda donde se cruza",
    "Si hay riesgo de gases (alcantarillado, profundidad): medición de atmósfera y SST-FO-09", "Borde con caída de 2,0 m o más: protección contra caídas (SST-PR-01)", "Trabajadores con casco, botas, guantes, gafas y chaleco",
    "Nadie trabaja solo dentro de la zanja; hay quien vigila desde afuera", "Iluminación y señales luminosas en la noche", "Al terminar la jornada: zanja protegida, tapada o cercada"]),
  "FO-07-2": lista7(2, "DEMOLICIONES", [], [
    "# Planeación", "Inspección previa de la estructura y método de demolición definido por el residente *", "Energía, agua, gas y otros servicios desconectados y verificados *",
    "Revisión de materiales con asbesto (tejas, tanques, ductos): si los hay, se suspende y se aplica manejo especial *", "Vecinos, vías y peatones protegidos (cerramiento, malla, polisombra)",
    "Área aislada y señalizada; acceso solo del personal autorizado *", "# Ejecución", "Demolición de arriba hacia abajo, sin debilitar elementos que sostienen otros *", "Apuntalamiento de elementos inestables",
    "Nadie trabaja en niveles diferentes en la misma vertical", "Humectación para controlar el polvo", "Escombros retirados sin sobrecargar losas; ductos o canaletas para bajarlos", "Herramientas y equipos inspeccionados (SST-FO-02)",
    "Trabajos a 2,0 m o más con permiso SST-FO-01", "Maquinaria con señalero y área de giro libre", "Clima apto (sin lluvia fuerte ni viento)", "# Protección personal", "Casco, gafas, guantes, botas con puntera",
    "Protección respiratoria para polvo y protección auditiva", "# Cierre", "Escombros dispuestos en sitio autorizado; área sin elementos sueltos"]),
  "FO-07-3": lista7(3, "TRABAJO CON MOTOSIERRA Y TALA DE ÁRBOLES", [{ k: "especie", t: "texto", l: "Especie / altura aprox. (m)" }, { k: "diametro", t: "num", l: "Diámetro (cm)" }, { k: "direccion", t: "texto", l: "Dirección de caída" }], [
    "# Antes de cortar", "Autorización de la autoridad ambiental (CAM) o del contratante para el aprovechamiento o la poda *", "Operador capacitado en motosierra y con aptitud médica *",
    "Motosierra inspeccionada (SST-FO-02, hoja 3) *", "Árbol evaluado: inclinación, ramas secas, pudrición, nidos de abejas o avispas, bejucos",
    "Sin líneas eléctricas en la zona de caída; si las hay, se suspende y se coordina con el operador de red *", "Zona de caída despejada: radio de al menos 2 veces la altura del árbol *",
    "Dos rutas de escape despejadas, en diagonal hacia atrás (45°) de la dirección de caída", "Vía o paso cerrado y señalizado si el árbol puede caer hacia ella", "# Durante el corte",
    "Corte de dirección (boca) y corte de caída dejando bisagra", "Nadie dentro de la zona de caída; comunicación con señales acordadas *", "Nunca se trabaja solo; hay un ayudante a distancia segura",
    "No se corta por encima de los hombros; poda en altura con SST-FO-01", "Abastecimiento de combustible con motor apagado y frío, lejos de fuentes de calor", "Viento y lluvia: se suspende el corte",
    "# Protección y emergencias", "Casco con visor y protector auditivo; pantalón o chaparreras anticorte; botas; guantes *", "Botiquín y plan de atención de mordedura de serpiente y picaduras (centro de salud identificado)",
    "Hidratación y pausas por calor"]),
  "FO-07-4": lista7(4, "TRABAJOS EN VÍAS O CERCA DE VÍAS CON TRÁNSITO (señalización temporal)", [{ k: "via", t: "texto", l: "Vía / abscisa / PR" }, { k: "cierre", t: "sel", l: "Tipo de cierre", op: ["Parcial", "Total", "Paso a un carril"] }], [
    "# Planeación", "Plan de manejo de tránsito (PMT) aprobado por la autoridad de tránsito o el contratante *", "Señalización según el Manual de Señalización Vial vigente del Ministerio de Transporte *",
    "Personal con chaleco reflectivo y ropa de alta visibilidad *", "# Montaje de la señalización (en el orden del PMT)", "Señales preventivas de obra a la distancia requerida antes de la zona", "Señal de velocidad reducida",
    "Zona de transición con conos, canalizadores o delineadores", "Barricadas o maletines delimitando el área de trabajo", "Paleteros (banderilleros) con paleta PARE / SIGA y radio, cuando se cierra un carril *",
    "Paso peatonal seguro y separado de la obra", "Iluminación, luces intermitentes y elementos reflectivos para la noche o lluvia", "# Durante el trabajo", "Maquinaria y vehículos con alarma de reversa, balizas y señalero *",
    "Material y equipos dentro del área delimitada, no en el carril abierto", "Nadie trabaja ni camina por fuera de la zona protegida", "Señales revisadas y reacomodadas durante la jornada",
    "# Cierre", "Señalización retirada en orden inverso al montaje", "Vía limpia y segura antes de abrir el tránsito"]),
  "FO-07-5": lista7(5, "TRABAJOS ELÉCTRICOS", [{ k: "circuito", t: "texto", l: "Circuito / equipo intervenido" }, { k: "tension", t: "texto", l: "Tensión (V)" }, { k: "bloqueo", t: "texto", l: "Responsable del bloqueo" }], [
    "# Personal y planeación", "Trabajo hecho por personal calificado (técnico o ingeniero electricista con matrícula profesional) *", "Trabajo planeado con ATS y permiso; diagrama o plano disponible",
    "Instalaciones provisionales de obra conforme al RETIE", "# Cinco reglas de oro (trabajo sin tensión)", "1. Corte efectivo de todas las fuentes de tensión *", "2. Bloqueo y etiquetado de los interruptores (candado y tarjeta) *",
    "3. Verificación de ausencia de tensión con detector o multímetro probado *", "4. Puesta a tierra y en cortocircuito de todas las fuentes posibles *", "5. Señalización y delimitación de la zona de trabajo",
    "# Equipos y entorno", "Herramientas aisladas en buen estado", "Escalera dieléctrica (no metálica)", "Distancias de seguridad a redes aéreas respetadas por personas, maquinaria y andamios *",
    "Tableros provisionales con tapa, protección diferencial y polo a tierra", "Extensiones sin empalmes, elevadas o protegidas", "Sin lluvia ni piso mojado en el área", "# Protección personal",
    "Casco dieléctrico, gafas, guantes dieléctricos de la clase adecuada, botas dieléctricas *", "Ropa de algodón o ignífuga; sin objetos metálicos", "# Cierre", "Herramientas retiradas, tierras retiradas y aviso antes de reenergizar"],
    firmasVerifica("Electricista responsable", "Supervisor / residente que verifica")),
  "FO-07-6": lista7(6, "TRABAJO EN CALIENTE (soldadura, oxicorte, corte con pulidora)", [{ k: "tipoCaliente", t: "marcas", l: "Tipo de trabajo", op: ["Soldadura eléctrica", "Oxicorte", "Corte con pulidora", "Otro"] }], [
    "# Antes de iniciar", "Permiso de trabajo en caliente firmado por el residente *", "Materiales combustibles retirados en un radio de 11 m o protegidos con mantas ignífugas *",
    "Extintor multipropósito cargado, a la mano *", "Recipientes o tuberías que contuvieron combustibles: vaciados, limpios y ventilados *", "En espacio confinado: medición de atmósfera y permiso SST-FO-09",
    "Pantallas o cortinas para proteger a terceros de chispas y radiación", "Ventilación suficiente para humos de soldadura", "# Equipos", "Máquina de soldar con polo a tierra, cables y pinza sin daños",
    "Cilindros de oxígeno y gas asegurados en posición vertical, con capuchón al almacenarlos", "Válvulas antirretroceso (arrestallamas) en el soplete y en los reguladores *", "Mangueras sin fugas ni empalmes improvisados",
    "Pulidora con guarda y disco adecuado (SST-FO-02)", "# Protección personal", "Careta con filtro de tono adecuado o gafas de oxicorte *", "Guantes, delantal, mangas y polainas de cuero", "Ropa de algodón sin grasa; botas de seguridad",
    "# Vigilancia y cierre", "Vigía de fuego durante el trabajo y al menos 30 minutos después de terminar *", "Área revisada sin brasas ni puntos calientes al cierre"]),
  "FO-07-7": lista7(7, "IZAJE DE CARGAS", [{ k: "equipoIzaje", t: "texto", l: "Equipo de izaje" }, { k: "peso", t: "num", l: "Peso de la carga (kg)" }, { k: "capacidad", t: "num", l: "Capacidad a ese radio (kg)" }], [
    "# Planeación", "Peso de la carga conocido (incluidos aparejos) *", "Capacidad del equipo verificada con su tabla de carga para el radio y la altura *", "Plan de izaje (izajes críticos o con más de un equipo)",
    "Operador certificado y aparejador / señalero designado *", "Inspección preoperacional del equipo de izaje *", "Si se iza con retroexcavadora (p. ej. tubería): el fabricante lo permite y se usa su punto de izaje",
    "# Aparejos", "Eslingas con etiqueta de capacidad, sin cortes ni hilos rotos *", "Grilletes, ganchos con seguro y cáncamos en buen estado *", "Ángulo de las eslingas considerado en la capacidad", "Cuerdas guía (vientos) para controlar la carga",
    "# Sitio", "Terreno firme y nivelado; estabilizadores extendidos sobre placas *", "Distancia segura a redes eléctricas *", "Área de izaje delimitada; nadie debajo de la carga *",
    "Señales de mano o radio acordadas entre operador y señalero", "Viento y clima aptos", "# Ejecución", "Izaje de prueba a pocos centímetros para verificar balance y frenos", "Carga nunca se deja suspendida sin operador",
    "Equipo con alarma y área de giro libre"],
    { k: "firmas", t: "firmas", roles: [{ k: "operador", l: "Operador del equipo" }, { k: "aparejador", l: "Aparejador / señalero" }, { k: "residente", l: "Supervisor / residente" }] }),

  // ------------------------------------------------------------ FO-02 (7 hojas)
  "FO-02-1": hojaFO02(1, "MAQUINARIA PESADA", [{ k: "maquina", t: "sel", l: "Equipo", op: ["Retroexcavadora", "Volqueta", "Vibrocompactador", "Motoniveladora", "Otro"] }], [
    "# Documentos y generales", "Tarjeta de registro / manual del equipo disponible; SOAT y revisión técnico-mecánica vigentes (volqueta)", "Operador con licencia o certificado de competencia para el equipo *",
    "# Motor y fluidos (revisar con motor apagado y frío)", "Nivel de aceite de motor", "Nivel de aceite hidráulico", "Nivel de refrigerante", "Combustible suficiente", "Sin fugas de aceite, combustible o hidráulico *",
    "Mangueras y conexiones hidráulicas sin fisuras ni fugas *", "Correas, batería y bornes en buen estado", "# Seguridad y cabina", "Frenos de servicio y freno de parqueo *", "Dirección y mandos responden bien *",
    "Alarma de reversa y pito funcionan *", "Luces, exploradoras y baliza", "Espejos y vidrios limpios y sin roturas", "Cinturón de seguridad *", "Estructura de protección de cabina (ROPS/FOPS) sin daños",
    "Peldaños y agarraderas de acceso firmes y limpios", "Extintor cargado y vigente; botiquín", "Tablero de instrumentos y alarmas funcionan", "Llantas (presión, cortes) u orugas (tensión, zapatas)",
    "# Implementos según el equipo", "Retroexcavadora: balde, dientes, pasadores, seguros, cargador frontal y estabilizadores", "Volqueta: volco, pistón, compuerta, carpa y seguro del volco",
    "Vibrocompactador: tambor, sistema de vibración, raspadores y articulación", "Motoniveladora: cuchilla, círculo, escarificador y articulación", "Equipo limpio, sin personas en el radio de giro; área de trabajo señalizada"]),
  "FO-02-2": hojaFO02(2, "VEHÍCULO LIVIANO (camioneta, campero, automóvil o motocicleta)", [], [
    "# Documentos", "Licencia de conducción vigente y de la categoría correcta *", "SOAT vigente *", "Revisión técnico-mecánica vigente *", "Licencia de tránsito (tarjeta de propiedad)",
    "# Estado del vehículo", "Frenos de servicio y de parqueo *", "Dirección sin juego excesivo *", "Llantas: presión, labrado y sin cortes (incluida repuesto)", "Luces altas, bajas, de freno, reversa y direccionales", "Pito",
    "Espejos retrovisores y laterales", "Parabrisas sin fisuras y limpiabrisas", "Cinturones de seguridad de todos los puestos *", "Niveles de aceite, refrigerante, líquido de frenos y agua del limpiabrisas",
    "Sin fugas visibles bajo el vehículo", "Tablero sin testigos de falla encendidos", "Puertas, chapas y seguros", "Carga asegurada; no se transportan personas en el platón",
    "# Equipo de carretera", "Gato y cruceta", "Dos señales de carretera (triángulos) reflectivos", "Botiquín", "Extintor cargado y vigente", "Dos tacos para bloquear el vehículo", "Caja de herramienta básica", "Linterna", "Chaleco reflectivo"]),
  "FO-02-3": hojaFO02(3, "MOTOSIERRA Y GUADAÑA", [{ k: "maquina", t: "sel", l: "Equipo", op: ["Motosierra", "Guadaña"] }], [
    "# Dispositivos de seguridad", "Freno de cadena funciona (motosierra) *", "Captor de cadena – atrapacadena (motosierra) *", "Protector de mano delantero y trasero (motosierra)", "Gatillo de acelerador con bloqueo *",
    "Interruptor de parada funciona *", "Protector (guarda) del disco o del cabezal de hilo (guadaña) *", "Arnés de hombro y ajuste a la máquina (guadaña)", "Silenciador y rejilla antichispas", "Sistema antivibración y empuñaduras firmes",
    "# Elementos de corte", "Cadena afilada, tensada y lubricada; espada sin daños (motosierra)", "Disco, cuchilla o hilo sin fisuras, ajustado (guadaña)", "Depósito de aceite de cadena con nivel (motosierra)",
    "# Motor y combustible", "Tanque y tapa sin fugas; mezcla de combustible correcta", "Arranque y ralentí estables (la cadena o el disco no giran en mínimo)", "Tornillos, tuercas y carcasa completos",
    "# Elementos de protección del operador", "Casco con visor de malla y protector auditivo", "Pantalón o chaparreras anticorte (motosierra) *", "Botas con puntera de seguridad", "Guantes y gafas de seguridad",
    "Kit de primeros auxilios y comunicación en el sitio"], "Códigos / seriales"),
  "FO-02-4": hojaFO02(4, "HERRAMIENTA ELÉCTRICA", [{ k: "maquina", t: "sel", l: "Equipo", op: ["Pulidora", "Taladro", "Mezcladora", "Otra"] }], [
    "# Partes eléctricas", "Cable sin cortes, empalmes ni aislamiento dañado *", "Clavija completa con polo a tierra *", "Interruptor enciende y apaga bien *", "Conectada a tomacorriente con protección diferencial (GFCI)",
    "Extensión adecuada, sin empalmes, protegida del agua y del tránsito", "# Partes mecánicas y guardas", "Guarda del disco instalada y ajustada (pulidora) *", "Disco adecuado al material y a las RPM de la pulidora, sin fisuras (pulidora)",
    "Mango auxiliar instalado (pulidora, taladro)", "Broca y mandril en buen estado; llave del mandril retirada (taladro)", "Tambor, aspas y corona sin daños (mezcladora)", "Guarda de piñones, correas y partes móviles (mezcladora) *",
    "Estructura estable, ruedas y freno o calzas (mezcladora)", "Motor de gasolina sin fugas (mezcladora, si aplica)", "Carcasa sin fisuras; tornillos completos", "Funciona sin ruidos ni vibraciones anormales",
    "# Elementos de protección del usuario", "Gafas o careta facial", "Protector auditivo", "Guantes adecuados a la tarea", "Protección respiratoria para polvo (pulidora, taladro)"], "Códigos / seriales"),
  "FO-02-5": hojaFO02(5, "ANDAMIO", [{ k: "alturaAndamio", t: "num", l: "Altura del andamio (m) – desde 2,0 m aplica SST-FO-01" }], [
    "# Documentos y montaje", "Andamio certificado; ficha técnica del fabricante disponible", "Montado por persona competente y con tarjeta de estado (verde / roja) *",
    "# Base", "Apoyado sobre terreno firme, nivelado, con placas base o tablones de reparto *", "Tornillos niveladores ajustados", "Ruedas con freno, bloqueadas durante el uso (andamio móvil)", "Aplomado y nivelado",
    "# Estructura", "Marcos, tubos y abrazaderas sin golpes, fisuras ni corrosión", "Crucetas y diagonales completas *", "Pasadores y seguros colocados en todas las uniones *", "Amarrado a la estructura según el fabricante",
    "# Plataformas y protecciones", "Plataformas completas, sin huecos, aseguradas contra desplazamiento *", "Barandas de 1,0 m, travesaño intermedio y rodapié *", "Acceso por escalera interna o integrada (no se trepa por los marcos)",
    "Sin material acumulado ni sobrecarga", "# Entorno", "Distancia segura a redes eléctricas", "Área inferior delimitada y señalizada", "Condiciones de clima aptas (sin viento fuerte ni tormenta)"], "Tipo / código / altura"),
  "FO-02-6": hojaFO02(6, "ESCALERA", [{ k: "tipoEscalera", t: "sel", l: "Tipo", op: ["Tijera", "Extensión", "Sencilla"] }, { k: "material", t: "sel", l: "Material", op: ["Fibra de vidrio", "Aluminio", "Madera"] }], [
    "# Identificación", "Etiqueta del fabricante legible (carga máxima, clase)", "Para trabajo eléctrico o cerca de redes: escalera dieléctrica (fibra de vidrio) *",
    "# Estado", "Largueros sin fisuras, dobleces ni astillas *", "Peldaños completos, firmes y limpios *", "Zapatas antideslizantes completas *", "Remaches, tornillos y uniones firmes",
    "Tijera: bisagras y separadores (tensores) funcionan y se bloquean", "Extensión: cuerda, polea y seguros (ganchos) funcionan", "Sin pintura que oculte defectos; sin reparaciones improvisadas",
    "# Uso", "Apoyada en superficie firme y nivelada", "Escalera de extensión: inclinación 1 a 4 (base a 1/4 de la altura)", "Sobresale 1 m del punto de llegada y está amarrada arriba",
    "No se usan los dos últimos peldaños; tres puntos de apoyo al subir", "Una sola persona a la vez", "Área inferior delimitada", "Si el trabajo es a 2,0 m o más: permiso SST-FO-01 y protección contra caídas"], "Código / longitud"),
  "FO-02-7": hojaFO02(7, "EQUIPO DE PROTECCIÓN CONTRA CAÍDAS (arnés, eslinga, línea de vida)", [], [
    "# Arnés de cuerpo completo", "Etiqueta legible: fabricante, serial, fecha de fabricación, norma *", "Reatas sin cortes, quemaduras, deshilachado, químicos ni decoloración *", "Costuras completas, sin hilos sueltos ni cortados",
    "Argollas D sin deformación, fisuras ni corrosión *", "Hebillas y ajustes funcionan", "Indicador de impacto sin activar *", "# Eslinga con absorbedor / de posicionamiento", "Reata o cuerda sin cortes, nudos ni desgaste",
    "Absorbedor cerrado, sin señales de activación *", "Ganchos y mosquetones con doble seguro que cierra solo *", "Etiqueta legible", "# Línea de vida y conectores",
    "Cuerda o cable sin cortes, aplastamientos, hilos rotos ni corrosión *", "Tensores, terminales y anclajes de los extremos firmes", "Arrestador / freno funciona y se bloquea (línea vertical)",
    "Línea certificada por persona calificada *", "Conectores de anclaje / cintas sin daños", "# Regla", "Equipo que detuvo una caída o con daño: se retira de inmediato y se destruye; se registra en su hoja de vida (SST-PR-01)"],
    "Seriales arnés / eslinga / línea"),

  // ------------------------------------------------------------ FO-10 entrega de EPP
  "FO-10": { codigo: "SST-FO-10", titulo: "REGISTRO DE ENTREGA DE EPP Y DOTACIÓN POR TRABAJADOR", grupo: "epp", corto: "Entrega de EPP", sinDecision: true,
    secciones: [{ titulo: "Datos del trabajador", campos: [{ k: "trabajador", t: "trabajador", l: "Trabajador" }, { k: "obra", t: "texto", l: "Obra / frente", auto: "obra" }, { k: "fecha", t: "fecha", l: "Fecha", auto: "fecha" },
      { k: "tallas", t: "texto", l: "Tallas (camisa, pantalón, botas, guantes)" }] },
    { titulo: "Entregas", campos: [{ k: "entregas", t: "tabla", filas: 1, cols: [{ k: "elemento", l: "Elemento entregado (EPP o dotación)" }, { k: "tipo", l: "Tipo", op: ["EPP", "Dotación"] },
      { k: "cant", l: "Cant." }, { k: "ref", l: "Talla / referencia" }, { k: "motivo", l: "Motivo", op: ["Ingreso", "Reposición por desgaste o daño", "Pérdida", "Dotación legal", "Cambio de tarea"] }] }] },
    { campos: [{ k: "compromiso", t: "nota", l: "Recibo los elementos anteriores en buen estado y sin costo. Me comprometo a usarlos durante la jornada, cuidarlos, guardarlos limpios, no prestarlos ni venderlos, revisarlos antes de usarlos y pedir su cambio cuando estén dañados o vencidos, devolviendo el elemento dañado." },
      { k: "firmas", t: "firmas", roles: [{ k: "trabajador", l: "Firma del trabajador", deTrabajador: true }, { k: "entrega", l: "Responsable de la entrega" }] }] }] },

  // ------------------------------------------------------------ FO-12 reporte
  "FO-12": { codigo: "SST-FO-12", titulo: "REPORTE DE ACTOS Y CONDICIONES INSEGURAS", grupo: "reporte", corto: "Reporte de acto o condición insegura", sinDecision: true,
    nota: "Cualquier trabajador, contratista o visitante puede llenarlo. Reportar es cuidar a todos: no hay sanción por reportar.",
    secciones: [{ titulo: "1. ¿Quién reporta? (puede dejarlo en blanco)", campos: [{ k: "nombre", t: "texto", l: "Nombre" }, { k: "cargo", t: "texto", l: "Cargo / empresa" },
      { k: "fecha", t: "fecha", l: "Fecha", auto: "fecha" }, { k: "hora", t: "hora", l: "Hora", auto: "hora" }, { k: "obra", t: "texto", l: "Obra / frente", auto: "obra" }, { k: "lugar", t: "texto", l: "Lugar exacto" }] },
    { titulo: "2. ¿Qué vio?", campos: [{ k: "que", t: "sel", l: "Tipo", op: ["Acto inseguro", "Condición insegura", "Casi accidente"] },
      { k: "tema", t: "marcas", l: "Tema", op: ["Alturas", "Excavación", "Eléctrico", "Maquinaria o vehículos", "Herramientas", "No uso de EPP", "Orden y aseo", "Tránsito en la vía", "Químicos o combustibles", "Animales (serpientes, abejas)", "Otro"] },
      { k: "descripcion", t: "area", l: "3. Cuente qué pasó (qué vio, dónde, quiénes estaban expuestos)" }, { k: "fotos", t: "fotos", l: "Fotos" },
      { k: "hizo", t: "marcas", l: "4. ¿Qué hizo en el momento?", op: ["Avisé al maestro o residente", "Detuve la tarea", "Corregí la condición", "Nada todavía"] },
      { k: "sugerencia", t: "area", l: "5. ¿Qué sugiere para que no se repita?" }] },
    { titulo: "6. Para uso del responsable del SG-SST / residente", cierre: true, campos: [{ k: "recibido", t: "texto", l: "Recibido por" }, { k: "causa", t: "area", l: "Análisis / causa" },
      { k: "accion", t: "area", l: "Acción correctiva" }, { k: "responsable", t: "texto", l: "Responsable" }, { k: "limite", t: "fecha", l: "Fecha límite" }, { k: "fechaCierre", t: "fecha", l: "Fecha de cierre" },
      { k: "informado", t: "sel", l: "Se informó al que reportó", op: ["Sí", "No"] }] }] },

  // ------------------------------------------------------------ FO-11 botiquín, camilla y extintores
  "FO-11": { codigo: "SST-FO-11", titulo: "INSPECCIÓN DE BOTIQUÍN, CAMILLA Y EXTINTORES", grupo: "botiquin", corto: "Botiquín, camilla y extintores", sinDecision: true,
    nota: "Inspección mensual y después de cada uso. Lo que falte o esté vencido se repone de inmediato.",
    secciones: [{ campos: [{ k: "obra", t: "texto", l: "Obra / sede", auto: "obra" }, { k: "fecha", t: "fecha", l: "Fecha", auto: "fecha" }, { k: "inspecciono", t: "texto", l: "Inspeccionó" }, { k: "cargo", t: "texto", l: "Cargo" }] },
    { titulo: "1. Botiquín", campos: [{ k: "ubicacionBot", t: "texto", l: "Ubicación" }, { k: "tipoBot", t: "sel", l: "Tipo", op: ["Fijo", "Portátil (frente de obra)"] },
      { k: "botiquin", t: "inventario", items: [["Gasas estériles (paquete)", "20"], ["Apósitos o compresas", "4"], ["Vendas elásticas de 2\" y 3\"", "2 c/u"], ["Vendas de gasa de 3\" y 5\"", "2 c/u"],
        ["Esparadrapo / cinta microporosa", "1"], ["Curas (venditas)", "20"], ["Guantes de nitrilo o látex (pares)", "10"], ["Tapabocas", "10"], ["Solución salina 500 ml", "2"], ["Jabón antiséptico o alcohol glicerinado", "1"],
        ["Tijeras punta roma", "1"], ["Termómetro digital", "1"], ["Linterna con pilas", "1"], ["Bajalenguas", "10"], ["Inmovilizadores para brazo y pierna (juego)", "1"], ["Manta térmica", "1"],
        ["Bolsa roja para residuos biológicos", "2"], ["Libreta y lapicero; lista de teléfonos de emergencia", "1"]] },
      { k: "notaBot", t: "nota", l: "El botiquín de la empresa no contiene medicamentos. Caja limpia, seca, marcada, señalizada y de fácil acceso." }] },
    { titulo: "2. Camilla", campos: [{ k: "ubicacionCam", t: "texto", l: "Ubicación" }, { k: "tipoCam", t: "sel", l: "Tipo", op: ["Camilla rígida (tabla espinal)", "Camilla plegable"] },
      { k: "camilla", t: "lista", op: ["B", "M"], malo: "M", items: ["Superficie sin fisuras ni astillas", "Correas de sujeción completas (mínimo 3) con hebillas que cierran", "Inmovilizador de cabeza (laterales y correas)",
        "Collares cervicales de varias tallas", "Ubicación señalizada y de fácil acceso; libre de obstáculos"] }] },
    { titulo: "3. Extintores", campos: [{ k: "extintores", t: "tabla", filas: 1, cols: [{ k: "ubicacion", l: "Ubicación" }, { k: "tipo", l: "Tipo", op: ["ABC", "CO2", "Otro"] }, { k: "capac", l: "Capac. (lb)" },
      { k: "ultima", l: "Última recarga", t: "fecha" }, { k: "proxima", l: "Próxima recarga", t: "fecha" }, { k: "manometro", l: "Manómetro en verde", op: ["B", "M"], malo: "M" }, { k: "pasador", l: "Pasador y sello", op: ["B", "M"], malo: "M" },
      { k: "manguera", l: "Manguera y boquilla", op: ["B", "M"], malo: "M" }, { k: "cilindro", l: "Cilindro sin golpes ni óxido", op: ["B", "M"], malo: "M" }, { k: "senal", l: "Señalizado y acceso libre", op: ["B", "M"], malo: "M" }] }] },
    { titulo: "Acciones correctivas", campos: [{ k: "acciones", t: "tabla", filas: 0, cols: [{ k: "accion", l: "Acción (reposición, recarga, cambio de ubicación)" }, { k: "resp", l: "Responsable" }, { k: "limite", l: "Fecha límite", t: "fecha" }, { k: "cumplida", l: "Cumplida (fecha)", t: "fecha" }] },
      { k: "firmas", t: "firmas", roles: [{ k: "inspecciona", l: "Inspeccionó" }, { k: "residente", l: "Residente de obra / responsable del SG-SST" }] }] }] },
};

// Tareas críticas: qué pasos pide cada una (en orden)
export const TAREAS = {
  alturas: { l: "Trabajo en alturas", pasos: ["FO-06", "FO-02-7", "FO-01"], opcionales: ["FO-02-5", "FO-02-6"] },
  caliente: { l: "Trabajo en caliente (soldadura, oxicorte, pulidora)", pasos: ["FO-06", "FO-02-4", "PR-07-A1", "FO-07-6"] },
  electrico: { l: "Trabajo eléctrico", pasos: ["FO-06", "PR-12-A1", "PR-12-A2", "FO-07-5"] },
  confinado: { l: "Espacio confinado", pasos: ["FO-06", "FO-09"] },
  excavacion: { l: "Excavaciones y zanjas", pasos: ["FO-06", "FO-07-1"] },
  demolicion: { l: "Demoliciones", pasos: ["FO-06", "FO-07-2"] },
  motosierra: { l: "Motosierra y tala de árboles", pasos: ["FO-06", "FO-02-3", "FO-07-3"] },
  vias: { l: "Trabajos en vías con tránsito", pasos: ["FO-06", "FO-07-4"] },
  izaje: { l: "Izaje de cargas", pasos: ["FO-06", "FO-07-7"] },
};

// Peligros y controles frecuentes para sugerir en el ATS (resumen de la matriz SST-MT-02)
export const SUGERENCIAS_ATS = [
  { paso: "Trabajo en cubiertas, andamios y bordes", peligros: "Caída de altura (más de 2 m)", riesgos: "Fracturas, trauma craneoencefálico, muerte", controles: "Permiso SST-FO-01, personal certificado, barandas, línea de vida y anclajes certificados, área delimitada", epp: "Arnés, eslinga con absorbedor, casco con barbuquejo" },
  { paso: "Excavaciones, zanjas y cimentaciones", peligros: "Derrumbe de paredes de excavación", riesgos: "Aplastamiento, asfixia, muerte", controles: "Talud o entibado según suelo, material a 0,60 m del borde, escalera de acceso, lista SST-FO-07-1", epp: "Casco, botas, guantes, chaleco" },
  { paso: "Operación de maquinaria y mezcladora", peligros: "Partes móviles, atrapamiento, golpes", riesgos: "Atrapamientos, amputaciones, contusiones", controles: "Operador certificado, guardas, inspección SST-FO-02, señalero, nadie en el radio de giro", epp: "Casco, botas, chaleco reflectivo" },
  { paso: "Instalaciones eléctricas provisionales", peligros: "Contacto eléctrico directo o indirecto", riesgos: "Electrocución, quemaduras", controles: "Tableros con diferencial y polo a tierra, extensiones sin empalmes, permiso SST-PR-12-A1", epp: "Guantes dieléctricos, botas dieléctricas" },
  { paso: "Cargue y descargue de cemento, acero y bloques", peligros: "Manipulación manual de cargas", riesgos: "Lumbalgia, hernia discal", controles: "Máximo 25 kg por persona, bultos de 50 kg entre dos o con carretilla, técnica de levantamiento", epp: "Guantes, botas" },
  { paso: "Corte de concreto y preparación de mezcla", peligros: "Polvo con sílice, contacto con cemento", riesgos: "Silicosis, dermatitis, irritación ocular", controles: "Corte en húmedo, ventilación", epp: "Respirador N95 o superior, gafas, guantes de nitrilo" },
  { paso: "Soldadura y corte con pulidora", peligros: "Chispas, radiación, proyección de partículas", riesgos: "Quemaduras, incendio, lesiones oculares", controles: "Permiso de trabajo en caliente, retiro de combustibles en 11 m, extintor, vigía de fuego", epp: "Careta, guantes y peto de carnaza" },
  { paso: "Trabajo a la intemperie", peligros: "Radiación solar, calor", riesgos: "Golpe de calor, deshidratación, quemaduras de piel", controles: "Hidratación, pausas a la sombra, horarios", epp: "Gorra con cubrenuca, ropa manga larga, protector solar" },
];
