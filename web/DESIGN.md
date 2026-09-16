---
name: Serruchito Finanzas
description: Dashboard financiero personal con acento terracota, tokens de dato compartidos y densidad calma.
colors:
  surface-page: "#f9f9f7"
  surface-1: "#fcfcfb"
  text-primary: "#0b0b0b"
  text-secondary: "#52514e"
  text-muted: "#6f6d63"
  gridline: "#e1e0d9"
  axis: "#c3c2b7"
  status-good: "#0ca30c"
  status-critical: "#d03b3b"
  status-warning: "#fab219"
  series-1-ibkr: "#2a78d6"
  series-2-cocos: "#1baf7a"
  series-3-balanz: "#eda100"
  series-4-iol: "#4a3aa7"
  series-5-reserved: "#e34948"
  accent: "#b5502e"
  accent-strong: "#9c4325"
  accent-on: "#ffffff"
typography:
  body:
    fontFamily: "Geist, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.05em"
  title:
    fontFamily: "Geist, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  data-mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-on}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.accent-on}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  stat-tile:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Serruchito Finanzas

## 1. Overview

**Creative North Star: "El Balance Nítido"**

Serruchito Finanzas es un estado de cuenta, no una vidriera: cada número tiene un lugar fijo, un solo acento marca lo que requiere atención o acción, y todo lo demás se queda quieto para no competir con la cifra. La superficie es neutra y clara, los datos hablan con la misma paleta categórica en tablas y en gráficos, y el carácter del sistema no viene de decoración sino de precisión: tipografía tabular en las cifras, jerarquía sobria, micro-detalles deliberados en spacing y motion.

Este sistema rechaza explícitamente el dashboard SaaS genérico — cards idénticas repetidas, gradientes decorativos, eyebrows en mayúscula sobre cada sección, métricas hero con gradient text, glassmorphism decorativo — y la app bancaria corporativa fría — azul-y-gris soso, tablas densas sin jerarquía, exceso de bordes y contenedores anidados. Ninguno de los dos polos es el objetivo: el objetivo es calma con carácter.

**Key Characteristics:**
- Un acento (terracota) reservado para acción primaria, foco y selección; nunca decorativo.
- Paleta categórica de datos (`--series-*`) fija y compartida entre UI y gráficos, nunca reasignada por ranking.
- Superficies planas por defecto; la jerarquía se transmite por color, borde y tipografía, no por sombra.
- Cifras siempre en `tabular-nums`, tinte de fila (no badges) para comunicar signo de P&L.
- Un acento de sombra sutil reservado exclusivamente para estados de foco/hover en elementos interactivos — nunca decorativo, nunca en reposo.

## 2. Colors

Paleta restringida: neutros cálidos casi acromáticos + un acento cálido de baja saturación + una paleta categórica de datos de 5 colores fija. Nada de gradientes ni paletas de marketing.

### Primary
- **Terracota Quemada** (`#b5502e`): el único acento de marca. Botones primarios, selección activa (moneda, tabs, filtros), foco de teclado, franja de item activo en la navegación. Nunca aparece en gráficos ni como color de estado.

### Neutral
- **Superficie Página** (`#f5f1e3`): fondo de página.
- **Superficie Elevada** (`#fbf8ef`): cards, sidebar, header — un tono apenas distinto de la página para separar sin borde pesado.
- **Tinta Primaria** (`#1e1a13`): texto de cifras y títulos.
- **Tinta Secundaria** (`#5c5340`): labels, texto de apoyo.
- **Tinta Muted** (`#8a7f68`): sublabels, columnas inactivas — verificado ≥4.5:1 de contraste sobre la superficie.
- **Línea de Grilla** (`#e6dfc7`): separadores de tabla, ejes de chart, fondo de pills inactivas.

### Data / Status (paleta categórica compartida con gráficos)
- **Estado Bueno** (`#0ca30c`), **Estado Crítico** (`#d03b3b`), **Estado Alerta** (`#fab219`): exclusivos para señalar signo/salud del dato, nunca decorativos.
- **Serie 1 · Azul IBKR** (`#2a78d6`), **Serie 2 · Aqua Cocos** (`#1baf7a`), **Serie 3 · Amarillo Balanz** (`#eda100`), **Serie 4 · Violeta IOL** (`#4a3aa7`), **Serie 5 · Rojo reservado** (`#e34948`): orden fijo, mapeo por broker/categoría, nunca por ranking.

### Named Rules
**La Regla del Acento Único.** El terracota aparece solo en acción primaria, foco y selección activa. Si un elemento no es clickeable ni está seleccionado, no lleva terracota.

**La Regla de No Reasignar.** Los colores de `--series-*` y `--status-*` están atados a una entidad (broker, signo de P&L) para siempre dentro de una sesión de datos; nunca se ciclan ni se reasignan por posición en una lista.

## 3. Typography

**Body/Display Font:** Geist (con fallback `system-ui, -apple-system, "Segoe UI", sans-serif`)
**Data/Mono Font:** Geist Mono (con fallback `ui-monospace, monospace`)

**Character:** Una sola familia sans para todo — títulos, labels, cuerpo — más una mono reservada exclusivamente para cifras que necesitan alineación de dígitos (`tabular-nums` ya cubre la mayoría de los casos sin cambiar de familia). No hay pareja display/body: en un dashboard de uso diario, una tipografía bien ajustada en varios pesos alcanza, y una segunda familia solo agregaría ruido.

### Hierarchy
- **Title** (600, 20px, 1.3): título de página / sección (`<h1>`, `<h2>`).
- **Body** (400, 14px, 1.5): texto de tabla, párrafos, copy de estado vacío/error.
- **Label** (500, 11px, 1.3, tracking 0.05em): sub-etiquetas cortas ("FINANZAS" en el logo, headers de columna de tabla).
- **Data (tabular)**: cualquier cifra monetaria o porcentual lleva `font-variant-numeric: tabular-nums` (clase `.tabular-nums`), independientemente de su tamaño, para que las columnas de números alineen dígito a dígito.

### Named Rules
**La Regla de los Dígitos Alineados.** Toda cifra (ARS, USD, %, cantidad) usa `tabular-nums`. Sin excepciones, ni en stat tiles ni en tablas ni en charts.

**La Regla de una Sola Familia.** No se introduce una segunda familia sans "para variar"; el carácter tipográfico se construye con peso, tamaño y tracking dentro de Geist, no con más fuentes.

## 4. Elevation

El sistema es plano por defecto: la jerarquía se transmite con `--surface-1` vs `--surface-page`, bordes de 1px en `--border`, y tinte de fondo — nunca con `box-shadow` en reposo. La única sombra permitida en el sistema es una elevación ambient muy sutil, reservada para el momento de foco/hover de un elemento interactivo (card clickeable, fila accionable), nunca visible en estado de reposo ni en elementos puramente informativos.

### Shadow Vocabulary
- **Foco Ambient** (`box-shadow: 0 2px 8px rgba(0,0,0,0.08)`): se activa solo en `:hover`/`:focus-visible` de superficies interactivas (ej. una card completa que navega, no un botón que ya tiene su propio estado de color). No se aplica a `StatTile`, `ErrorState` ni ningún contenedor de solo lectura.

### Named Rules
**La Regla de la Sombra Ganada.** Ninguna sombra existe en reposo. Una sombra solo aparece como respuesta directa a una interacción real (hover/focus de algo clickeable) y desaparece cuando la interacción termina.

## 5. Components

### Buttons
- **Shape:** radio chico (6px, `rounded-md` de Tailwind), nunca `rounded-full` salvo pills/toggles explícitos.
- **Primary:** fondo Terracota Quemada, texto `--accent-on`, padding `6px 12px`, `font-medium text-sm`.
- **Hover / Focus:** el hover pasa a `--accent-strong` (ya definido en tokens, hoy sin usar en el código — ver Do's/Don'ts); el foco usa el anillo global `outline: 2px solid var(--accent)` con `outline-offset: 2px`. Press: `active:scale-[0.96]` con transición corta.
- **Secondary / Ghost:** fondo transparente, borde `1px solid var(--border)`, texto `--text-primary` (ej. botón "Reintentar" de `ErrorState`).

### Pills / Chips (toggles de filtro, moneda, rango)
- **Style:** `rounded-full`, fondo `--gridline` en estado inactivo/contenedor, texto `--text-secondary`; estado activo pasa fondo a `--accent` y texto a `--accent-on` (ej. `CurrencyToggle`) o borde+texto a `--accent` sin llenar el fondo (ej. `BrokerFilter`).
- **State:** el activo se distingue por color de fondo/borde, nunca por peso de fuente únicamente.

### Cards / Containers (StatTile y similares)
- **Corner Style:** 8px (`rounded-lg`).
- **Background:** `--surface-1` sobre `--surface-page`, distinguible sin sombra.
- **Shadow Strategy:** ninguna en reposo (ver Elevation); si el card se vuelve clickeable, aplica Foco Ambient solo en hover/focus.
- **Border:** `1px solid var(--border)`.
- **Internal Padding:** 16px (`p-4`).

### Inputs / Fields
- **Style:** fondo `--surface-1`, borde `1px solid var(--border)`, radio 6px.
- **Focus:** anillo de foco global (`outline: 2px solid var(--accent)`), sin glow ni cambio de fondo.
- **Error:** hoy solo un string genérico bajo el form; el sistema no tiene aún un tratamiento de `aria-invalid` por campo (gap conocido, no doctrina).

### Navigation (Sidebar)
- **Style:** columna fija (240px expandida / 72px colapsada), fondo `--surface-1`, borde derecho `--border`.
- **Item activo:** franja de 2px en `--accent` sobre el borde izquierdo del item + fondo `color-mix(accent 10%, transparent)` + texto `--text-primary`; inactivo en `--text-secondary` sobre fondo transparente.
- **Mobile:** drawer con overlay `bg-black/40`, mismo contenido que desktop expandido.

### Data Table Row Tint (componente de firma)
En vez de badges de color para P&L, la fila entera de una posición o transacción se tiñe al 5% de opacidad del color de estado (`--status-good`/`--status-critical`) según el signo del resultado. Es la forma primaria de comunicar ganancia/pérdida en el sistema — silenciosa, nunca alarmante, coherente con "calma con carácter".

## 6. Do's and Don'ts

### Do:
- **Do** usar `tabular-nums` en toda cifra monetaria o porcentual, sin excepción (La Regla de los Dígitos Alineados).
- **Do** reservar el terracota (`--accent`/`--accent-strong`) exclusivamente para acción primaria, foco y selección activa.
- **Do** conectar `--accent-strong` a los estados hover/active de todo elemento interactivo — hoy está definido y sin usar; es la brecha de pulido visual más señalada por la crítica de este proyecto.
- **Do** dar a todo componente interactivo su vocabulario completo de estados (default, hover, focus, active, disabled) antes de darlo por terminado.
- **Do** envolver toda animación/transición (incluyendo `transition-[width]` del sidebar y `active:scale` de botones) en `prefers-reduced-motion: reduce`, no solo el skeleton.
- **Do** usar tinte de fila al 5% de opacidad para comunicar signo de P&L, no badges de colores.

### Don't:
- **Don't** usar cards idénticas repetidas, gradientes decorativos, eyebrows en mayúscula sobre cada sección, métrica hero con gradient text, ni glassmorphism decorativo (dashboard SaaS genérico, anti-referencia explícita de PRODUCT.md).
- **Don't** usar azul-y-gris soso, tablas densas sin jerarquía visual, ni exceso de bordes/contenedores anidados (app bancaria corporativa fría, anti-referencia explícita de PRODUCT.md).
- **Don't** introducir una sombra en un elemento en reposo; la única sombra del sistema (Foco Ambient) existe solo como respuesta a hover/focus de algo clickeable.
- **Don't** introducir una segunda familia tipográfica; el carácter se construye con peso/tamaño/tracking de Geist, no con más fuentes.
- **Don't** reasignar `--series-*` por ranking o posición; el mapeo por entidad (broker/categoría) es fijo.
- **Don't** usar `border-left`/`border-right` mayor a 1px como acento decorativo en cards o list items (la franja de nav activo es la única excepción deliberada: es indicador de estado funcional de 2px, no decoración).
