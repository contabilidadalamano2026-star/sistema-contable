import sqlite3
from contextlib import contextmanager
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'contabilidad.db')

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Tabla de Usuarios
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Tabla de Negocios
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS businesses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                legal_id TEXT, -- Cédula jurídica o física
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # Tabla de Transacciones (Casa y Negocios)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                business_id INTEGER, -- Null significa que es un gasto/ingreso de "La Casa"
                type TEXT NOT NULL, -- 'income' o 'expense'
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                description TEXT,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (business_id) REFERENCES businesses (id)
            )
        ''')
        # Añadir columnas para Hacienda dinámicamente si no existen
        try:
            cursor.execute("ALTER TABLE transactions ADD COLUMN hacienda_status TEXT")
            cursor.execute("ALTER TABLE transactions ADD COLUMN hacienda_response TEXT")
        except:
            pass
            
        # Añadir columnas de Crédito/Cuentas por Cobrar
        try:
            cursor.execute("ALTER TABLE transactions ADD COLUMN is_paid BOOLEAN DEFAULT 1")
            cursor.execute("ALTER TABLE transactions ADD COLUMN due_date TEXT")
        except:
            pass
            
        # Añadir columnas de Moneda (Fase 10)
        try:
            cursor.execute("ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT 'CRC'")
            cursor.execute("ALTER TABLE transactions ADD COLUMN exchange_rate REAL DEFAULT 1.0")
        except:
            pass
            
        # Añadir columnas IVA (Fase 11)
        try:
            cursor.execute("ALTER TABLE transactions ADD COLUMN subtotal REAL DEFAULT 0.0")
            cursor.execute("ALTER TABLE transactions ADD COLUMN iva_amount REAL DEFAULT 0.0")
        except:
            pass
            
        # Añadir cuenta bancaria (Fase 12)
        try:
            cursor.execute("ALTER TABLE transactions ADD COLUMN account_id INTEGER")
        except:
            pass
            
        # Añadir contacto a transaccion (Fases 13-14)
        try:
            cursor.execute("ALTER TABLE transactions ADD COLUMN contact_id INTEGER")
        except:
            pass
            
        try:
            cursor.execute("ALTER TABLE transactions ADD COLUMN hacienda_clave TEXT")
        except sqlite3.OperationalError:
            pass # Ya existe
            
        try:
            cursor.execute("ALTER TABLE transactions ADD COLUMN hacienda_location TEXT")
        except sqlite3.OperationalError:
            pass # Ya existe

        # Tabla de Configuración de Hacienda (Opcional por Negocio)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS payroll_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER,
                run_date TEXT,
                start_date TEXT,
                end_date TEXT,
                total_salaries REAL,
                total_deductions REAL,
                total_net REAL
            )
        ''')
        
        # FASE 12: Cuentas Bancarias
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS bank_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER,
                name TEXT,
                currency TEXT DEFAULT 'CRC',
                initial_balance REAL DEFAULT 0.0,
                FOREIGN KEY(business_id) REFERENCES businesses(id)
            )
        ''')
        
        # FASES 13-14: CRM Clientes y Proveedores (Contactos)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER,
                name TEXT NOT NULL,
                tax_id TEXT,
                email TEXT,
                phone TEXT,
                role TEXT DEFAULT 'client', -- 'client', 'provider', 'both'
                FOREIGN KEY(business_id) REFERENCES businesses(id)
            )
        ''')
        
        # FASE 16: Proformas y Cotizaciones
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS quotes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER,
                contact_id INTEGER,
                date TEXT,
                total REAL,
                details TEXT,
                status TEXT DEFAULT 'pending', -- 'pending', 'invoiced', 'rejected'
                FOREIGN KEY(business_id) REFERENCES businesses(id)
            )
        ''')
        
        # FASE 17: Pagos y Abonos (CXC/CXP)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER,
                date TEXT,
                amount REAL,
                account_id INTEGER,
                FOREIGN KEY(transaction_id) REFERENCES transactions(id),
                FOREIGN KEY(account_id) REFERENCES bank_accounts(id)
            )
        ''')
        
        # FASE 18: Catálogo Contable
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS accounts_catalog (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER,
                code TEXT,
                name TEXT,
                type TEXT, -- 'asset', 'liability', 'equity', 'revenue', 'expense'
                parent_id INTEGER NULL,
                FOREIGN KEY(business_id) REFERENCES businesses(id),
                FOREIGN KEY(parent_id) REFERENCES accounts_catalog(id)
            )
        ''')

        # FASE 19: Asientos de Diario
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS journal_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER,
                date TEXT,
                description TEXT,
                reference_type TEXT, -- 'transaction', 'payment', 'manual'
                reference_id INTEGER NULL,
                FOREIGN KEY(business_id) REFERENCES businesses(id)
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS journal_lines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id INTEGER,
                account_id INTEGER,
                debit REAL DEFAULT 0,
                credit REAL DEFAULT 0,
                FOREIGN KEY(entry_id) REFERENCES journal_entries(id),
                FOREIGN KEY(account_id) REFERENCES accounts_catalog(id)
            )
        ''')

        # FASE 21: MULTI-USUARIO
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'owner'")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN parent_id INTEGER NULL")
        except sqlite3.OperationalError:
            pass
        # FASE 22: Control de Inventario Avanzado (Bodegas y Movimientos)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS warehouses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER,
                name TEXT,
                FOREIGN KEY(business_id) REFERENCES businesses(id)
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS product_stock (
                product_id INTEGER,
                warehouse_id INTEGER,
                quantity INTEGER DEFAULT 0,
                PRIMARY KEY (product_id, warehouse_id),
                FOREIGN KEY(product_id) REFERENCES products(id),
                FOREIGN KEY(warehouse_id) REFERENCES warehouses(id)
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS inventory_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER,
                warehouse_id INTEGER,
                type TEXT, -- 'IN' or 'OUT'
                quantity INTEGER,
                date TEXT,
                reference TEXT,
                FOREIGN KEY(product_id) REFERENCES products(id),
                FOREIGN KEY(warehouse_id) REFERENCES warehouses(id)
            )
        ''')

        # FASE 23: Órdenes de Compra
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS purchase_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER,
                contact_id INTEGER,
                date TEXT,
                status TEXT DEFAULT 'pending', -- 'pending', 'received', 'cancelled'
                total REAL,
                notes TEXT,
                FOREIGN KEY(business_id) REFERENCES businesses(id),
                FOREIGN KEY(contact_id) REFERENCES contacts(id)
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS purchase_order_lines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER,
                product_id INTEGER,
                quantity INTEGER,
                price REAL,
                FOREIGN KEY(order_id) REFERENCES purchase_orders(id),
                FOREIGN KEY(product_id) REFERENCES products(id)
            )
        ''')

        # FASE 25: Activos Fijos y Depreciación
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS fixed_assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER,
                name TEXT,
                value REAL,
                purchase_date TEXT,
                lifespan_years INTEGER,
                depreciation_rate REAL,
                accumulated_depreciation REAL DEFAULT 0,
                FOREIGN KEY(business_id) REFERENCES businesses(id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS hacienda_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER UNIQUE NOT NULL,
                atv_username TEXT,
                atv_password_encrypted TEXT,
                p12_pin_encrypted TEXT,
                p12_file_path TEXT,
                is_active BOOLEAN DEFAULT 0,
                FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
            )
        ''')
        
        # Tabla de Productos/Servicios (Inventario)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                iva_rate INTEGER DEFAULT 13,
                stock INTEGER DEFAULT 0,
                FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
            )
        ''')
        
        # Tabla de Gastos Recurrentes (Suscripciones, Alquileres)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS recurring_expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                amount REAL NOT NULL,
                day_of_month INTEGER NOT NULL,
                last_processed TEXT,
                FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
            )
        ''')
        
        # Tabla de Empleados (Nómina/Planilla)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                identification TEXT,
                base_salary REAL NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
            )
        ''')
        
        # FASES 33-34: Puntos y Presupuestos
        try:
            cursor.execute("ALTER TABLE contacts ADD COLUMN points REAL DEFAULT 0")
        except sqlite3.OperationalError:
            pass # Columna ya existe
            
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS budget_envelopes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER,
                category TEXT NOT NULL,
                budget_amount REAL DEFAULT 0,
                FOREIGN KEY(business_id) REFERENCES businesses(id)
            )
        ''')
        
        conn.commit()

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# --- Módulo de Seguridad: Encriptación para credenciales de Hacienda ---
from cryptography.fernet import Fernet
import base64

SECRET_KEY_PATH = os.path.join(os.path.dirname(__file__), '.hacienda_secret')

def _get_encryption_key():
    if not os.path.exists(SECRET_KEY_PATH):
        # Generar nueva clave maestra
        key = Fernet.generate_key()
        with open(SECRET_KEY_PATH, 'wb') as f:
            f.write(key)
        return key
    else:
        with open(SECRET_KEY_PATH, 'rb') as f:
            return f.read()

cipher_suite = Fernet(_get_encryption_key())

def encrypt_data(data: str) -> str:
    if not data:
        return ""
    return cipher_suite.encrypt(data.encode('utf-8')).decode('utf-8')

def decrypt_data(token: str) -> str:
    if not token:
        return ""
    try:
        return cipher_suite.decrypt(token.encode('utf-8')).decode('utf-8')
    except Exception:
        return ""

