# Serruchito Finanzas

App para seguir tu cartera de inversiones (Cocos, Balanz, IOL, Interactive Brokers) en pesos y dólares, con precios actualizados.

La app corre en tu compu: no necesitás crear cuentas y tus datos no salen de la máquina.

Para instalarla hay dos caminos. Elegí uno.

---

## Opción A: que lo instale Claude por vos

Necesitás un asistente que pueda ejecutar cosas en tu compu. Sirven:

- la app de escritorio de Claude, en la pestaña **Code**;
- Claude Code;
- otro asistente similar (Cursor, Codex, etc.).

El chat común de claude.ai en el navegador **no** sirve para esto: puede explicarte los pasos, pero no ejecutarlos.

1. Abrí el asistente y elegí una carpeta donde quieras guardar la app (por ejemplo, Documentos).
2. Copiá y pegá este mensaje:

   > Quiero instalar y abrir en mi compu la app de https://github.com/guillotambo/serruchito-finanzas. No sé programar: hacé vos todos los pasos siguiendo la sección "Instrucciones para asistentes de IA" del README, y avisame cuando la pueda usar en el navegador.

3. Aceptá los permisos que te pida. Cuando termine, la app queda abierta en **http://localhost:3000**.

Después, para abrirla otras veces, no hace falta el asistente: usá el doble clic de la Opción B, paso 3.

---

## Opción B: paso a paso

### 1. Instalá Node.js (una sola vez)

Entrá a https://nodejs.org/es/download, bajá la versión **LTS** e instalala con las opciones que vienen por defecto.

### 2. Descargá la app (una sola vez)

1. En https://github.com/guillotambo/serruchito-finanzas, tocá el botón verde **Code** y después **Download ZIP**.
2. Descomprimí el zip en un lugar donde no lo vayas a borrar (por ejemplo, Documentos).

### 3. Abrí la app (cada vez que la quieras usar)

- **Mac**: doble clic en `Iniciar.command`.
  - La primera vez, macOS puede decir que no puede verificar el archivo. Si pasa, hacé **clic derecho → Abrir → Abrir**. Después ya funciona con doble clic.
  - Si dice que no tenés permiso para ejecutarlo, abrí la app **Terminal**, escribí `chmod +x ` (con un espacio al final), arrastrá el archivo `Iniciar.command` a la ventana y apretá Enter.
- **Windows**: doble clic en `Iniciar.bat`.
  - Si aparece "Windows protegió su PC", tocá **Más información → Ejecutar de todas formas**.

La primera vez tarda unos minutos porque instala todo. Después arranca en segundos.

Se abre una ventana negra (no la cierres mientras usás la app) y el navegador en **http://localhost:3000**.

Para cerrar la app, cerrá esa ventana negra.

---

## Cargar tus movimientos

La app arranca vacía. Tenés dos formas de cargar lo tuyo:

- **De a uno**: en **Movimientos**, cargá cada compra o venta con el formulario.
- **Todo de una vez con una planilla**:
  1. Andá a **Ajustes → Importar movimientos** y descargá la plantilla.
  2. Abrila con Excel o Google Sheets, borrá las filas de ejemplo y cargá una fila por operación:

     | Columna | Qué poner | Ejemplo |
     |---|---|---|
     | Fecha | `dd/mm/aaaa` | 15/01/2026 |
     | Broker | Cocos, Balanz, IOL o IBKR | Cocos |
     | Operación | Compra o Venta | Compra |
     | Ticker | El símbolo del activo | SPY, GGAL, AL30 |
     | Tipo *(opcional)* | CEDEAR, Acción AR, Acción US, ETF, Bono u Otro. Si lo dejás vacío, la app intenta deducirlo | CEDEAR |
     | Cantidad | Cuántos compraste o vendiste | 10 |
     | Precio | Precio **por unidad**. Usá coma para los decimales | 40.000,50 |
     | Moneda *(opcional)* | ARS o USD | ARS |
     | Comisión *(opcional)* | Lo que te cobraron | 120 |
     | Notas *(opcional)* | Lo que quieras | |

  3. Guardala como **CSV**:
     - En Excel: Archivo → Guardar como → "CSV UTF-8".
     - En Google Sheets: Archivo → Descargar → CSV.
  4. Subila en la misma pantalla. Te muestra una vista previa. Si alguna fila tiene un error, te dice cuál es: la corregís en la planilla y la volvés a subir.

También podés cargar **dividendos** y **saldos en efectivo** desde **Movimientos**.

## Tus datos

- Todo queda guardado en la carpeta `web/data`, dentro de la carpeta de la app.
- **Backup**: cerrá la app y copiá la carpeta `web/data` a otro lado (un pendrive, Drive, etc.).
- Si borrás esa carpeta, la app arranca vacía de nuevo.
- La evolución del patrimonio se guarda una vez por día cuando abrís la app. Si no la abrís algún día, ese día no aparece en el gráfico.

## Problemas comunes

- **"Falta instalar Node.js"**: instalalo (Opción B, paso 1) y volvé a abrir Iniciar.
- **El navegador dice que no puede conectarse**: esperá unos segundos y recargá la página. La primera vez tarda más.
- **"Port 3000 is in use"**: ya tenés la app abierta en otra ventana negra. Usá esa, o cerrala y volvé a abrir.
- **Cualquier otro error**: copiá el mensaje de la ventana negra y pegáselo a Claude junto con el link de este repo.

---

## Instrucciones para asistentes de IA

Esta sección es para el asistente (Claude u otro) que ayuda a instalar la app. **El usuario no es técnico.** Hacé los pasos vos y no le pidas que edite archivos ni que corra comandos.

1. **Node.js**: se necesita la versión 20.9 o mayor (`node -v`).
   - Si no está, instalalo con el gestor del sistema:
     - Mac: `brew install node`, si hay Homebrew.
     - Windows: `winget install OpenJS.NodeJS.LTS`.
   - Si no podés, pedile al usuario que lo instale desde https://nodejs.org/es/download (versión LTS) y esperá a que confirme.
2. **Código**: si hay `git`, clonalo con `git clone https://github.com/guillotambo/serruchito-finanzas.git` en la carpeta que eligió el usuario. Si no hay `git`, descargá y descomprimí `https://github.com/guillotambo/serruchito-finanzas/archive/refs/heads/main.zip`.
3. **Dependencias**: dentro de la carpeta del repo, corré `npm install`.
4. **Build**: corré `npm run build -w web`.
5. **Arranque**: corré `npm start -w web` en segundo plano. Queda en http://localhost:3000; si ese puerto está ocupado, usá `PORT=3001 npm start -w web`. Verificá que responda y abrilo en el navegador del usuario.
6. **No configures base de datos.** Sin `DATABASE_URL`, la app usa Postgres embebido (PGlite) en `web/data/pgdata` y crea el esquema sola. **No crees `web/.env.local`**, salvo que el usuario pida explícitamente usar Supabase.
7. **Cierre**: al terminar, explicale al usuario en castellano simple:
   - que para abrir la app otras veces le alcanza con doble clic en `Iniciar.command` (Mac) o `Iniciar.bat` (Windows), en la carpeta del repo. En Mac, si el archivo no tiene permiso de ejecución, corré `chmod +x Iniciar.command`;
   - cómo cargar movimientos (sección "Cargar tus movimientos").
8. **Actualizar**: si pide actualizar a una versión nueva:
   1. hacé backup de `web/data`;
   2. corré `git pull` (o volvé a descargar el zip conservando `web/data`);
   3. corré `npm install`;
   4. borrá `web/.next`;
   5. corré `npm run build -w web`.

   Nunca borres `web/data`: ahí están los datos del usuario.

---

## Para quien sepa programar

- Es un monorepo npm: `web/` es Next.js y `packages/core` tiene la lógica compartida.
- **Base de datos**: sin `DATABASE_URL`, la app usa Postgres embebido (PGlite) en `web/data/pgdata`. Con `DATABASE_URL` en `web/.env.local` usa ese Postgres, por ejemplo Supabase (ver `web/.env.local.example`).
- **Comandos**:
  - `npm install` y después `npm run dev -w web` (desarrollo).
  - `npm run local` (build y start).
  - `npm test -w web` (tests).
- **Precios**: salen de fuentes públicas sin API key (data912, Yahoo Finance, dolarapi).
