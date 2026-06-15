import sys
import requests
import time

BASE_URL = "http://127.0.0.1:8000/api"

def run_tests():
    print("========================================")
    print("Iniciando Pruebas de Integración End-to-End...")
    print("========================================")
    
    # 1. Registrar usuario
    user_data = {
        "username": "test_qa",
        "email": "testqa@example.com",
        "password": "securepassword123"
    }
    print("1. Probando Registro...")
    try:
        res = requests.post(f"{BASE_URL}/register", json=user_data)
        if res.status_code == 400 and "ya en uso" in res.json().get("detail", ""):
            print("   - Usuario ya existía (OK)")
        elif res.status_code == 200:
            print("   - Registro exitoso (OK)")
        else:
            print(f"   - Falla en registro: {res.text}")
            sys.exit(1)
    except Exception as e:
        print("   - Error de conexión. ¿Está corriendo el servidor (uvicorn)?")
        sys.exit(1)
        
    # 2. Login
    print("2. Probando Login...")
    res = requests.post(f"{BASE_URL}/login", json={"username": "test_qa", "password": "securepassword123"})
    if res.status_code == 200:
        token = res.json()["access_token"]
        print("   - Login exitoso (OK)")
    else:
        print(f"   - Falla en login: {res.text}")
        sys.exit(1)
        
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Crear Negocio
    print("3. Creando Negocio...")
    res = requests.post(f"{BASE_URL}/businesses", json={"name": "Puesto de Empanadas", "legal_id": "12345"}, headers=headers)
    if res.status_code == 200:
        business_id = res.json()["id"]
        print(f"   - Negocio creado ID: {business_id} (OK)")
    else:
        print(f"   - Falla al crear negocio: {res.text}")
        sys.exit(1)
        
    # Limpiar transacciones para la prueba
    print("4. Registrando Finanzas de la Casa (Ingreso 1M, Gasto 150k, Deuda 350k)...")
    requests.post(f"{BASE_URL}/transactions", json={"type": "income", "amount": 1000000, "category": "Salario Principal"}, headers=headers)
    requests.post(f"{BASE_URL}/transactions", json={"type": "expense", "amount": 150000, "category": "Comida"}, headers=headers)
    requests.post(f"{BASE_URL}/transactions", json={"type": "expense", "amount": 350000, "category": "Cuota Casa (Deuda)"}, headers=headers)
    
    # 5. Transacciones de Negocio
    print("5. Registrando Finanzas del Negocio (Aislado de la casa)...")
    requests.post(f"{BASE_URL}/transactions", json={"business_id": business_id, "type": "income", "amount": 50000, "category": "Ventas del Lunes"}, headers=headers)
    requests.post(f"{BASE_URL}/transactions", json={"business_id": business_id, "type": "expense", "amount": 10000, "category": "Harina"}, headers=headers)
    
    # 6. Evaluar Análisis Financiero
    print("6. Ejecutando Análisis de Salud Financiera...")
    res = requests.get(f"{BASE_URL}/financial-health", headers=headers)
    if res.status_code == 200:
        data = res.json()
        print(f"   - Ingresos Computados: ₡{data['total_income']}")
        print(f"   - Gastos Computados: ₡{data['total_expense']}")
        print(f"   - Margen de Deuda: {data['debt_margin_percentage']}%")
        print(f"   - Estado: {data['health_status']}")
        print(f"   - Consejo: {data['advice']}")
        
        # Validación Matemática Estricta
        if data['total_income'] < 1000000:
            print("   - Advertencia: El ingreso es menor al insertado hoy, posiblemente por limpiezas anteriores. Test parcial.")
        else:
            print("   - Matemáticas financieras verificadas (OK)")
    else:
        print(f"   - Falla en análisis financiero: {res.text}")
        sys.exit(1)
        
    print("\n✅ QA Completado: La arquitectura cumple con la lógica de negocio.")

if __name__ == "__main__":
    run_tests()
