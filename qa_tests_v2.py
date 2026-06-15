import requests
import time

BASE_URL = "http://127.0.0.1:8001/api"
TOKEN = None
BUSINESS_ID = None

def run_tests():
    global TOKEN, BUSINESS_ID
    print("--- INICIANDO QA TESTS C.A.L.M V2 ---")
    
    # 1. Register
    print("1. Probando Registro...")
    user_id = f"test_user_{int(time.time())}"
    res = requests.post(f"{BASE_URL}/register", json={"id": user_id, "password": "securepassword123"})
    if res.status_code == 200:
        print("✅ Registro Exitoso")
    else:
        print(f"❌ Fallo Registro: {res.text}")
        return

    # 2. Login
    print("2. Probando Login...")
    res = requests.post(f"{BASE_URL}/login", json={"id": user_id, "password": "securepassword123"})
    if res.status_code == 200:
        TOKEN = res.json()["access_token"]
        print("✅ Login Exitoso")
    else:
        print(f"❌ Fallo Login: {res.text}")
        return

    headers = {"Authorization": f"Bearer {TOKEN}"}

    # 3. Create Business
    print("3. Probando Creación de Negocio...")
    res = requests.post(f"{BASE_URL}/businesses", json={"name": "Empresa QA V2"}, headers=headers)
    if res.status_code == 200:
        BUSINESS_ID = res.json()["id"]
        print(f"✅ Negocio Creado Exitosamente (ID: {BUSINESS_ID})")
    else:
        print(f"❌ Fallo Negocio: {res.text}")
        return

    # 4. Create Bank Account
    print("4. Probando Cuenta Bancaria...")
    res = requests.post(f"{BASE_URL}/businesses/{BUSINESS_ID}/bank_accounts", json={"name": "BCR QA", "initial_balance": 100000}, headers=headers)
    if res.status_code == 200:
        acc_id = res.json()["id"]
        print("✅ Cuenta Bancaria Creada Exitosamente")
    else:
        print(f"❌ Fallo Cuenta: {res.text}")
        return

    # 5. Create Transaction
    print("5. Probando Transacciones...")
    tx_data = {
        "type": "income",
        "amount": 50000,
        "category": "Ventas",
        "description": "Venta de prueba QA",
        "account_id": acc_id
    }
    res = requests.post(f"{BASE_URL}/businesses/{BUSINESS_ID}/transactions", json=tx_data, headers=headers)
    if res.status_code == 200:
        print("✅ Transacción Creada Exitosamente")
    else:
        print(f"❌ Fallo Transacción: {res.text}")
        return

    # 6. Verify Balance Update
    print("6. Verificando Actualización de Saldo (Partida Simple)...")
    res = requests.get(f"{BASE_URL}/businesses/{BUSINESS_ID}/bank_accounts", headers=headers)
    if res.status_code == 200:
        accs = res.json()
        target_acc = next((a for a in accs if a["id"] == acc_id), None)
        if target_acc and target_acc["current_balance"] == 150000:
            print("✅ Saldo Actualizado Correctamente (150,000)")
        else:
            print("❌ Saldo Incorrecto")
    else:
        print("❌ Fallo Obtener Cuentas")
        return

    print("--- TODOS LOS TESTS QA V2 PASARON ---")

if __name__ == "__main__":
    run_tests()
