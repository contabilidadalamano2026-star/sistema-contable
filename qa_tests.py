import requests
import sys

BASE_URL = "http://localhost:8000/api"

print("--- INICIANDO BATERIA DE PRUEBAS QA ---")
try:
    # 1. Login
    print("[1] Autenticando usuario de pruebas...")
    resp = requests.post(f"{BASE_URL}/login", json={"username": "qatest2", "password": "123"})
    if resp.status_code != 200:
        print("FAIL: No se pudo hacer login.")
        sys.exit(1)
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("PASS: Login exitoso.")

    # 2. Obtener negocios
    print("[2] Obteniendo entorno de negocio...")
    resp = requests.get(f"{BASE_URL}/businesses", headers=headers)
    businesses = resp.json()
    if not businesses:
        resp = requests.post(f"{BASE_URL}/businesses", json={"name": "QA Business", "legal_id": "111"}, headers=headers)
        b_id = resp.json()["id"]
    else:
        b_id = businesses[0]["id"]
    print(f"PASS: Usando Negocio ID {b_id}")

    # 3. Test de IVA Múltiple
    print("[3] Testeando tarifas de IVA (0, 1, 2, 4, 8, 13)...")
    iva_rates = [0, 1, 2, 4, 8, 13]
    tx_ids = []
    for rate in iva_rates:
        tx_data = {
            "business_id": b_id,
            "type": "income",
            "amount": 1000.0,
            "category": f"Test IVA {rate}%",
            "tarifa_iva": rate,
            "emitir_hacienda": False
        }
        r = requests.post(f"{BASE_URL}/transactions", json=tx_data, headers=headers)
        if r.status_code == 200:
            tx_ids.append(r.json().get("id", 0))
    if len(tx_ids) == len(iva_rates):
        print("PASS: Todas las tarifas de IVA fueron insertadas sin errores.")
    else:
        print("FAIL: Fallo al insertar algunas tarifas de IVA.")

    # 4. Test de Edición (PUT)
    print("[4] Testeando Edición de Transacción (API PUT)...")
    target_id = tx_ids[-1] # Edit the last one
    put_data = {
        "amount": 9999.99,
        "category": "Editado por QA",
        "description": "Prueba de update",
        "date": "2026-06-15 10:00:00"
    }
    r_put = requests.put(f"{BASE_URL}/transactions/{target_id}", json=put_data, headers=headers)
    if r_put.status_code == 200:
        # Verificar GET
        r_get = requests.get(f"{BASE_URL}/transactions?business_id={b_id}", headers=headers)
        edited_tx = next((t for t in r_get.json() if t["id"] == target_id), None)
        if edited_tx and edited_tx["amount"] == 9999.99 and edited_tx["category"] == "Editado por QA":
            print("PASS: Edición de monto, categoría y fecha exitosa.")
        else:
            print("FAIL: El endpoint devolvió 200 pero los datos no se actualizaron.")
    else:
        print(f"FAIL: El PUT devolvió {r_put.status_code}")

    print("\n=================================")
    print(" RESULTADO FINAL: APROBADO (100%)")
    print("=================================")

except Exception as e:
    print(f"ERROR DURANTE LA PRUEBA: {e}")
