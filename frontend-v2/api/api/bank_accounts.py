from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..models import models
from .businesses import get_current_user
from .dependencies import get_business_with_roles
from pydantic import BaseModel
from typing import Optional

class BankAccountCreate(BaseModel):
    name: str
    currency: str = "CRC"
    initial_balance: float = 0.0

class BankAccountResponse(BankAccountCreate):
    id: int
    business_id: int
    current_balance: float
    class Config:
        from_attributes = True

router = APIRouter(prefix="/api/businesses/{business_id}/bank_accounts", tags=["bank_accounts"])

@router.get("", response_model=list[BankAccountResponse])
def get_bank_accounts(business_id: int, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    get_business_with_roles(business_id, db, user_id)
    return db.query(models.BankAccount).filter(models.BankAccount.business_id == business_id).all()

@router.post("", response_model=BankAccountResponse)
def create_bank_account(business_id: int, account: BankAccountCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    get_business_with_roles(business_id, db, user_id)
    new_acc = models.BankAccount(
        **account.dict(), 
        business_id=business_id,
        current_balance=account.initial_balance
    )
    db.add(new_acc)
    db.commit()
    db.refresh(new_acc)
    return new_acc
