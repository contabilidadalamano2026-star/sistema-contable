import requests
import json
import os

BASE_URL = "http://localhost:8000/api"

def run_test():
    print("1. Registrando usuario...")
    requests.post(f"{BASE_URL}/register", json={"username": "qatest2", "email": "qatest2@test.com", "password": "123"})
    
    print("2. Iniciando sesion...")
    r = requests.post(f"{BASE_URL}/login", json={"username": "qatest2", "password": "123"})
    if r.status_code != 200:
        print("Fallo login:", r.text)
        return
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print("3. Creando negocio...")
    r = requests.post(f"{BASE_URL}/businesses", json={"name": "QA Biz", "legal_id": "123456"}, headers=headers)
    biz_id = r.json()["id"]
    
    print("4. Configurando Hacienda...")
    with open("test_qa_cert.p12", "rb") as f:
        files = {"p12_file": ("test_qa_cert.p12", f, "application/x-pkcs12")}
        data = {
            "business_id": biz_id,
            "atv_username": "qa_user",
            "atv_password": "qa_password",
            "pin": "1234"
        }
        r = requests.post(f"{BASE_URL}/hacienda-config", headers=headers, data=data, files=files)
        print("Config Status:", r.status_code, r.text)
        
    print("5. Emitiendo factura...")
    tx_data = {
        "business_id": biz_id,
        "type": "income",
        "amount": 5000,
        "category": "Test Venta",
        "emitir_hacienda": True,
        "receptor_cedula": "987654321",
        "receptor_nombre": "Test Cliente",
        "tarifa_iva": 13
    }
    r = requests.post(f"{BASE_URL}/transactions", json=tx_data, headers=headers)
    print("Factura Status:", r.status_code)
    
    if r.status_code == 200:
        res = r.json()
        xml = res.get("hacienda_xml", "")
        if "<ds:Signature" in xml or "Signature" in xml:
            print("EXITO: Firma digital inyectada correctamente en el XML.")
            print(xml[:500] + "...\n[...]\n..." + xml[-500:])
        else:
            print("FALLO: No se encontro la firma en el XML.")
            with open("test_xml_output.xml", "w", encoding="utf-8") as f:
                f.write(xml)
    else:
        print("Error en factura:", r.text)

if __name__ == "__main__":
    run_test()
