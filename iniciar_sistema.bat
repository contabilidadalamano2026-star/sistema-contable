@echo off
echo ===================================================
echo Iniciando Sistema Contable Integral CR (Version Global)
echo ===================================================
echo Activando entorno...

cd /d "%~dp0"
call venv\Scripts\activate.bat

python run_server.py
pause
