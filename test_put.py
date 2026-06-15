import requests

url = "http://localhost:8000/api/login"
resp = requests.post(url, json={"username": "testuser", "password": "testpassword"})
token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

put_url = "http://localhost:8000/api/transactions/10"
resp = requests.put(put_url, json={"amount": 999.99, "category": "Venta Modificada"}, headers=headers)
print("PUT:", resp.status_code, resp.json())

get_url = "http://localhost:8000/api/transactions?business_id=8"
resp = requests.get(get_url, headers=headers)
print("GET:", [t for t in resp.json() if t["id"] == 10])
