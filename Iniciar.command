#!/bin/bash
# Doble clic para abrir Serruchito Finanzas (Mac).
# La primera vez tarda unos minutos (instala y prepara la app).

cd "$(dirname "$0")" || exit 1

echo ""
echo "=== Serruchito Finanzas ==="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Falta instalar Node.js."
  echo "Se va a abrir la página de descarga: bajá la versión LTS, instalala"
  echo "y después volvé a hacer doble clic en Iniciar."
  open "https://nodejs.org/es/download"
  read -r -p "Apretá Enter para cerrar..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Instalando (solo la primera vez, puede tardar unos minutos)..."
  npm install --no-audit --no-fund || { read -r -p "Falló la instalación. Apretá Enter para cerrar..."; exit 1; }
fi

if [ ! -f web/.next/BUILD_ID ]; then
  echo "Preparando la app (solo la primera vez)..."
  npm run build -w web || { read -r -p "Falló la preparación. Apretá Enter para cerrar..."; exit 1; }
fi

echo ""
echo "Listo. La app se abre en el navegador: http://localhost:3000"
echo "Para cerrarla, cerrá esta ventana."
echo ""

(sleep 3 && open "http://localhost:3000") &
npm start -w web
