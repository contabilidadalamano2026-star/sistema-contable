import os
import sys
import multiprocessing
import uvicorn
import subprocess
import time
import socket

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def run_uvicorn():
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000)

def run_localtunnel():
    time.sleep(3) # Esperar a que Uvicorn levante
    print("\nCreando túnel seguro de Internet (Localtunnel)...")
    
    # Agregar Node.js al PATH temporalmente
    env = os.environ.copy()
    env["PATH"] = r"C:\Program Files\nodejs;" + env.get("PATH", "")
    
    cmd = ["npx.cmd", "localtunnel", "--port", "8000", "--subdomain", "sistemacontablecr2026"]
    
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
        for line in iter(process.stdout.readline, ''):
            if "your url is:" in line:
                url = line.strip().split("your url is: ")[1]
                print("\n===================================================")
                print("🌍 TU APLICACIÓN ESTÁ ONLINE 🌍")
                print(f"👉 Enlace: {url}")
                print("\n⚠ IMPORTANTE: Al abrir este enlace por primera vez en tu celular,")
                print("verás una pantalla de seguridad gris. Solo haz clic en")
                print("el botón azul 'Click to Continue' para entrar a tu app.")
                print("===================================================\n")
            elif line.strip():
                print(f"[Túnel]: {line.strip()}")
    except Exception as e:
        print(f"No se pudo iniciar el túnel: {e}")

if __name__ == '__main__':
    print("===================================================")
    print("Iniciando Sistema Contable Integral CR...")
    print("===================================================")
    
    if is_port_in_use(8000):
        print("\n❌ ERROR: El puerto 8000 ya está en uso.")
        print("Parece que ya tienes el sistema abierto en otra ventana negra.")
        print("Por favor, cierra todas las ventanas negras anteriores y vuelve a intentarlo.")
        sys.exit(1)
        
    print("Levantando Base de Datos y Servidor Local...")
    server_proc = multiprocessing.Process(target=run_uvicorn)
    server_proc.start()
    
    tunnel_proc = multiprocessing.Process(target=run_localtunnel)
    tunnel_proc.start()
    
    try:
        server_proc.join()
        tunnel_proc.join()
    except KeyboardInterrupt:
        print("\nApagando sistema...")
        server_proc.terminate()
        tunnel_proc.terminate()
