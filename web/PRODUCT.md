# Product

## Register

product

## Users

Uso personal, en sesiones cortas y frecuentes (diarias o semanales) para revisar el estado de su portafolio de inversiones: posiciones, dividendos, transacciones y evolución del patrimonio. No hay otros usuarios ni onboarding que resolver. El contexto de uso prioriza lectura rápida de números (¿cómo estoy hoy?) sobre exploración prolongada.

## Product Purpose

Dashboard de finanzas personales para seguir un portafolio de inversiones multi-broker (IBKR, Cocos, Balanz, IOL) en ARS/USD: posiciones, P&L realizado y no realizado, dividendos, movimientos del día e historial de patrimonio. Éxito es poder responder en segundos "¿cómo está mi plata hoy y qué cambió" sin fricción ni ruido visual.

## Brand Personality

Nítida y con carácter: minimalista como base, pero no genérica — con un acento de color propio y atención a tipografía, jerarquía y micro-detalles de motion que la hagan sentir diseñada a medida, no un template. Tono calmo y preciso, sin urgencia artificial ni gamificación.

## Anti-references

- Dashboard SaaS genérico: cards idénticas repetidas, gradientes decorativos, eyebrows en mayúscula sobre cada sección, métrica hero con gradient text, glassmorphism decorativo.
- App bancaria corporativa fría: azul-y-gris soso, tablas densas sin jerarquía visual, exceso de bordes y contenedores anidados.

## Design Principles

- Los números primero: cualquier decisión de layout o color debe hacer más rápida la lectura de las cifras clave, no competir con ellas.
- Un acento, no una paleta de marketing: el color se usa con intención (status, series de datos, un acento de marca), nunca decorativo.
- Calma con carácter: sobriedad tipográfica y de layout, pero con detalles deliberados (tipografía, spacing, motion sutil) que eviten la sensación de plantilla genérica.
- Consistencia con la paleta de datos: los colores de UI y los de gráficos (`--series-*`, `--status-*` en `globals.css`) hablan el mismo idioma; no se introducen paletas nuevas para la interfaz.
- Sin fricción para una sesión corta: layout escaneable de un vistazo, sin pasos ni interacciones innecesarias para llegar al dato.

## Accessibility & Inclusion

Estándar: contraste AA (≥4.5:1 en texto de cuerpo, ≥3:1 en texto grande), soporte de `prefers-reduced-motion` en toda animación. Sin requisitos adicionales más allá de eso.
