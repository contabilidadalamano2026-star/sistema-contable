from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from db.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    password_hash = Column(String)
    role = Column(String, default="owner") # owner, cashier, accountant
    assigned_business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True) # For sub-users
    businesses = relationship("Business", foreign_keys="[Business.user_id]", back_populates="owner")

class Business(Base):
    __tablename__ = "businesses"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    tax_id = Column(String)
    currency = Column(String, default="CRC")
    industry = Column(String)
    
    owner = relationship("User", foreign_keys=[user_id], back_populates="businesses")
    transactions = relationship("Transaction", back_populates="business")
    products = relationship("Product", back_populates="business")
    bank_accounts = relationship("BankAccount", back_populates="business")
    contacts = relationship("Contact", back_populates="business")
    employees = relationship("Employee", back_populates="business")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    business_id = Column(Integer, ForeignKey("businesses.id"))
    user_id = Column(String, ForeignKey("users.id"))
    type = Column(String) # 'income', 'expense'
    amount = Column(Float)
    category = Column(String)
    description = Column(String)
    date = Column(String)
    account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=True)
    is_paid = Column(Boolean, default=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    invoice_number = Column(String, nullable=True)
    exchange_rate = Column(Float, default=1.0)
    document_type = Column(String, default="01") # Hacienda type
    
    business = relationship("Business", back_populates="transactions")
    account = relationship("BankAccount", back_populates="transactions")
    contact = relationship("Contact")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, autoincrement=True)
    business_id = Column(Integer, ForeignKey("businesses.id"))
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    iva_rate = Column(Integer, default=13)
    stock = Column(Integer, default=0)
    average_cost = Column(Float, default=0.0) # MAC (Moving Average Cost)
    
    business = relationship("Business", back_populates="products")

class BankAccount(Base):
    __tablename__ = "bank_accounts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    business_id = Column(Integer, ForeignKey("businesses.id"))
    name = Column(String)
    currency = Column(String, default="CRC")
    initial_balance = Column(Float, default=0.0)
    current_balance = Column(Float, default=0.0)
    
    business = relationship("Business", back_populates="bank_accounts")
    transactions = relationship("Transaction", back_populates="account")

class Contact(Base):
    __tablename__ = "contacts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    business_id = Column(Integer, ForeignKey("businesses.id"))
    name = Column(String)
    role = Column(String) # client, provider, both
    email = Column(String)
    phone = Column(String)
    tax_id = Column(String)
    points = Column(Float, default=0.0)
    
    business = relationship("Business", back_populates="contacts")

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, autoincrement=True)
    business_id = Column(Integer, ForeignKey("businesses.id"))
    name = Column(String)
    identification = Column(String)
    base_salary = Column(Float)
    is_active = Column(Boolean, default=True)
    
    business = relationship("Business", back_populates="employees")

class AccountCatalog(Base):
    __tablename__ = "accounts_catalog"
    id = Column(Integer, primary_key=True, autoincrement=True)
    business_id = Column(Integer, ForeignKey("businesses.id"))
    code = Column(String)
    name = Column(String)
    type = Column(String) # Asset, Liability, Equity, Revenue, Expense
    is_active = Column(Boolean, default=True)

class JournalLine(Base):
    __tablename__ = "journal_lines"
    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"))
    account_id = Column(Integer, ForeignKey("accounts_catalog.id"))
    debit = Column(Float, default=0.0)
    credit = Column(Float, default=0.0)
    
    transaction = relationship("Transaction")
    account = relationship("AccountCatalog")
