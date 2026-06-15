import requests
import sys

BASE_URL = "http://localhost:8000/api"

print("--- INICIANDO BATERIA DE PRUEBAS FASES 5, 6 y 7 ---")
try:
    # 1. Login
    print("[*] Autenticando usuario de pruebas...")
    resp = requests.post(f"{BASE_URL}/login", json={"username": "qatest2", "password": "123"})
    if resp.status_code != 200:
        print("FAIL: No se pudo hacer login. Verifica que qatest2 existe.")
        # Creamos usuario si no existe
        requests.post(f"{BASE_URL}/register", json={"username": "qatest2", "password": "123"})
        resp = requests.post(f"{BASE_URL}/login", json={"username": "qatest2", "password": "123"})
        if resp.status_code != 200:
            sys.exit(1)
            
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("PASS: Login exitoso.")

    # 2. Negocio
    resp = requests.get(f"{BASE_URL}/businesses", headers=headers)
    businesses = resp.json()
    if not businesses:
        resp = requests.post(f"{BASE_URL}/businesses", json={"name": "QA Business 567", "legal_id": "111"}, headers=headers)
        b_id = resp.json()["id"]
    else:
        b_id = businesses[0]["id"]
    print(f"PASS: Usando Negocio ID {b_id}")

    # ================= FASE 5: PRODUCTOS =================
    print("\n--- FASE 5: INVENTARIOS ---")
    prod_data = {
        "business_id": b_id,
        "name": "Servicio de QA Automático",
        "price": 15000,
        "iva_rate": 13,
        "stock": 99
    }
    resp = requests.post(f"{BASE_URL}/products", json=prod_data, headers=headers)
    if resp.status_code != 200:
        print("FAIL: No se pudo crear el producto.", resp.text)
        sys.exit(1)
    
    prod_id = resp.json()["id"]
    print("PASS: Producto creado exitosamente. ID:", prod_id)

    # Actualizar producto
    resp = requests.put(f"{BASE_URL}/products/{prod_id}", json={"price": 18000}, headers=headers)
    if resp.status_code != 200:
        print("FAIL: No se pudo actualizar producto.")
        sys.exit(1)
    print("PASS: Producto actualizado correctamente.")

    # Obtener productos
    resp = requests.get(f"{BASE_URL}/products?business_id={b_id}", headers=headers)
    products = resp.json()
    if len(products) == 0 or products[-1]["price"] != 18000:
        print("FAIL: Verificación de producto falló.")
        sys.exit(1)
    print("PASS: Listado y verificación de inventario correcto.")

    # ================= FASE 6: RECURRENTES =================
    print("\n--- FASE 6: GASTOS RECURRENTES ---")
    rec_data = {
        "business_id": b_id,
        "category": "Software",
        "description": "Licencia AWS",
        "amount": 25000,
        "day_of_month": 1 # Forzar cobro el dia 1
    }
    resp = requests.post(f"{BASE_URL}/recurring_expenses", json=rec_data, headers=headers)
    if resp.status_code != 200:
        print("FAIL: No se pudo crear el gasto recurrente.", resp.text)
        sys.exit(1)
    rec_id = resp.json()["id"]
    print("PASS: Gasto recurrente creado.")

    # Disparar motor de inyección
    print("Disparando motor automático de cobro (Process Recurring)...")
    resp = requests.post(f"{BASE_URL}/recurring_expenses/process?business_id={b_id}", headers=headers)
    if resp.status_code != 200:
        print("FAIL: Error al procesar motor recurrente.", resp.text)
        sys.exit(1)
    
    injected = resp.json().get("injected", 0)
    print(f"PASS: Motor ejecutado. Transacciones inyectadas: {injected}")

    # ================= FASE 7: EMPLEADOS =================
    print("\n--- FASE 7: NOMINA Y PLANILLAS ---")
    emp_data = {
        "business_id": b_id,
        "name": "QA Tester Bot",
        "identification": "bot-01",
        "base_salary": 350000
    }
    resp = requests.post(f"{BASE_URL}/employees", json=emp_data, headers=headers)
    if resp.status_code != 200:
        print("FAIL: Error al registrar empleado.", resp.text)
        sys.exit(1)
    emp_id = resp.json()["id"]
    print("PASS: Empleado registrado.")

    # Pagar empleado
    pay_data = {
        "amount": 350000,
        "description": "Salario Mes Prueba"
    }
    resp = requests.post(f"{BASE_URL}/employees/{emp_id}/pay", json=pay_data, headers=headers)
    if resp.status_code != 200:
        print("FAIL: Error al pagar empleado.", resp.text)
        sys.exit(1)
    print("PASS: Salario procesado y registrado en contabilidad.")

    print("\n--- ¡TODAS LAS FASES COMPLETADAS CON ÉXITO! ---")
except Exception as e:
    print(f"ERROR: {str(e)}")
    sys.exit(1)
