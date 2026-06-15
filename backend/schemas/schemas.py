from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    id: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    class Config:
        from_attributes = True

class BusinessBase(BaseModel):
    name: str
    tax_id: Optional[str] = None
    currency: str = "CRC"
    industry: Optional[str] = None

class BusinessCreate(BusinessBase):
    pass

class BusinessResponse(BusinessBase):
    id: int
    user_id: str
    class Config:
        from_attributes = True

class TransactionCreate(BaseModel):
    type: str
    amount: float
    category: str
    description: str
    account_id: Optional[int] = None
    contact_id: Optional[int] = None
    is_paid: bool = True
    invoice_number: Optional[str] = None
    exchange_rate: float = 1.0

class TransactionResponse(TransactionCreate):
    id: int
    date: str
    class Config:
        from_attributes = True

class BankAccountCreate(BaseModel):
    name: str
    currency: str = "CRC"
    initial_balance: float = 0.0

class BankAccountResponse(BankAccountCreate):
    id: int
    current_balance: float
    class Config:
        from_attributes = True

class OpportunityBase(BaseModel):
    title: str
    description: Optional[str] = None
    amount: float = 0.0
    status: str = "Lead"
    contact_id: Optional[int] = None
    expected_close_date: Optional[str] = None

class OpportunityCreate(OpportunityBase):
    pass

class OpportunityResponse(OpportunityBase):
    id: int
    business_id: int
    created_at: datetime
    class Config:
        from_attributes = True

class InvoiceItem(BaseModel):
    name: str
    price: float
    qty: int = 1
    iva_rate: float = 13.0
    is_service: bool = False
    cabys: str = "8999901000000"

class InvoiceCreate(BaseModel):
    client_name: str
    client_id: str
    items: List[InvoiceItem]
    currency: str = "CRC"

