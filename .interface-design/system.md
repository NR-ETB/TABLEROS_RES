# ETB · Responsys — sistema de diseño

## Intención
Mesa de trabajo para el analista que revisa rendimiento, consulta el inventario y entrega cortes reproducibles. Precisión, calma y trazabilidad. Mantener Google Sheets, Python, React/Vite y GitHub Pages.

## Dominio y firma
Corte, envíos, entrega, aperturas únicas, clics únicos, folders, programas, catálogo e incidencias. Firma: franja continua de KPIs dominada por envíos, selección cian y navegación subrayada. Una gráfica focal por vista; cifras exactas y procedencia acompañan cada visualización.

## Color y superficies
Marca #003C92 y #004797; acentos #01CADF y #00F3F9; blanco #FFFFFF. Texto claro #17375F, secundario #50647E; acento legible #00798A. Modo oscuro: fondo #0C1B2A, superficie #11283E, texto #E1EFFF, secundario #A8C1DB y acento #52E7F2. Usar las variables de styles.css; no introducir colores ad hoc.

Profundidad mediante tonos y bordes discretos. Paneles tranquilos sin sombras ornamentales. Vidrio blanco translúcido y blur de 12 px reservado a barra de controles y diálogos; fallback sólido. Texto y gráficos opacos. No aplicar brillo a todos los bloques.

## Tipografía y medidas
Segoe UI Variable / Segoe UI / sistema. Base 14 px, etiquetas 12 px, valores con cifras tabulares y peso 600. Escala de 4 px, separaciones 8/16 px, paneles 16 px. Radio de controles 6 px, paneles 8 px. Controles táctiles de 44 px. Transiciones hasta 160 ms; sin transformaciones ni animación con movimiento reducido.

## Composición
Escritorio: encabezado, barra de filtros, KPIs, evolución y ranking, distribuciones y aviso de calidad. En 1366×768 todo el resumen debe ser visible. Móvil y poca altura: pestañas de gráficas y paginación adaptada al espacio. No usar desplazamiento global o interno para esconder información: todas las opciones y campos se alcanzan mediante páginas o pestañas.

Evitar tarjetas de igual peso para todos los KPIs, navegación en cápsulas y gradientes/brillos decorativos repetidos. El volumen y la evolución reciben la jerarquía principal.

## Contratos de interacción
Filtros con borrador, Aplicar, Cancelar y Limpiar. URL con fragmento, navegación atrás/adelante. Búsqueda tolerante a acentos y múltiples palabras; mostrar el alcance. Catálogo y rendimiento distinguidos: una campaña sin estadísticas no equivale a cero envíos. Reportes por fechas incluyen ambos extremos y todas las filas filtradas.

Reutilizar Dialog: Escape, foco contenido, fondo inerte y devolución del foco. Estados de carga, vacío, error y sincronización identificados con texto. Etiquetas visibles, foco visible, contraste AA. Gráficas con escala/unidad, fecha, valor exacto, vacíos explícitos y operación por teclado.

## Datos
Preservar filas, nombres originales y campos del inventario. No borrar anomalías ni duplicados. Tasas por suma de conteos; nunca promedio de tasas de filas. Cobertura de días no certifica integridad. Fuente, corte y sincronización visibles; catálogo completo se carga con el detalle, no en el resumen inicial.

## Patrones comprobados
Campos originales en páginas adaptativas: dos columnas desde 620 px, una en móvil, presupuesto de 108 px por campo. Dividir valores extensos en fragmentos de 140 caracteres identificados; mantener acceso a todo el contenido. Máximo seis campos por página.

Por debajo de 600 px de altura, «Explorar gráfica» reúne cifras, período, métrica y escala en un diálogo con pestañas. Por debajo de 450 px, los filtros se abren desde el encabezado. No encoger controles por debajo de 44 px.

Inventario: filas de 72 px normalmente y 56 px en ventanas de poca altura; cabecera compacta de 32 px. Móvil muestra nombre y actividad; la ficha conserva todos los campos. Ajustar cantidad de filas al espacio real disponible, sin recortes ni desplazamiento.

Fechas filtran actividad registrada, no la creación de fichas del catálogo. Identificar campañas sin estadísticas y conservar entradas duplicadas. Descargas de catálogo y de rendimiento tienen alcances distintos y etiquetas explícitas.

## Antes de cada componente
Declarar intención, jerarquía, paleta, profundidad, superficies, tipografía y espaciado. Validar escritorio, móvil, poca altura, teclado, ambos temas y estados vacíos antes de entregar.
