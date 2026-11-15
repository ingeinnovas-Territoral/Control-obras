# Control de Obras

App de campo para el control de obra (bitácora diaria, avance por ítem del presupuesto y registro fotográfico) que **funciona sin internet** en el celular.

## Cómo instalarla en el iPhone
1. Abra en **Safari** la dirección de la app (GitHub Pages de este repositorio).
2. Toque **Compartir** → **Agregar a pantalla de inicio**.
3. Ábrala desde el ícono **Obras**. Desde ese momento funciona aunque no haya señal.

## Qué hace (etapa 1)
- Varias obras: cada una con sus datos, presupuesto, personal, bitácora, avance y fotos.
- **Presupuesto**: se carga desde el Excel de la entidad (archivo o copiar y pegar).
- **Bitácora diaria**: clima, jornada, personal presente, SST, novedades.
- **Avance**: cantidad ejecutada por ítem y por día, con frente de trabajo.
- **Fotos**: con la cámara del celular, comprimidas, con fecha, ítem y ubicación GPS.
- **Exportar a Excel**: hojas BITACORA y ACTIVIDADES con las mismas columnas del CONTROL DE OBRA en Excel, para pegar y sacar actas y memorias.
- **Copia de seguridad** de todo (incluidas las fotos).

## Próxima etapa
Sincronización en la nube: todo lo registrado en obra se sube solo cuando haya internet y se ve en vivo desde la oficina.

## Técnica
Página estática (HTML + JavaScript, sin compilación), datos en IndexedDB del celular, service worker para uso sin conexión y SheetJS para leer y escribir Excel.
