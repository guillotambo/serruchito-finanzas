@echo off
rem Doble clic para abrir Serruchito Finanzas (Windows).
rem La primera vez tarda unos minutos (instala y prepara la app).
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo === Serruchito Finanzas ===
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Falta instalar Node.js.
  echo Se va a abrir la pagina de descarga: baja la version LTS, instalala
  echo y despues volve a hacer doble clic en Iniciar.
  start "" "https://nodejs.org/es/download"
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando ^(solo la primera vez, puede tardar unos minutos^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Fallo la instalacion.
    pause
    exit /b 1
  )
)

if not exist web\.next\BUILD_ID (
  echo Preparando la app ^(solo la primera vez^)...
  call npm run build -w web
  if errorlevel 1 (
    echo Fallo la preparacion.
    pause
    exit /b 1
  )
)

echo.
echo Listo. La app se abre en el navegador: http://localhost:3000
echo Para cerrarla, cerra esta ventana.
echo.

start "" cmd /c "timeout /t 4 >nul & start http://localhost:3000"
call npm start -w web
pause
