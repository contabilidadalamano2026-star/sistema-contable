from fastapi import FastAPI, HTTPException, Depends, Header, File, UploadFile, Form
from pydantic import BaseModel
from typing import Optional, List
from .database import init_db, get_db, encrypt_data, decrypt_data
from .auth import get_password_hash, verify_password, create_access_token, decode_access_token
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from datetime import timedelta
import os
import shutil

app = FastAPI(title="Contabilidad a la Mano (C.A.L.M) CR")

# Configurar CORS para permitir que el frontend se comunique con el backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permitir acceso local
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar Base de Datos al arrancar
init_db()

# --- Modelos Pydantic (ValidaciÃ³n de Datos) ---
class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class SubUserCreate(BaseModel):
    username: str
    password: str
    role: str # 'cajero', 'contador'

class BusinessCreate(BaseModel):
    name: str
    legal_id: Optional[str] = None

class TransactionItemCreate(BaseModel):
    product_id: int
    warehouse_id: int
    quantity: int
    price: float

class TransactionCreate(BaseModel):
    business_id: Optional[int] = None
    type: str # 'income' o 'expense'
    amount: float
    category: str
    description: Optional[str] = None
    is_paid: Optional[bool] = True
    due_date: Optional[str] = None
    currency: Optional[str] = 'CRC'
    exchange_rate: Optional[float] = 1.0
    subtotal: Optional[float] = None
    iva_amount: Optional[float] = None
    account_id: Optional[int] = None
    contact_id: Optional[int] = None
    
    # --- Datos Extra Hacienda ---
    emitir_hacienda: Optional[bool] = False
    receptor_cedula: Optional[str] = None
    receptor_nombre: Optional[str] = None
    tarifa_iva: Optional[int] = 0
    
    # --- Inventario Avanzado ---
    items: Optional[List[TransactionItemCreate]] = None

class TransactionUpdate(BaseModel):
    amount: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None # Permitir cambiar la fecha
    is_paid: Optional[bool] = None
    due_date: Optional[str] = None
    currency: Optional[str] = None
    exchange_rate: Optional[float] = None

class SinpeParseRequest(BaseModel):
    sms_text: str

class PayrollRunCreate(BaseModel):
    run_date: str
    start_date: str
    end_date: str
    total_salaries: float
    total_deductions: float
    total_net: float
    
class BankAccountCreate(BaseModel):
    name: str
    currency: Optional[str] = 'CRC'
    initial_balance: Optional[float] = 0.0

class ContactCreate(BaseModel):
    name: str
    tax_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = 'client'

class QuoteCreate(BaseModel):
    contact_id: Optional[int] = None
    date: str
    total: float
    details: str

class PaymentCreate(BaseModel):
    amount: float
    date: str
    account_id: Optional[int] = None

class AccountCatalogCreate(BaseModel):
    code: str
    name: str
    type: str
    parent_id: Optional[int] = None

class JournalLineCreate(BaseModel):
    account_id: int
    debit: float = 0
    credit: float = 0

class JournalEntryCreate(BaseModel):
    date: str
    description: str
    reference_type: str = 'manual'
    reference_id: Optional[int] = None
    lines: List[JournalLineCreate]

class ProductCreate(BaseModel):
    business_id: int
    name: str
    price: float
    iva_rate: int = 13
    stock: int = 0

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    iva_rate: Optional[int] = None
    stock: Optional[int] = None

class WarehouseCreate(BaseModel):
    name: str

class InventoryMovementCreate(BaseModel):
    product_id: int
    warehouse_id: int
    type: str # 'IN' or 'OUT'
    quantity: int
    reference: Optional[str] = None

class PurchaseOrderLineCreate(BaseModel):
    product_id: int
    quantity: int
    price: float

class PurchaseOrderCreate(BaseModel):
    contact_id: int
    date: str
    total: float
    notes: Optional[str] = None
    lines: List[PurchaseOrderLineCreate]

class FixedAssetCreate(BaseModel):
    name: str
    value: float
    purchase_date: str
    lifespan_years: int
    depreciation_rate: float

class BudgetEnvelopeCreate(BaseModel):
    category: str
    budget_amount: float

class RecurringExpenseCreate(BaseModel):
    business_id: int
    category: str
    description: str
    amount: float
    day_of_month: int

class EmployeeCreate(BaseModel):
    business_id: int
    name: str
    identification: Optional[str] = None
    base_salary: float

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    identification: Optional[str] = None
    base_salary: Optional[float] = None
    is_active: Optional[bool] = None

class EmployeePay(BaseModel):
    amount: float
    description: str


# --- Dependencia de Seguridad ---
def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token no proporcionado o invÃ¡lido")
    
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token expirado o invÃ¡lido. Inicia sesiÃ³n nuevamente.")
    
    return payload.get("sub") # Devuelve el ID del usuario

# --- Rutas de AutenticaciÃ³n ---
@app.post("/api/register")
def register(user: UserRegister):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verificar si existe el usuario
        cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (user.username, user.email))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="El nombre de usuario o correo ya estÃ¡ en uso.")
            
        hashed_password = get_password_hash(user.password)
        cursor.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (user.username, user.email, hashed_password)
        )
        conn.commit()
        return {"message": "Usuario registrado exitosamente"}

@app.post("/api/login")
def login(user: UserLogin):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, password_hash, role, parent_id FROM users WHERE username = ?", (user.username,))
        db_user = cursor.fetchone()
        
        if not db_user or not verify_password(user.password, db_user["password_hash"]):
            raise HTTPException(status_code=401, detail="Usuario o contraseÃ±a incorrectos.")
            
        owner_id = db_user["parent_id"] if db_user["parent_id"] else db_user["id"]
        
        access_token = create_access_token(
            data={"sub": str(owner_id), "role": db_user["role"], "real_user_id": str(db_user["id"])},
            expires_delta=timedelta(days=7)
        )
        return {"access_token": access_token, "token_type": "bearer", "role": db_user["role"]}

# --- FASE 21: MULTI-USUARIO (SUB-CUENTAS) ---

@app.post("/api/subusers")
def create_subuser(subuser: SubUserCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        # Verificar que el usuario actual es dueÃ±o
        cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
        usr = cursor.fetchone()
        if not usr or usr['role'] != 'owner':
            raise HTTPException(status_code=403, detail="Solo el dueÃ±o puede crear sub-cuentas")
            
        # Verificar username Ãºnico
        cursor.execute("SELECT id FROM users WHERE username = ?", (subuser.username,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
            
        hashed_password = get_password_hash(subuser.password)
        cursor.execute(
            "INSERT INTO users (username, password_hash, role, parent_id) VALUES (?, ?, ?, ?)",
            (subuser.username, hashed_password, subuser.role, user_id)
        )
        conn.commit()
        return {"message": "Sub-usuario creado exitosamente"}

@app.get("/api/subusers")
def get_subusers(user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, role, created_at FROM users WHERE parent_id = ?", (user_id,))
        return [dict(u) for u in cursor.fetchall()]

@app.get("/api/me")
def get_my_profile(user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, email, created_at FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return dict(user)

# --- Rutas Negocios ---
@app.post("/api/businesses")
def create_business(business: BusinessCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO businesses (user_id, name, legal_id) VALUES (?, ?, ?)",
            (user_id, business.name, business.legal_id)
        )
        business_id = cursor.lastrowid
        
        # FASE 18: Seeder de CatÃ¡logo Contable (Plan de cuentas por defecto)
        default_accounts = [
            ('100', 'Activos', 'asset'),
            ('101', 'Efectivo y Equivalentes', 'asset'),
            ('102', 'Cuentas por Cobrar', 'asset'),
            ('103', 'Inventario', 'asset'),
            ('200', 'Pasivos', 'liability'),
            ('201', 'Cuentas por Pagar', 'liability'),
            ('202', 'Impuestos por Pagar', 'liability'),
            ('300', 'Patrimonio', 'equity'),
            ('301', 'Capital Social', 'equity'),
            ('400', 'Ingresos', 'revenue'),
            ('401', 'Ventas de Productos', 'revenue'),
            ('402', 'Ventas de Servicios', 'revenue'),
            ('500', 'Gastos', 'expense'),
            ('501', 'Sueldos y Salarios', 'expense'),
            ('502', 'Servicios PÃºblicos', 'expense'),
            ('503', 'Alquileres', 'expense')
        ]
        cursor.executemany(
            "INSERT INTO accounts_catalog (business_id, code, name, type) VALUES (?, ?, ?, ?)",
            [(business_id, acc[0], acc[1], acc[2]) for acc in default_accounts]
        )
        
        conn.commit()
        return {"id": business_id, "message": "Negocio y Plan de Cuentas creados exitosamente"}

@app.get("/api/businesses")
def get_businesses(user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM businesses WHERE user_id = ?", (user_id,))
        businesses = cursor.fetchall()
        return [dict(b) for b in businesses]

# --- Rutas Transacciones (Casa y Negocios) ---
@app.post("/api/transactions")
def create_transaction(tx: TransactionCreate, user_id: str = Depends(get_current_user)):
    if tx.type not in ['income', 'expense']:
        raise HTTPException(status_code=400, detail="El tipo debe ser 'income' o 'expense'")
        
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Si tiene business_id, verificar que el negocio exista y pertenezca al usuario
        if tx.business_id:
            cursor.execute("SELECT id, legal_id, name FROM businesses WHERE id = ? AND user_id = ?", (tx.business_id, user_id))
            biz = cursor.fetchone()
            if not biz:
                raise HTTPException(status_code=403, detail="Negocio no vÃ¡lido o no tienes permisos")
                
            hacienda_xml = None
            hacienda_status = None
            hacienda_clave = None
            hacienda_location = None
            
            if tx.emitir_hacienda and tx.type == "income":
                cursor.execute("SELECT atv_username FROM hacienda_config WHERE business_id = ? AND is_active = 1", (tx.business_id,))
                h_conf = cursor.fetchone()
                if not h_conf:
                    raise HTTPException(status_code=400, detail="El mÃ³dulo de Hacienda no estÃ¡ activo para este negocio.")
                
                from .hacienda_xml import build_factura_xml
                
                
                # FASE 11: CÃ¡lculo correcto de IVA si tx.amount es el total
                # Si el usuario ingresÃ³ el total en tx.amount: subtotal = tx.amount / (1 + tarifa/100)
                subtotal_calc = tx.amount / (1 + (tx.tarifa_iva / 100))
                iva_calc = tx.amount - subtotal_calc
                
                # Actualizar el objeto tx si no venÃ­an definidos
                if tx.subtotal is None: tx.subtotal = subtotal_calc
                if tx.iva_amount is None: tx.iva_amount = iva_calc
                
                xml_data = {
                    "emisor": {
                        "cedula": biz["legal_id"] or "000000000",
                        "nombre": biz["name"],
                        "correo": f"{h_conf['atv_username']}@sistema.local"
                    },
                    "detalle": [{
                        "cantidad": 1.0,
                        "detalle": tx.category,
                        "precio_unitario": tx.subtotal,
                        "subtotal": tx.subtotal,
                        "monto_total": tx.subtotal,
                        "iva": tx.iva_amount,
                        "tarifa_iva": tx.tarifa_iva
                    }]
                }
                
                if tx.receptor_cedula and tx.receptor_nombre:
                    xml_data["receptor"] = {
                        "cedula": tx.receptor_cedula,
                        "nombre": tx.receptor_nombre,
                        "correo": "cliente@correo.local"
                    }
                    
                hacienda_xml_bytes = build_factura_xml(xml_data)
                
                # --- FASE 1.3: Firma XAdES-EPES ---
                cursor.execute("SELECT p12_file_path, p12_pin_encrypted, atv_password_encrypted FROM hacienda_config WHERE business_id = ?", (tx.business_id,))
                p12_row = cursor.fetchone()
                
                try:
                    if p12_row and p12_row["p12_file_path"] and p12_row["p12_pin_encrypted"]:
                        from .hacienda_signer import sign_factura_xml
                        pin_descifrado = decrypt_data(p12_row["p12_pin_encrypted"])
                        hacienda_xml_bytes = sign_factura_xml(hacienda_xml_bytes, p12_row["p12_file_path"], pin_descifrado)
                        
                        # --- FASE 1.4: Envio a Hacienda ---
                        from .hacienda_service import obtener_token, enviar_factura
                        import xml.etree.ElementTree as ET
                        
                        atv_pass_descifrado = decrypt_data(p12_row["atv_password_encrypted"])
                        token = obtener_token(h_conf["atv_username"], atv_pass_descifrado)
                        
                        # Extraer clave del XML generado
                        root = ET.fromstring(hacienda_xml_bytes)
                        ns = {'fe': 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronica'}
                        clave = root.find('fe:Clave', ns).text
                        fecha = root.find('fe:FechaEmision', ns).text
                        
                        emisor_tipo = "01" # CÃ©dula fÃ­sica por defecto en Sandbox
                        receptor_tipo = "01" if tx.receptor_cedula else None
                        
                        res = enviar_factura(
                            hacienda_xml_bytes, clave, biz["legal_id"], emisor_tipo,
                            tx.receptor_cedula, receptor_tipo, fecha, token
                        )
                        
                        hacienda_status = res["status"]
                        hacienda_clave = clave
                        hacienda_location = res.get("location")
                        if "error" in res:
                            hacienda_status = f"error_borrador: {res['error']}"
                    else:
                        hacienda_status = "error_borrador: Falta archivo .p12 o PIN"
                except Exception as e:
                    hacienda_status = f"error_borrador: {str(e)}"
                    
                hacienda_xml = hacienda_xml_bytes.decode('utf-8')
        
        # Si no se mandÃ³ a Hacienda y no trae subtotal/iva explÃ­cito (como en gastos o ingresos simples)
        if tx.subtotal is None: tx.subtotal = tx.amount
        if tx.iva_amount is None: tx.iva_amount = 0.0
        
        cursor.execute(
            "INSERT INTO transactions (user_id, business_id, type, amount, category, description, hacienda_status, hacienda_clave, hacienda_location, is_paid, due_date, currency, exchange_rate, subtotal, iva_amount, account_id, contact_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, tx.business_id, tx.type, tx.amount, tx.category, tx.description, hacienda_status, hacienda_clave, hacienda_location, 1 if tx.is_paid else 0, tx.due_date, tx.currency, tx.exchange_rate, tx.subtotal, tx.iva_amount, tx.account_id, tx.contact_id)
        )
        tx_id = cursor.lastrowid
        
        # --- FASE 33: FidelizaciÃ³n (Puntos) ---
        if tx.type == 'income' and tx.contact_id:
            points_earned = tx.amount / 1000.0
            cursor.execute("UPDATE contacts SET points = points + ? WHERE id = ?", (points_earned, tx.contact_id))
        
        # --- FASE 22: Inventario Avanzado ---
        if tx.items and tx.business_id:
            import datetime
            mov_type = 'OUT' if tx.type == 'income' else 'IN'
            for item in tx.items:
                cursor.execute("SELECT quantity FROM product_stock WHERE product_id = ? AND warehouse_id = ?", (item.product_id, item.warehouse_id))
                row = cursor.fetchone()
                current_qty = row['quantity'] if row else 0
                new_qty = current_qty - item.quantity if mov_type == 'OUT' else current_qty + item.quantity
                
                if row:
                    cursor.execute("UPDATE product_stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?", (new_qty, item.product_id, item.warehouse_id))
                else:
                    cursor.execute("INSERT INTO product_stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", (item.product_id, item.warehouse_id, new_qty))
                
                cursor.execute("SELECT stock FROM products WHERE id = ?", (item.product_id,))
                global_row = cursor.fetchone()
                if global_row:
                    new_global = global_row['stock'] - item.quantity if mov_type == 'OUT' else global_row['stock'] + item.quantity
                    cursor.execute("UPDATE products SET stock = ? WHERE id = ?", (new_global, item.product_id))
                
                cursor.execute('''
                    INSERT INTO inventory_movements (product_id, warehouse_id, type, quantity, date, reference)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (item.product_id, item.warehouse_id, mov_type, item.quantity, datetime.datetime.now().isoformat(), f"TransacciÃ³n {tx_id}"))

        conn.commit()
        
        response = {"id": tx_id, "message": "TransacciÃ³n registrada"}
        if 'hacienda_xml' in locals() and hacienda_xml:
            response["hacienda_xml"] = hacienda_xml
            
        return response

@app.get("/api/transactions")
def get_transactions(business_id: Optional[int] = None, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        if business_id:
            cursor.execute('''
                SELECT * FROM transactions 
                WHERE user_id = ? AND business_id = ? 
                ORDER BY date DESC
            ''', (user_id, business_id))
        else:
            cursor.execute('''
                SELECT t.*, COALESCE(SUM(p.amount), 0) as amount_paid
                FROM transactions t
                LEFT JOIN payments p ON t.id = p.transaction_id
                WHERE t.user_id = ? AND t.business_id IS NULL
                GROUP BY t.id
                ORDER BY t.date DESC
            ''', (user_id,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
@app.put("/api/transactions/{tx_id}/pay")
def pay_transaction(tx_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT t.id, t.amount, b.user_id FROM transactions t 
            JOIN businesses b ON t.business_id = b.id 
            WHERE t.id = ? AND b.user_id = ?
        ''', (tx_id, user_id))
        tx = cursor.fetchone()
        if not tx:
            raise HTTPException(status_code=403, detail="No autorizado")
            
        cursor.execute("UPDATE transactions SET is_paid = 1 WHERE id = ?", (tx_id,))
        # FASE 17: TambiÃ©n registrar pago completo en payments si no existen abonos
        cursor.execute("SELECT SUM(amount) as paid FROM payments WHERE transaction_id = ?", (tx_id,))
        paid = cursor.fetchone()['paid'] or 0.0
        if paid < tx['amount']:
            from datetime import datetime
            cursor.execute("INSERT INTO payments (transaction_id, date, amount) VALUES (?, ?, ?)", (tx_id, datetime.now().isoformat(), tx['amount'] - paid))
            
        conn.commit()
        return {"message": "TransacciÃ³n marcada como pagada"}

# --- FASE 17: ABONOS (CXC/CXP) ---

@app.get("/api/transactions/{tx_id}/payments")
def get_transaction_payments(tx_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT t.id, b.user_id FROM transactions t 
            JOIN businesses b ON t.business_id = b.id 
            WHERE t.id = ? AND b.user_id = ?
        ''', (tx_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="No autorizado")
            
        cursor.execute("SELECT * FROM payments WHERE transaction_id = ? ORDER BY date DESC", (tx_id,))
        return [dict(p) for p in cursor.fetchall()]

@app.post("/api/transactions/{tx_id}/payments")
def create_transaction_payment(tx_id: int, payment: PaymentCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT t.id, t.amount, t.is_paid, b.user_id FROM transactions t 
            JOIN businesses b ON t.business_id = b.id 
            WHERE t.id = ? AND b.user_id = ?
        ''', (tx_id, user_id))
        tx = cursor.fetchone()
        if not tx:
            raise HTTPException(status_code=403, detail="No autorizado")
            
        cursor.execute("INSERT INTO payments (transaction_id, date, amount, account_id) VALUES (?, ?, ?, ?)",
                       (tx_id, payment.date, payment.amount, payment.account_id))
        
        # Check if fully paid
        cursor.execute("SELECT SUM(amount) as total_paid FROM payments WHERE transaction_id = ?", (tx_id,))
        total_paid = cursor.fetchone()['total_paid'] or 0.0
        if total_paid >= tx['amount'] and not tx['is_paid']:
            cursor.execute("UPDATE transactions SET is_paid = 1 WHERE id = ?", (tx_id,))
            
        conn.commit()
        return {"message": "Abono registrado exitosamente"}

@app.put("/api/transactions/{transaction_id}")
def update_transaction(transaction_id: int, tx: TransactionUpdate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        # Validar propiedad
        cursor.execute("SELECT id FROM transactions WHERE id = ? AND user_id = ?", (transaction_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="OperaciÃ³n no permitida o no encontrada")
            
        # Construir query dinÃ¡mica
        updates = []
        params = []
        if tx.amount is not None:
            updates.append("amount = ?")
            params.append(tx.amount)
        if tx.category is not None:
            updates.append("category = ?")
            params.append(tx.category)
        if tx.description is not None:
            updates.append("description = ?")
            params.append(tx.description)
        if tx.date is not None:
            updates.append("date = ?")
            params.append(tx.date)
        if tx.is_paid is not None:
            updates.append("is_paid = ?")
            params.append(1 if tx.is_paid else 0)
        if tx.due_date is not None:
            updates.append("due_date = ?")
            params.append(tx.due_date)
        if tx.currency is not None:
            updates.append("currency = ?")
            params.append(tx.currency)
        if tx.exchange_rate is not None:
            updates.append("exchange_rate = ?")
            params.append(tx.exchange_rate)
            
        if not updates:
            return {"message": "No hay campos para actualizar"}
            
        params.append(transaction_id)
        
        query = f"UPDATE transactions SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()
        return {"message": "TransacciÃ³n actualizada"}

@app.delete("/api/transactions/{tx_id}")
def delete_transaction(transaction_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        # Verificar que la transacciÃ³n exista y pertenezca al usuario
        cursor.execute("SELECT id FROM transactions WHERE id = ? AND user_id = ?", (transaction_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="OperaciÃ³n no permitida o no encontrada")
        
        cursor.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
        conn.commit()
        return {"message": "TransacciÃ³n eliminada con Ã©xito"}

# --- Endpoints de Productos ---
@app.post("/api/businesses/{business_id}/products")
def create_product(business_id: int, product: ProductCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
        
        cursor.execute('''
            INSERT INTO products (business_id, name, price, iva_rate, stock)
            VALUES (?, ?, ?, ?, ?)
        ''', (product.business_id, product.name, product.price, product.iva_rate, product.stock))
        conn.commit()
        return {"message": "Producto creado", "id": cursor.lastrowid}

# --- FASE 24: IMPORTACION MASIVA ---
from fastapi import UploadFile, File
import csv
import io

@app.post("/api/businesses/{business_id}/products/import")
async def import_products_csv(business_id: int, file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        content = await file.read()
        try:
            # Detect encoding and read
            text = content.decode('utf-8')
            reader = csv.DictReader(io.StringIO(text))
            
            inserted = 0
            for row in reader:
                name = row.get('name', '').strip()
                price = float(row.get('price', 0))
                iva = int(row.get('iva_rate', 0))
                stock = int(row.get('stock', 0))
                
                if name:
                    cursor.execute('''
                        INSERT INTO products (business_id, name, price, iva_rate, stock)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (business_id, name, price, iva, stock))
                    inserted += 1
            
            conn.commit()
            return {"message": f"Se importaron {inserted} productos"}
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error leyendo CSV: {str(e)}")

@app.get("/api/products")
def get_products(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
        
        cursor.execute("SELECT * FROM products WHERE business_id = ?", (business_id,))
        return [dict(p) for p in cursor.fetchall()]

@app.put("/api/products/{product_id}")
def update_product(product_id: int, prod: ProductUpdate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        # Join con businesses para validar pertenencia
        cursor.execute('''
            SELECT p.id FROM products p 
            JOIN businesses b ON p.business_id = b.id 
            WHERE p.id = ? AND b.user_id = ?
        ''', (product_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Producto no encontrado o sin permisos")
            
        updates = []
        params = []
        if prod.name is not None: updates.append("name = ?"); params.append(prod.name)
        if prod.price is not None: updates.append("price = ?"); params.append(prod.price)
        if prod.iva_rate is not None: updates.append("iva_rate = ?"); params.append(prod.iva_rate)
        if prod.stock is not None: updates.append("stock = ?"); params.append(prod.stock)
        
        if not updates:
            return {"message": "Nada que actualizar"}
            
        params.append(product_id)
        cursor.execute(f"UPDATE products SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
        return {"message": "Producto actualizado"}

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT p.id FROM products p 
            JOIN businesses b ON p.business_id = b.id 
            WHERE p.id = ? AND b.user_id = ?
        ''', (product_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Producto no encontrado")
            
        cursor.execute("DELETE FROM products WHERE id = ?", (product_id,))
        conn.commit()
        return {"message": "Producto eliminado"}

# --- FASE 22: BODEGAS E INVENTARIO AVANZADO ---

@app.get("/api/businesses/{business_id}/warehouses")
def get_warehouses(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
        
        cursor.execute("SELECT * FROM warehouses WHERE business_id = ?", (business_id,))
        return [dict(w) for w in cursor.fetchall()]

@app.post("/api/businesses/{business_id}/warehouses")
def create_warehouse(business_id: int, warehouse: WarehouseCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute("INSERT INTO warehouses (business_id, name) VALUES (?, ?)", (business_id, warehouse.name))
        conn.commit()
        return {"message": "Bodega creada", "id": cursor.lastrowid}

@app.get("/api/businesses/{business_id}/inventory")
def get_inventory(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute('''
            SELECT p.name as product_name, p.id as product_id, p.price,
                   w.name as warehouse_name, w.id as warehouse_id, 
                   COALESCE(ps.quantity, 0) as quantity
            FROM products p
            LEFT JOIN product_stock ps ON p.id = ps.product_id
            LEFT JOIN warehouses w ON ps.warehouse_id = w.id
            WHERE p.business_id = ?
            ORDER BY p.name ASC, w.name ASC
        ''', (business_id,))
        return [dict(r) for r in cursor.fetchall()]

@app.post("/api/businesses/{business_id}/inventory_movements")
def create_inventory_movement(business_id: int, mov: InventoryMovementCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute("SELECT quantity FROM product_stock WHERE product_id = ? AND warehouse_id = ?", (mov.product_id, mov.warehouse_id))
        row = cursor.fetchone()
        
        current_qty = row['quantity'] if row else 0
        new_qty = current_qty + mov.quantity if mov.type == 'IN' else current_qty - mov.quantity
        
        if row:
            cursor.execute("UPDATE product_stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?", (new_qty, mov.product_id, mov.warehouse_id))
        else:
            cursor.execute("INSERT INTO product_stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", (mov.product_id, mov.warehouse_id, new_qty))
            
        cursor.execute("SELECT stock FROM products WHERE id = ?", (mov.product_id,))
        global_row = cursor.fetchone()
        if global_row:
            new_global = global_row['stock'] + mov.quantity if mov.type == 'IN' else global_row['stock'] - mov.quantity
            cursor.execute("UPDATE products SET stock = ? WHERE id = ?", (new_global, mov.product_id))
            
        import datetime
        cursor.execute('''
            INSERT INTO inventory_movements (product_id, warehouse_id, type, quantity, date, reference)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (mov.product_id, mov.warehouse_id, mov.type, mov.quantity, datetime.datetime.now().isoformat(), mov.reference))
        
        conn.commit()
        return {"message": "Movimiento registrado"}

# --- FASE 23: ORDENES DE COMPRA ---

@app.get("/api/businesses/{business_id}/purchase_orders")
def get_purchase_orders(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute('''
            SELECT po.*, c.name as contact_name 
            FROM purchase_orders po 
            LEFT JOIN contacts c ON po.contact_id = c.id
            WHERE po.business_id = ?
            ORDER BY po.date DESC
        ''', (business_id,))
        orders = [dict(o) for o in cursor.fetchall()]
        
        for o in orders:
            cursor.execute('''
                SELECT l.*, p.name as product_name 
                FROM purchase_order_lines l
                JOIN products p ON l.product_id = p.id
                WHERE l.order_id = ?
            ''', (o['id'],))
            o['lines'] = [dict(l) for l in cursor.fetchall()]
            
        return orders

@app.post("/api/businesses/{business_id}/purchase_orders")
def create_purchase_order(business_id: int, order: PurchaseOrderCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute('''
            INSERT INTO purchase_orders (business_id, contact_id, date, status, total, notes)
            VALUES (?, ?, ?, 'pending', ?, ?)
        ''', (business_id, order.contact_id, order.date, order.total, order.notes))
        order_id = cursor.lastrowid
        
        for line in order.lines:
            cursor.execute('''
                INSERT INTO purchase_order_lines (order_id, product_id, quantity, price)
                VALUES (?, ?, ?, ?)
            ''', (order_id, line.product_id, line.quantity, line.price))
            
        conn.commit()
        return {"message": "Orden de compra creada", "id": order_id}

@app.put("/api/businesses/{business_id}/purchase_orders/{order_id}/receive")
def receive_purchase_order(business_id: int, order_id: int, warehouse_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute("SELECT status FROM purchase_orders WHERE id = ? AND business_id = ?", (order_id, business_id))
        row = cursor.fetchone()
        if not row or row['status'] == 'received':
            raise HTTPException(status_code=400, detail="Orden invÃ¡lida o ya recibida")
            
        cursor.execute("UPDATE purchase_orders SET status = 'received' WHERE id = ?", (order_id,))
        
        # Add stock via movement
        cursor.execute("SELECT * FROM purchase_order_lines WHERE order_id = ?", (order_id,))
        lines = cursor.fetchall()
        
        import datetime
        for line in lines:
            pid = line['product_id']
            qty = line['quantity']
            
            cursor.execute("SELECT quantity FROM product_stock WHERE product_id = ? AND warehouse_id = ?", (pid, warehouse_id))
            st_row = cursor.fetchone()
            current_qty = st_row['quantity'] if st_row else 0
            new_qty = current_qty + qty
            
            if st_row:
                cursor.execute("UPDATE product_stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?", (new_qty, pid, warehouse_id))
            else:
                cursor.execute("INSERT INTO product_stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", (pid, warehouse_id, new_qty))
                
            cursor.execute("SELECT stock FROM products WHERE id = ?", (pid,))
            global_row = cursor.fetchone()
            if global_row:
                cursor.execute("UPDATE products SET stock = ? WHERE id = ?", (global_row['stock'] + qty, pid))
                
            cursor.execute('''
                INSERT INTO inventory_movements (product_id, warehouse_id, type, quantity, date, reference)
                VALUES (?, ?, 'IN', ?, ?, ?)
            ''', (pid, warehouse_id, qty, datetime.datetime.now().isoformat(), f"RecepciÃ³n OC {order_id}"))
            
        conn.commit()
        return {"message": "Orden de compra recibida y stock actualizado"}

# --- FASE 25: ACTIVOS FIJOS ---

@app.get("/api/businesses/{business_id}/fixed_assets")
def get_fixed_assets(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute("SELECT * FROM fixed_assets WHERE business_id = ?", (business_id,))
        return [dict(a) for a in cursor.fetchall()]

@app.post("/api/businesses/{business_id}/fixed_assets")
def create_fixed_asset(business_id: int, asset: FixedAssetCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute('''
            INSERT INTO fixed_assets (business_id, name, value, purchase_date, lifespan_years, depreciation_rate)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (business_id, asset.name, asset.value, asset.purchase_date, asset.lifespan_years, asset.depreciation_rate))
        conn.commit()
        return {"message": "Activo fijo registrado", "id": cursor.lastrowid}

# --- Rutas Empleados y Planillas ---

# --- FASE 12: CUENTAS BANCARIAS ---

@app.get("/api/businesses/{business_id}/bank_accounts")
def get_bank_accounts(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute("SELECT * FROM bank_accounts WHERE business_id = ?", (business_id,))
        accounts = [dict(a) for a in cursor.fetchall()]
        
        result = []
        for acc in accounts:
            # Calcular balance real
            cursor.execute("SELECT type, amount FROM transactions WHERE business_id = ? AND account_id = ? AND is_paid = 1", (business_id, acc['id']))
            txs = cursor.fetchall()
            
            balance = acc['initial_balance']
            for tx in txs:
                if tx['type'] == 'income': balance += tx['amount']
                else: balance -= tx['amount']
                
            acc['current_balance'] = balance
            result.append(acc)
            
        return result

@app.post("/api/businesses/{business_id}/bank_accounts")
class BankTransferRequest(BaseModel):
    source_account_id: int
    target_account_id: int
    amount: float
    description: str

@app.post("/api/businesses/{business_id}/bank_transfers")
def create_bank_transfer(business_id: int, transfer: BankTransferRequest, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Withdraw from source
        cursor.execute("UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ? AND business_id = ?", 
            (transfer.amount, transfer.source_account_id, business_id))
            
        # Deposit to target
        cursor.execute("UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ? AND business_id = ?", 
            (transfer.amount, transfer.target_account_id, business_id))
            
        # Register transactions
        from datetime import datetime
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Expense from source
        cursor.execute('''
            INSERT INTO transactions (user_id, business_id, type, amount, category, description, date, account_id, is_paid)
            VALUES (?, ?, 'expense', ?, 'Transferencia Bancaria', ?, ?, ?, 1)
        ''', (user_id, business_id, transfer.amount, f"A cuenta #{transfer.target_account_id}: {transfer.description}", now, transfer.source_account_id))
        
        # Income to target
        cursor.execute('''
            INSERT INTO transactions (user_id, business_id, type, amount, category, description, date, account_id, is_paid)
            VALUES (?, ?, 'income', ?, 'Transferencia Bancaria', ?, ?, ?, 1)
        ''', (user_id, business_id, transfer.amount, f"De cuenta #{transfer.source_account_id}: {transfer.description}", now, transfer.target_account_id))
        
        conn.commit()
        return {"message": "Transferencia realizada"}

def create_bank_account(business_id: int, account: BankAccountCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute(
            "INSERT INTO bank_accounts (business_id, name, currency, initial_balance) VALUES (?, ?, ?, ?)",
            (business_id, account.name, account.currency, account.initial_balance)
        )
        conn.commit()
        return {"message": "Cuenta bancaria creada", "id": cursor.lastrowid}

# --- FASES 13 y 14: CRM CLIENTES Y PROVEEDORES (CONTACTOS) ---

@app.get("/api/businesses/{business_id}/contacts")
def get_contacts(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute("SELECT * FROM contacts WHERE business_id = ?", (business_id,))
        return [dict(c) for c in cursor.fetchall()]

@app.post("/api/businesses/{business_id}/contacts")
def create_contact(business_id: int, contact: ContactCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute(
            "INSERT INTO contacts (business_id, name, tax_id, email, phone, role) VALUES (?, ?, ?, ?, ?, ?)",
            (business_id, contact.name, contact.tax_id, contact.email, contact.phone, contact.role)
        )
        conn.commit()
        return {"message": "Contacto creado", "id": cursor.lastrowid}

@app.delete("/api/contacts/{contact_id}")
def delete_contact(contact_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT c.id FROM contacts c
            JOIN businesses b ON c.business_id = b.id
            WHERE c.id = ? AND b.user_id = ?
        ''', (contact_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Contacto no encontrado")
            
        cursor.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
        conn.commit()
        return {"message": "Contacto eliminado"}

# --- FASE 16: COTIZACIONES / PROFORMAS ---

@app.get("/api/businesses/{business_id}/quotes")
def get_quotes(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute('''
            SELECT q.*, c.name as contact_name 
            FROM quotes q
            LEFT JOIN contacts c ON q.contact_id = c.id
            WHERE q.business_id = ?
        ''', (business_id,))
        return [dict(q) for q in cursor.fetchall()]

@app.post("/api/businesses/{business_id}/quotes")
def create_quote(business_id: int, quote: QuoteCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute(
            "INSERT INTO quotes (business_id, contact_id, date, total, details, status) VALUES (?, ?, ?, ?, ?, 'pending')",
            (business_id, quote.contact_id, quote.date, quote.total, quote.details)
        )
        conn.commit()
        return {"message": "CotizaciÃ³n creada", "id": cursor.lastrowid}

@app.post("/api/quotes/{quote_id}/convert")
def convert_quote_to_invoice(quote_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT q.*, b.user_id FROM quotes q
            JOIN businesses b ON q.business_id = b.id
            WHERE q.id = ? AND b.user_id = ?
        ''', (quote_id, user_id))
        quote = cursor.fetchone()
        if not quote:
            raise HTTPException(status_code=403, detail="CotizaciÃ³n no encontrada")
            
        if quote['status'] == 'invoiced':
            raise HTTPException(status_code=400, detail="CotizaciÃ³n ya facturada")
            
        # Inyectar a transacciones
        cursor.execute('''
            INSERT INTO transactions (user_id, business_id, type, amount, category, description, is_paid, hacienda_status, contact_id)
            VALUES (?, ?, 'income', ?, 'ConversiÃ³n de CotizaciÃ³n', ?, 0, 'borrador', ?)
        ''', (user_id, quote['business_id'], quote['total'], quote['details'], quote['contact_id']))
        
        # Marcar como facturada
        cursor.execute("UPDATE quotes SET status = 'invoiced' WHERE id = ?", (quote_id,))
        conn.commit()
        return {"message": "Convertida a factura pendiente exitosamente"}

# --- FASE 18: CATALOGO CONTABLE ---

@app.get("/api/businesses/{business_id}/accounts_catalog")
def get_accounts_catalog(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute("SELECT * FROM accounts_catalog WHERE business_id = ? ORDER BY code ASC", (business_id,))
        return [dict(a) for a in cursor.fetchall()]

@app.post("/api/businesses/{business_id}/accounts_catalog")
def create_account_catalog(business_id: int, account: AccountCatalogCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute(
            "INSERT INTO accounts_catalog (business_id, code, name, type, parent_id) VALUES (?, ?, ?, ?, ?)",
            (business_id, account.code, account.name, account.type, account.parent_id)
        )
        conn.commit()
        return {"message": "Cuenta agregada exitosamente", "id": cursor.lastrowid}

# --- FASE 19: LIBRO DIARIO (ASIENTOS) ---

@app.get("/api/businesses/{business_id}/journal_entries")
def get_journal_entries(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute("SELECT * FROM journal_entries WHERE business_id = ? ORDER BY date DESC", (business_id,))
        entries = [dict(e) for e in cursor.fetchall()]
        
        for e in entries:
            cursor.execute('''
                SELECT l.*, a.code, a.name 
                FROM journal_lines l 
                JOIN accounts_catalog a ON l.account_id = a.id 
                WHERE l.entry_id = ?
            ''', (e['id'],))
            e['lines'] = [dict(l) for l in cursor.fetchall()]
            
        return entries

@app.post("/api/businesses/{business_id}/journal_entries")
def create_journal_entry(business_id: int, entry: JournalEntryCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        # Validar partida doble
        total_debit = sum(l.debit for l in entry.lines)
        total_credit = sum(l.credit for l in entry.lines)
        if abs(total_debit - total_credit) > 0.01:
            raise HTTPException(status_code=400, detail="El asiento no cuadra (DÃ©bitos != CrÃ©ditos)")
            
        cursor.execute(
            "INSERT INTO journal_entries (business_id, date, description, reference_type, reference_id) VALUES (?, ?, ?, ?, ?)",
            (business_id, entry.date, entry.description, entry.reference_type, entry.reference_id)
        )
        entry_id = cursor.lastrowid
        
        for line in entry.lines:
            cursor.execute(
                "INSERT INTO journal_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)",
                (entry_id, line.account_id, line.debit, line.credit)
            )
            
        conn.commit()
        return {"message": "Asiento registrado", "id": entry_id}

# --- FASE 20: ESTADOS FINANCIEROS ---

@app.get("/api/businesses/{business_id}/financial_statements")
def get_financial_statements(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute('''
            SELECT a.code, a.name, a.type, 
                   COALESCE(SUM(l.debit), 0) as total_debit, 
                   COALESCE(SUM(l.credit), 0) as total_credit
            FROM accounts_catalog a
            LEFT JOIN journal_lines l ON a.id = l.account_id
            WHERE a.business_id = ?
            GROUP BY a.id
            ORDER BY a.code ASC
        ''', (business_id,))
        accounts = [dict(r) for r in cursor.fetchall()]
        
        # Calcular saldos naturales
        for acc in accounts:
            if acc['type'] in ['asset', 'expense']:
                acc['balance'] = acc['total_debit'] - acc['total_credit']
            else:
                acc['balance'] = acc['total_credit'] - acc['total_debit']
                
        return accounts

# --- Endpoints de Gastos Recurrentes (Suscripciones) ---

@app.post("/api/recurring_expenses")
def create_recurring(expense: RecurringExpenseCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (expense.business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute('''
            INSERT INTO recurring_expenses (business_id, category, description, amount, day_of_month)
            VALUES (?, ?, ?, ?, ?)
        ''', (expense.business_id, expense.category, expense.description, expense.amount, expense.day_of_month))
        conn.commit()
        return {"message": "Gasto recurrente creado", "id": cursor.lastrowid}

@app.get("/api/recurring_expenses")
def get_recurring(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute("SELECT * FROM recurring_expenses WHERE business_id = ?", (business_id,))
        return [dict(r) for r in cursor.fetchall()]

@app.delete("/api/recurring_expenses/{recurring_id}")
def delete_recurring(recurring_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT r.id FROM recurring_expenses r 
            JOIN businesses b ON r.business_id = b.id 
            WHERE r.id = ? AND b.user_id = ?
        ''', (recurring_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Gasto recurrente no encontrado")
            
        cursor.execute("DELETE FROM recurring_expenses WHERE id = ?", (recurring_id,))
        conn.commit()
        return {"message": "Gasto recurrente eliminado"}

from datetime import datetime

@app.post("/api/recurring_expenses/process")
def process_recurring_expenses(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute("SELECT * FROM recurring_expenses WHERE business_id = ?", (business_id,))
        recurrings = cursor.fetchall()
        
        now = datetime.now()
        current_day = now.day
        current_month_str = now.strftime('%Y-%m') # Ej: "2026-06"
        
        injected_count = 0
        for r in recurrings:
            last_processed = r['last_processed']
            
            # CondiciÃ³n para procesar: 
            # 1. Nunca ha sido procesado O 
            # 2. No se ha procesado este mes Y el dÃ­a actual es mayor o igual al day_of_month
            if last_processed != current_month_str and current_day >= r['day_of_month']:
                # Inyectar transacciÃ³n
                cursor.execute('''
                    INSERT INTO transactions (user_id, business_id, type, amount, category, description, hacienda_status)
                    VALUES (?, ?, 'expense', ?, ?, ?, 'Local')
                ''', (user_id, business_id, r['amount'], r['category'], f"[Auto] {r['description']}"))
                
                # Actualizar last_processed
                cursor.execute("UPDATE recurring_expenses SET last_processed = ? WHERE id = ?", (current_month_str, r['id']))
                injected_count += 1
                
        conn.commit()
        return {"message": "Proceso completado", "injected": injected_count}

# --- Endpoints Empleados (NÃ³mina) ---

@app.post("/api/employees")
def create_employee(emp: EmployeeCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (emp.business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute('''
            INSERT INTO employees (business_id, name, identification, base_salary)
            VALUES (?, ?, ?, ?)
        ''', (emp.business_id, emp.name, emp.identification, emp.base_salary))
        conn.commit()
        return {"message": "Empleado registrado", "id": cursor.lastrowid}

@app.get("/api/employees")
def get_employees(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no encontrado")
            
        cursor.execute("SELECT * FROM employees WHERE business_id = ?", (business_id,))
        return [dict(e) for e in cursor.fetchall()]

@app.put("/api/employees/{employee_id}")
def update_employee(employee_id: int, emp: EmployeeUpdate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT e.id FROM employees e 
            JOIN businesses b ON e.business_id = b.id 
            WHERE e.id = ? AND b.user_id = ?
        ''', (employee_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Empleado no encontrado o sin permisos")
            
        updates = []
        params = []
        if emp.name is not None: updates.append("name = ?"); params.append(emp.name)
        if emp.identification is not None: updates.append("identification = ?"); params.append(emp.identification)
        if emp.base_salary is not None: updates.append("base_salary = ?"); params.append(emp.base_salary)
        if emp.is_active is not None: updates.append("is_active = ?"); params.append(1 if emp.is_active else 0)
        
        if not updates:
            return {"message": "Nada que actualizar"}
            
        params.append(employee_id)
        cursor.execute(f"UPDATE employees SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
        return {"message": "Empleado actualizado"}

@app.delete("/api/employees/{employee_id}")
def delete_employee(employee_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT e.id FROM employees e 
            JOIN businesses b ON e.business_id = b.id 
            WHERE e.id = ? AND b.user_id = ?
        ''', (employee_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Empleado no encontrado")
            
        cursor.execute("DELETE FROM employees WHERE id = ?", (employee_id,))
        conn.commit()
        return {"message": "Empleado eliminado"}

@app.post("/api/employees/{employee_id}/pay")
def pay_employee(employee_id: int, pay: EmployeePay, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT e.id, e.business_id, e.name FROM employees e 
            JOIN businesses b ON e.business_id = b.id 
            WHERE e.id = ? AND b.user_id = ?
        ''', (employee_id, user_id))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=403, detail="Empleado no encontrado")
            
        business_id = row['business_id']
        emp_name = row['name']
        
        # Inyectar pago en transactions
        cursor.execute('''
            INSERT INTO transactions (user_id, business_id, type, amount, category, description, is_paid, due_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, business_id, 'expense', pay.amount, 'Planilla/Salario', f"Pago a {emp_name}: {pay.description}", 1, datetime.now().date()))
        tx_id = cursor.lastrowid
        conn.commit()
        return {"message": "Pago registrado en la contabilidad"}

# --- Rutas ConfiguraciÃ³n Hacienda ---
@app.get("/api/hacienda-config")
def get_hacienda_config(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no vÃ¡lido")
            
        cursor.execute("SELECT is_active, atv_username FROM hacienda_config WHERE business_id = ?", (business_id,))
        row = cursor.fetchone()
        if row:
            return {"is_active": bool(row["is_active"]), "atv_username": row["atv_username"], "has_config": True}
        return {"has_config": False}

@app.post("/api/hacienda-config")
def save_hacienda_config(
    business_id: int = Form(...),
    atv_username: str = Form(...),
    atv_password: str = Form(...),
    pin: str = Form(...),
    p12_file: UploadFile = File(None),
    user_id: str = Depends(get_current_user)
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM businesses WHERE id = ? AND user_id = ?", (business_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Negocio no vÃ¡lido")
        
        # Guardar archivo p12 de forma segura
        p12_path = None
        if p12_file and p12_file.filename.endswith('.p12'):
            certs_dir = os.path.join(os.path.dirname(__file__), 'certs')
            os.makedirs(certs_dir, exist_ok=True)
            p12_path = os.path.join(certs_dir, f"cert_biz_{business_id}.p12")
            with open(p12_path, "wb") as buffer:
                shutil.copyfileobj(p12_file.file, buffer)
        
        # Encriptar datos sensibles
        enc_pass = encrypt_data(atv_password)
        enc_pin = encrypt_data(pin)
        
        cursor.execute("SELECT id, p12_file_path FROM hacienda_config WHERE business_id = ?", (business_id,))
        existing = cursor.fetchone()
        
        final_p12_path = p12_path if p12_path else (existing["p12_file_path"] if existing else None)
        # Activar el mÃ³dulo solo si hay archivo, usuario y contraseÃ±a
        is_active = 1 if final_p12_path and atv_username and enc_pass else 0
        
        if existing:
            cursor.execute('''
                UPDATE hacienda_config 
                SET atv_username = ?, atv_password_encrypted = ?, p12_pin_encrypted = ?, p12_file_path = ?, is_active = ?
                WHERE business_id = ?
            ''', (atv_username, enc_pass, enc_pin, final_p12_path, is_active, business_id))
        else:
            cursor.execute('''
                INSERT INTO hacienda_config (business_id, atv_username, atv_password_encrypted, p12_pin_encrypted, p12_file_path, is_active)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (business_id, atv_username, enc_pass, enc_pin, final_p12_path, is_active))
            
        conn.commit()
        return {"message": "ConfiguraciÃ³n protegida y guardada exitosamente", "is_active": bool(is_active)}

# --- Rutas AnÃ¡lisis Financiero ---
@app.get("/api/financial-health")
def get_financial_health(user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Calcular con base en los Ãºltimos 30 dÃ­as para las finanzas de la Casa
        cursor.execute('''
            SELECT type, amount, category FROM transactions 
            WHERE user_id = ? AND business_id IS NULL AND date >= date('now', '-30 days')
        ''', (user_id,))
        txs = cursor.fetchall()
        
        total_income = sum(t["amount"] for t in txs if t["type"] == "income")
        total_expense = sum(t["amount"] for t in txs if t["type"] == "expense")
        
        debt_keywords = ['deuda', 'tarjet', 'prestamo', 'crÃ©dito', 'credito', 'banco', 'cuota', 'hipoteca']
        total_debt_payments = 0
        expense_breakdown = []
        
        for t in txs:
            if t["type"] == "expense":
                is_debt = any(kw in t["category"].lower() for kw in debt_keywords)
                if is_debt:
                    total_debt_payments += t["amount"]
                
                percentage = (t["amount"] / total_income * 100) if total_income > 0 else 0
                expense_breakdown.append({
                    "category": t["category"],
                    "amount": t["amount"],
                    "is_debt": is_debt,
                    "percentage_of_income": round(percentage, 2)
                })
        
        debt_margin = (total_debt_payments / total_income * 100) if total_income > 0 else 0
        available_money = total_income - total_expense
        
        if debt_margin <= 30:
            health_status = "Excelente"
            advice = "Tus deudas estÃ¡n bajo control. Tienes buena capacidad crediticia."
        elif debt_margin <= 45:
            health_status = "PrecauciÃ³n"
            advice = "EstÃ¡s llegando al lÃ­mite de endeudamiento recomendado por SUGEF. Evita nuevos crÃ©ditos."
        else:
            health_status = "Peligro CrÃ­tico"
            advice = "Â¡ALERTA ROJA! EstÃ¡s sobreendeudado. Aplica el mÃ©todo Bola de Nieve: usa tu disponible para liquidar primero la deuda mÃ¡s pequeÃ±a."
            
        return {
            "total_income": total_income,
            "total_expense": total_expense,
            "total_debt_payments": total_debt_payments,
            "available_money": available_money,
            "debt_margin_percentage": round(debt_margin, 2),
            "health_status": health_status,
            "advice": advice,
            "expense_breakdown": sorted(expense_breakdown, key=lambda x: x["amount"], reverse=True)
        }

# --- Servir Frontend (PWA) ---
app_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "app")

@app.get("/api/hacienda-status/{tx_id}")
def check_hacienda_status(tx_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT business_id, hacienda_location FROM transactions WHERE id = ? AND user_id = ?", (tx_id, user_id))
        tx = cursor.fetchone()
        if not tx:
            raise HTTPException(status_code=404, detail="TransacciÃ³n no encontrada")
            
        location = tx["hacienda_location"]
        if not location:
            return {"status": "borrador", "message": "No hay un envÃ­o activo a Hacienda para esta factura."}
            
        # Cargar credenciales del negocio para token
        cursor.execute("SELECT atv_username, atv_password_encrypted FROM hacienda_config WHERE business_id = ? AND is_active = 1", (tx["business_id"],))
        h_conf = cursor.fetchone()
        if not h_conf:
            raise HTTPException(status_code=400, detail="ConfiguraciÃ³n de Hacienda inactiva.")
            
        from .hacienda_service import obtener_token, consultar_estado
        try:
            atv_pass_descifrado = decrypt_data(h_conf["atv_password_encrypted"])
            token = obtener_token(h_conf["atv_username"], atv_pass_descifrado)
            res = consultar_estado(location, token)
            
            # Actualizar DB
            nuevo_estado = res["status"]
            cursor.execute("UPDATE transactions SET hacienda_status = ? WHERE id = ?", (nuevo_estado, tx_id))
            conn.commit()
            
            return res
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(app_dir, "index.html"))

@app.get("/.well-known/assetlinks.json")
def serve_assetlinks():
    return FileResponse(os.path.join(app_dir, ".well-known", "assetlinks.json"))

# --- FASE 34: PRESUPUESTOS (SOBRES) ---
@app.get("/api/businesses/{business_id}/budget_envelopes")
def get_budget_envelopes(business_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM budget_envelopes WHERE business_id = ?", (business_id,))
        envelopes = [dict(a) for a in cursor.fetchall()]
        
        # Calculate spent this month
        import datetime
        current_month = datetime.datetime.now().strftime('%Y-%m')
        
        for env in envelopes:
            cursor.execute('''
                SELECT SUM(amount) as spent 
                FROM transactions 
                WHERE business_id = ? AND type = 'expense' AND category = ? AND date LIKE ?
            ''', (business_id, env['category'], f"{current_month}%"))
            spent = cursor.fetchone()['spent'] or 0.0
            env['spent'] = spent
            env['remaining'] = env['budget_amount'] - spent
            
        return envelopes

@app.post("/api/businesses/{business_id}/budget_envelopes")
def create_budget_envelope(business_id: int, env: BudgetEnvelopeCreate, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO budget_envelopes (business_id, category, budget_amount)
            VALUES (?, ?, ?)
        ''', (business_id, env.category, env.budget_amount))
        conn.commit()
        return {"message": "Sobre de presupuesto creado exitosamente"}

@app.delete("/api/budget_envelopes/{env_id}")
def delete_budget_envelope(env_id: int, user_id: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM budget_envelopes WHERE id = ?", (env_id,))
        conn.commit()
        return {"message": "Sobre eliminado exitosamente"}

import re

@app.post("/api/businesses/{business_id}/sinpe_parse")
def parse_sinpe(business_id: int, req: SinpeParseRequest, user_id: str = Depends(get_current_user)):
    # Regex bÃ¡sico para formato: "Sinpe Movil: ... por un monto de CRC xxx.xx ... Referencia: 123456"
    text = req.sms_text.replace('\n', ' ')
    
    amount_match = re.search(r'(?:monto de|CRC|Â¢)\s*([\d,]+(?:\.\d{2})?)', text, re.IGNORECASE)
    ref_match = re.search(r'(?:Referencia|Ref|Comprobante)[:\s]*(\d+)', text, re.IGNORECASE)
    
    if not amount_match:
        raise HTTPException(status_code=400, detail="No se pudo detectar el monto en el mensaje.")
        
    amount_str = amount_match.group(1).replace(',', '')
    amount = float(amount_str)
    reference = ref_match.group(1) if ref_match else "Desconocida"
    
    return {
        "success": True,
        "amount": amount,
        "reference": reference,
        "description": f"Sinpe MÃ³vil Ref: {reference}"
    }

@app.get("/{full_path:path}")
def catch_all(full_path: str):
    # Ignorar rutas de API
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")
        
    file_path = os.path.join(app_dir, full_path)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    # Redirigir a index.html para soportar enrutamiento SPA
    return FileResponse(os.path.join(app_dir, "index.html"))


