# Responsys 1.0A: operación ETB, filtros y reportes

## Cambios

- Indicadores en una franja continua: envíos domina, tasas acompañan. Navegación por pestañas con marca de selección cian, superficies discretas, bordes de 8 px y vidrio limitado a controles y diálogos. Temas claro y oscuro conservados.
- Filtros nuevos por texto de lista, año de origen, envíos mínimos/máximos por registro y presencia de aperturas, clics o rebotes. Se aplican antes de sumar; búsqueda de lista sin distinguir mayúsculas. Campos accesibles mediante grupos y, en ventanas estrechas y bajas, Más campos.
- Filtros persistentes en fragmentos de URL. Valores numéricos y rangos inválidos se rechazan en el formulario y se sanea la URL. Quitar filtros desde la franja conserva los demás.
- Reportes independientes del estado del tablero: fechas inclusivas, filtros actuales opcionales, todos los registros seleccionados. Campañas, días, registros e incidencias en CSV; informe HTML imprimible con resumen, campañas completas, filtros, fuente, corte, sincronización y hash. Para PDF se usa Imprimir/Guardar como PDF del navegador.
- Fechas desconocidas excluidas de reportes fechados. La descarga directa de Calidad conserva los registros sin fecha. Se mantienen incidencias y fórmulas originales.
- Motor de reportes en el mismo worker de consultas, con respaldo en el hilo principal y validación del hash. Los módulos de reportes, Campañas y Calidad se cargan cuando se abren.
- Paneles de altura estable, Escape, foco contenido y devolución del foco. No se añadió ninguna dependencia.

## Validación

- 12 pruebas TypeScript aprobadas; 9 pruebas Python aprobadas. Compilación y comprobación de tipos correctas con `VITE_BASE_PATH=/TABLEROS_RES/`.
- Snapshot intacto: 32.804 registros, hash `1ff90bb8129c2372`, resumen de 23.331 bytes. KPIs iguales a los resúmenes Python para los cuatro períodos rápidos.
- Consultas locales: mediana 49,2 ms, máximo observado 68,4 ms, por debajo de 150 ms. Medición del equipo local, no garantía para todo dispositivo.
- Resumen, Campañas y Calidad revisados a 1366×768, 1920×1080, 390×844, 320×568, 844×390 y 683×384: controles dentro del viewport, dimensiones globales iguales al viewport, tablas sin desplazamiento y paginación adaptativa.
- Grupos de filtros y pasos de reporte revisados en escritorio y móvil; campos paginados, validación y reportes accesibles también a 320×384. Ajustada altura del reporte para evitar que el contenido exceda su contenedor.
- Descarga real en navegador de CSV e informe HTML para 2026-01-01 al 2026-03-31. Con mínimo de 100 envíos y clics: 935 registros. Sin filtros: 3.105 registros, 20 campañas y 1.792.042 envíos. HTML descargado abierto y revisado.
- Pruebas de límites inclusivos, selección vacía, fechas inválidas, fechas desconocidas, rangos de volumen, URL, consistencia de agregados y protección de nombres en HTML/CSV.
- Build estático servido bajo `/TABLEROS_RES/`: resumen inicial como única descarga de datos; detalle solicitado al generar el reporte. Rutas de assets y worker con el prefijo correcto. Foco devuelto al botón Reportes tras cerrar.

Evidencias: `assets/responsys-operacion-desktop.jpg` y `assets/responsys-operacion-mobile.jpg`. La dirección de diseño se documenta en `DIRECCION_VISUAL_2026-10-08.md`.
