@echo off
rem Windows: cift tikla. Ilk acilista gerekli parcalari indirir, sonra uygulamayi acar.
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi. https://nodejs.org adresinden kur, sonra bu dosyaya yeniden cift tikla.
  pause
  exit /b 1
)
if not exist node_modules\electron (
  echo Ilk acilis: parcalar indiriliyor, birkac dakika surebilir.
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm start
