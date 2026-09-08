# TABLEROS_RES · Responsys

Prototipo funcional de tablero Responsys construido para publicar en **GitHub Pages**.

## Arquitectura

`Google Sheets → Python ETL → JSON compacto → React/Vite → GitHub Pages`

- **Fuente viva:** `Invetario_Responsys_2.0`
- **Spreadsheet ID:** `1widnx3vomsT6j0Z3jpfh7IASwNd-Bix_lBXgp2tdVVQ`
- **Fuente temporal:** `Sent Date` (no `Año_Evento` cuando hay discrepancia)
- **Cruce:** estadísticas → `Campañas Vigentes` por nombre normalizado; estadísticas → `Folders Vigentes` por folder normalizado.
- Las inconsistencias de cruce **no se eliminan**: quedan visibles en el panel de calidad.
- Las tasas del tablero se recalculan con conteos base para evitar inconsistencias de formato en las columnas de rate de las hojas.

## Funcionalidad del prototipo

- Filtros por rango de fecha, propósito, folder, programa, tipo, estado y campaña.
- Filtro específico de calidad de cruce.
- KPIs recalculados con los filtros activos.
- Evolución temporal adaptable (día/mes según ventana).
- Top campañas, folders y propósito.
- Tabla paginada y exportación CSV.
- Panel de control de calidad y registros no cruzados.
- Layout responsive para PC, portátil, tablet y móvil.
- 32k+ filas históricas son procesadas una vez en Python y servidas como JSON estático comprimible por GitHub Pages/CDN.

## Ejecutar con el snapshot local

```bash
python backend/scripts/sync_responsys.py \
  --source xlsx \
  --xlsx /ruta/Invetario_Responsys_2.0.xlsx \
  --output frontend/public/data/dashboard.json

cd frontend
npm install
npm run dev
```

## Conectar la Sheet viva

1. Crear un Service Account en Google Cloud y habilitar Google Sheets API.
2. Compartir `Invetario_Responsys_2.0` con el correo del Service Account como **lector**.
3. En GitHub → Settings → Secrets and variables → Actions, crear:
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: JSON completo de credenciales del Service Account.
4. En GitHub → Settings → Pages, seleccionar **GitHub Actions** como fuente.
5. El workflow `.github/workflows/deploy-pages.yml` sincroniza la Sheet **cada hora** y vuelve a publicar el sitio.

URL esperada del proyecto:

`https://nr-etb.github.io/TABLEROS_RES/`

## Docker local

Copiar `.env.example` a `.env`, definir el archivo local de credenciales y ejecutar:

```bash
docker compose up
```

El tablero queda disponible en `http://localhost:5173`.

## Seguridad

- No subir `google-service-account.json` al repositorio.
- Las credenciales solo viven en GitHub Secrets / secretos del entorno.
- React nunca consulta Google Sheets directamente ni recibe credenciales.

## Definiciones de indicadores

- **Entrega calculada:** `(Envios - Soft Bounces - Hard Bounces) / Envios`
- **Unique opens / envíos:** `Unique Opens / Envios`
- **Unique clicks / envíos:** `Unique Clicks / Envios`
- **Rebote / envíos:** `(Soft Bounces + Hard Bounces) / Envios`

Estas definiciones están etiquetadas explícitamente para no confundirlas con los campos `Open Rate`, `Click-Through Rate` u otros rates preformateados del origen.
