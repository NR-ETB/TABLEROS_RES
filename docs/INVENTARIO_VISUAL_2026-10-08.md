# Responsys 1.0A: inventario completo y lectura visual

Sistema aprobado guardado en `.interface-design/system.md`: mesa de análisis ETB, indicadores con jerarquía de volumen, navegación subrayada, bordes discretos y vidrio reservado a controles y diálogos. Se mantienen ambos temas.

## Intención de componentes

- Evolución: entender volumen, actividad y períodos vacíos. Una curva focal, selección cian, cifras exactas, Segoe UI y controles de 44 px. Selector de envíos/aperturas/clics/rebotes, línea/barras y escala logarítmica opcional identificada. El pico inicial queda marcado. Puntero, toque y control de período con teclado; distancia temporal real y gaps conservados.
- Inventario: encontrar la ficha original. Nombre e ID primero; asunto, estado/tipo, folder/lista y actividad auxiliar. Superficies ETB con bordes, rejilla de 4 px y separaciones de 8/16 px. Una barra de cobertura distingue fichas con/sin registros; ambos segmentos filtran.
- Fichas: seguir desde agregados hasta fuente. Ficha, Catálogo y Registros son pestañas distintas. Reutilizar Dialog para foco/Escape. Campos paginados según altura y ancho, máximo seis por página. Textos largos se dividen en fragmentos de 140 caracteres, conservando todo el contenido.
- Filtros y reportes: misma familia de superficies y controles, borrador Aplicar/Cancelar, URL compartible, fechas inclusivas y exportaciones completas.

## Información y alcance

Lectura autenticada del mismo Google Sheet: 1.812 fichas de Campañas Vigentes, sus 11 columnas originales y 32.804 registros estadísticos con sus 18 columnas originales. Se conserva cada ficha duplicada y la selección del cruce ACTIVE/ID mayor. Campañas sin estadísticas se muestran en Inventario; no se introducen filas estadísticas ficticias ni se suman fichas como envíos.

Campañas muestra rendimiento agrupado por nombre original. Inventario tiene URL propia `#/inventario` dentro de Campañas. Las fechas y filtros de registros acotan su actividad; nombre/asunto/remitente/lista/folder/propósito/tipo/estado acotan las fichas. El selector con/sin registros pertenece a Inventario. La coincidencia de búsqueda ignora acentos y admite palabras en cualquier orden. Buscar en todos los campos incluye ID y valores del catálogo; asunto y remitente tienen filtros independientes.

CSV de registros conserva las 16 columnas analíticas, añade 18 columnas `Fuente:` y 11 `Catálogo:`. CSV de catálogo conserva todas las fichas filtradas, sus campos, fila original y actividad del corte, incluso fichas sin estadísticas. CSV con BOM UTF-8, punto y coma, comillas y protección de fórmulas. Los campos originales de tasas se conservan, pero los KPIs continúan calculándose desde conteos.

## Corte y publicación

Snapshot leído del Google Sheet el 8 de octubre de 2026; corte 2026-10-08, fingerprint `110951ba71d44cc0`. El origen se identifica como snapshot; esta lectura puntual no configura la sincronización horaria. Las diferencias respecto al snapshot anterior están en `CORTE_INVENTARIO_2026-10-08.json`. No se deduplicaron estadísticas ni se eliminaron anomalías.

Contrato de resumen versión 2; 32.074 bytes sin comprimir. Inicio descarga solo overview.json. El detalle completo se solicita una vez por necesidad, con corte en URL y validación del fingerprint. El resumen usa `cache: no-store` para evitar reutilizar un corte anterior. Motor puro compartido entre Worker y fallback; metadatos de búsqueda evaluados por campaña para evitar repetir normalización en cada registro.

## Validación

Pruebas Python y TypeScript cubren contrato, equivalencia de agregados, comparación temporal, gaps, cero denominador, catálogo completo/duplicado/sin estadísticas, búsquedas por ID/asunto/remitente/acento, navegación compartida y exportación de todos los campos. Build con base `/TABLEROS_RES/`.

Resultado local: 14 pruebas TypeScript y 10 Python aprobadas, validación del snapshot y compilación aprobadas. Consultas sobre 32.804 filas: mediana de 59,4 ms y máximo de 66,9 ms en el ensayo automatizado tras calentamiento; el tiempo depende del dispositivo. Resumen sin desbordamiento comprobado en 1366×768, 1920×1080 y 390×844; ventanas de 390×390 usan los controles compactos descritos arriba.

Descargas comprobadas en navegador: catálogo con 1.812 filas; registros de 2026-01-01 a 2026-03-31 con 3.103 filas, 45 columnas y 1.791.731 envíos, coincidentes con la fuente.

Revisión visual y funcional de escritorio y móvil, ambos temas, ventana corta, foco, Escape y paginación. En poca altura la evolución conserva la gráfica y abre cifras/opciones en un panel de dos pestañas; los filtros quedan disponibles desde el encabezado. El ID de la fila del inventario se consulta en su ficha cuando la altura exige una tabla más compacta.
