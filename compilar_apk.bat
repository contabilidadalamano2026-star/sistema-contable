@echo off
echo ===================================================
echo Compilador Oficial: Sistema Contable a APK (Android)
echo ===================================================
echo NOTA: La primera vez que ejecutes esto, el sistema descargara el SDK de Android
echo y te pedira que aceptes los terminos de licencia (escribe "y" y presiona Enter).
echo.
echo ADVERTENCIA SOBRE LA URL:
echo Te pedira la URL de tu aplicacion. Si usas la URL temporal de Ngrok, 
echo tu App dejara de funcionar cuando apagues la computadora. 
echo Para una App de Google Play, asegurate de tener un dominio permanente.
echo.
pause

set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%

cd /d "%~dp0"
if not exist "android_build" mkdir "android_build"
cd android_build

call "C:\Program Files\nodejs\npx.cmd" @bubblewrap/cli init
call "C:\Program Files\nodejs\npx.cmd" @bubblewrap/cli build

echo.
echo ===================================================
echo Proceso finalizado. Si todo salio bien, tu APK estara en la carpeta android_build
echo ===================================================
pause
