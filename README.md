# Serruchito Finanzas

App para seguir tu cartera de inversiones (Cocos, Balanz, IOL, Interactive Brokers) en pesos y dólares, con precios actualizados.

La app corre en tu compu: no necesitás crear cuentas y tus datos no salen de la máquina.

## Instalación (una sola vez)

1. **Instalá Node.js**: entrá a https://nodejs.org/es/download, bajá la versión **LTS** e instalala con las opciones que vienen por defecto.
2. **Descomprimí** esta carpeta en un lugar donde no la vayas a borrar (por ejemplo, Documentos).

## Abrir la app

- **Mac**: doble clic en `Iniciar.command`.
  - La primera vez, macOS puede decir que no puede verificar el archivo. En ese caso hacé **clic derecho → Abrir → Abrir**. Después ya funciona con doble clic.
- **Windows**: doble clic en `Iniciar.bat`.
  - Si aparece "Windows protegió su PC", tocá **Más información → Ejecutar de todas formas**.

La primera vez tarda unos minutos porque instala todo. Después arranca en segundos.

Se abre una ventana negra (no la cierres mientras usás la app) y el navegador en **http://localhost:3000**.

Para cerrar la app, cerrá esa ventana negra.

## Cargar tus movimientos

Tenés dos opciones:

- **De a uno**: en **Movimientos**, cargá cada compra o venta con el formulario.
- **Todo de una vez con una planilla**:
  1. Andá a **Ajustes → Importar movimientos** y descargá la plantilla.
  2. Abrila con Excel o Google Sheets, borrá las filas de ejemplo y cargá una fila por operación:
     - **Fecha**: `dd/mm/aaaa`.
     - **Broker**: Cocos, Balanz, IOL o IBKR.
     - **Operación**: Compra o Venta.
     - **Ticker**: por ejemplo SPY, GGAL, AL30.
     - **Tipo** (opcional): CEDEAR, Acción AR, Acción US, ETF, Bono u Otro. Si lo dejás vacío, la app intenta deducirlo.
     - **Cantidad** y **Precio** (por unidad): podés usar coma decimal, por ejemplo `1.234,50`.
     - **Moneda** (opcional): ARS o USD.
     - **Comisión** y **Notas**: opcionales.
  3. Guardala como **CSV**. En Excel: Archivo → Guardar como → "CSV UTF-8" o "CSV (delimitado por comas)". En Google Sheets: Archivo → Descargar → CSV.
  4. Subila en la misma pantalla. Te muestra una vista previa, y si alguna fila tiene un error te dice cuál es para que la corrijas.

También podés cargar **dividendos** y **saldos en efectivo** desde **Movimientos**.

## Tus datos

- Todo queda guardado en la carpeta `web/data` dentro de esta carpeta.
- **Backup**: cerrá la app y copiá la carpeta `web/data` a otro lado (un pendrive, Drive, etc.).
- Si borrás esa carpeta, la app arranca vacía de nuevo.
- La evolución del patrimonio se guarda una vez por día cuando abrís la app. Si no la abrís algún día, ese día no aparece en el gráfico.

## Problemas comunes

- **"Falta instalar Node.js"**: instalalo (paso 1 de la instalación) y volvé a abrir Iniciar.
- **El navegador dice que no puede conectarse**: esperá unos segundos y recargá la página. La primera vez tarda más.
- **"Port 3000 is in use"**: ya tenés la app abierta en otra ventana negra. Usá esa, o cerrala y volvé a abrir.

## Para quien sepa programar

- Es un monorepo npm: `web/` es Next.js y `packages/core` tiene la lógica compartida.
- **Base de datos**: sin `DATABASE_URL`, la app usa Postgres embebido (PGlite) en `web/data/pgdata`. Con `DATABASE_URL` en `web/.env.local` usa ese Postgres, por ejemplo Supabase (ver `web/.env.local.example`).
- **Comandos**:
  - `npm install` y después `npm run dev -w web` (desarrollo).
  - `npm run local` (build y start).
  - `npm test -w web` (tests).
