# ETB · Responsys 1.0A

Tablero de rendimiento de campañas con identidad ETB, superficies liquid glass y publicación estática en [GitHub Pages](https://nr-etb.github.io/TABLEROS_RES/).

## Arquitectura y datos

`Google Sheets → Python ETL → overview.json + dashboard.json → React/Vite → GitHub Pages`

- Fuente: `Invetario_Responsys_2.0`, spreadsheet `1widnx3vomsT6j0Z3jpfh7IASwNd-Bix_lBXgp2tdVVQ`.
- El ETL une estadísticas con `Campañas Vigentes` y `Folders Vigentes` mediante nombres normalizados. Conserva los nombres originales para agrupar campañas y hacer selecciones exactas.
- `Sent Date` define el tiempo. El año de la pestaña se conserva como `sy` y sus discrepancias aparecen en Calidad.
- No se deduplican las estadísticas ni se eliminan filas con incidencias. Se conserva también actividad sin nombre, fecha o envíos.
- Catálogo de campañas con claves repetidas: la regla existente elige estado activo y luego ID mayor. La cantidad de claves duplicadas aparece como control global.
- El inicio descarga únicamente `overview.json` (contrato versión 1, menos de 50.000 bytes), con cuatro resúmenes y opciones de filtro.
- `dashboard.json` se descarga una vez cuando hacen falta filtros detallados, campañas, incidencias o exportación. Un Web Worker comparte el motor puro de cálculo con su respaldo en el hilo principal.
- Resumen y detalle deben tener el mismo `dataHash`. Un cambio de corte exige recargar; nunca se mezclan ambos cortes.

## Navegación

**Resumen** abre todo el histórico y muestra cinco KPIs, evolución, top cinco, distribuciones e incidencias. El gráfico de actividad compara entrega, aperturas, clics y rebotes sobre envíos; las categorías se solapan y no representan un embudo. **Campañas** agrupa por nombre original y ordena inicialmente por envíos. **Calidad** separa incidencias de la selección y controles de la **Fuente completa**.

Los períodos rápidos terminan en la última fecha disponible: histórico, 30 días, 90 días y año disponible. Más filtros agrupa período, campaña, categorías y controles en pestañas. Aplicar confirma; Cancelar descarta el borrador; Limpiar dentro del panel restablece el borrador y requiere Aplicar. La búsqueda principal espera 150 ms sin cambios y los resultados de consultas anteriores se ignoran. Los filtros activos se pueden editar o limpiar.

Las URLs usan fragmentos (`#/campanas?period=last30&campaignExact=...`); funcionan al compartir, recargar y navegar atrás/adelante bajo `/TABLEROS_RES/`. Las exportaciones CSV incluyen todos los registros filtrados, independientemente de la página. Calidad exporta la incidencia seleccionada sin duplicar filas que presentan varias incidencias.

El tablero ocupa el alto disponible (`100dvh`) sin desplazamiento vertical ni horizontal. En móvil o ventanas bajas, las cinco gráficas se consultan mediante pestañas y se conservan los cinco indicadores. Campañas, registros y ranking ajustan las filas por página al espacio disponible, con un máximo de 25; toda la selección sigue disponible mediante paginación y CSV. Las tablas compactas muestran campaña y métrica seleccionada; los detalles mantienen las demás cifras y campos. Las ventanas bajas trasladan los filtros al botón del encabezado. Paneles con foco contenido, Escape y devolución del foco, incluyendo detalles anidados.

El botón de sol/luna cambia entre modo claro y oscuro ETB. La primera visita respeta la preferencia del sistema; la elección se guarda en este navegador. Ambos temas usan azul ETB, cian, superficies glass legibles, foco visible, respaldo sólido del vidrio y movimiento reducido.

## Fórmulas y comparación

Las tasas usan sumas de conteos, sin promediar tasas por fila:

- Entrega: `max(sum(envíos) − sum(rebotes blandos) − sum(rebotes duros), 0) / sum(envíos)`.
- Aperturas/envíos: `sum(aperturas únicas) / sum(envíos)`.
- Clics/envíos: `sum(clics únicos) / sum(envíos)`.
- Rebotes: `(sum(rebotes blandos) + sum(rebotes duros)) / sum(envíos)`.

Los denominadores cero se muestran como `N/D`. Conteos se comparan mediante diferencia relativa; tasas, en puntos porcentuales. El período anterior es inmediatamente contiguo y tiene igual duración inclusiva. Sin registros anteriores o sin denominador válido se muestra `No comparable`. El histórico muestra `Sin período anterior comparable`.

Los intervalos sin registros interrumpen el gráfico, en lugar de inventar ceros. La distancia horizontal representa tiempo real. La cobertura informa días con registros y no certifica integridad. Fechas desconocidas quedan fuera de los rangos fechados y se consultan desde Calidad, conservando los demás filtros.

## Ejecutar con el snapshot incluido

Requisitos: Python 3.12 y Node 22.12 o superior. Dependencias directas y transitivas están fijadas.

```bash
pip install -r backend/requirements.lock
python backend/scripts/build_overview.py
python backend/scripts/validate_dataset.py
cd frontend
npm ci
npm run dev
```

No hace falta una cuenta de Google para visualizar el snapshot. Para reconstruir desde Excel:

```bash
python backend/scripts/sync_responsys.py --source xlsx --xlsx /ruta/Invetario_Responsys_2.0.xlsx --output frontend/public/data/dashboard.json
```

## Sincronización lectora de Google Sheets

1. Habilitar Google Sheets API en Google Cloud y crear una cuenta de servicio.
2. Compartir la hoja con su correo como **lector**.
3. Configurar `GOOGLE_SERVICE_ACCOUNT_JSON` en GitHub Actions. Nunca incluir el archivo de credenciales en Git.
4. Mantener `RESPONSYS_SPREADSHEET_ID` con el ID de la misma base. `.env.example`, Compose y Actions emplean ese nombre.
5. Seleccionar GitHub Actions como fuente de Pages.

El workflow existente corre al publicar en `main`, manualmente y cada hora. Sin secreto publica el snapshot versionado; la pantalla identifica snapshot, corte y sincronización antigua. Con secreto sincroniza, genera ambos JSON, valida contratos y ejecuta pruebas antes de publicar. React nunca recibe credenciales ni consulta directamente Sheets.

Si un build ya aprobado queda bloqueado al asignar un runner Ubuntu, Actions ofrece **Recuperar publicación de Pages** (`recover-pages.yml`). Ejecutarlo desde `main` e indicar el ID de la ejecución original en `source_run_id`. Comprueba que el paquete procede del workflow habitual de `main`, tiene un build aprobado y no ha caducado; después lo publica desde `macos-15` sin regenerar datos. El paquete de origen se conserva durante un día. La recuperación comparte la exclusión mutua `pages` y cancela cualquier publicación anterior pendiente. Una incidencia general de Actions también puede bloquear esta alternativa.

Docker local: copiar `.env.example` a `.env`, configurar la ruta de credenciales y ejecutar `docker compose up`. El frontend abre en `http://localhost:5173` después de sincronizar el ETL.

## Verificación

```bash
python -m unittest discover -s backend/tests -p 'test_*.py'
python backend/scripts/validate_dataset.py
cd frontend
npm test
npm run build
```

Para revisar la ruta real de Pages, compilar con `VITE_BASE_PATH=/TABLEROS_RES/`, volver a la raíz y ejecutar `python backend/scripts/preview_pages.py`. Abre `http://localhost:4180/TABLEROS_RES/`. Sus logs permiten confirmar que el inicio solicita solo el resumen. `--fault overview`, `detail`, `hash` o `worker` permite probar carga fallida, cortes diferentes y respaldo del worker.

Las pruebas verifican paridad Python/TypeScript en los cuatro períodos del snapshot, conteos, límites inclusivos, períodos vacíos, fechas desconocidas, anomalías, agrupación exacta, paginación, CSV, enlaces y objetivo de consultas inferior a 150 ms. La validación rechaza contratos rotos, conteos inválidos, hashes incorrectos y resúmenes inconsistentes antes del despliegue.

Resultados de aceptación y alcance: [docs/VALIDACION_1.0A.md](docs/VALIDACION_1.0A.md).
