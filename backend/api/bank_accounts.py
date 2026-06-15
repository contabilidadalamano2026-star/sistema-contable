from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db
from models import models
from api.businesses import get_current_user
from api.dependencies import get_business_with_roles, require_accountant
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

router = APIRouter(prefix="/api/businesses/{business_id}/bank_accounts", tags=["bank_accounts"], dependencies=[Depends(require_accountant)])

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

class BankMovement(BaseModel):
    date: str
    description: str
    amount: float

class ReconciliationRequest(BaseModel):
    movements: list[BankMovement]

@router.post("/{acc_id}/reconcile")
def reconcile_bank_account(business_id: int, acc_id: int, req: ReconciliationRequest, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    get_business_with_roles(business_id, db, user_id)
    
    # Get all transactions for this account in the system
    local_txs = db.query(models.Transaction).filter(
        models.Transaction.business_id == business_id,
        models.Transaction.account_id == acc_id
    ).all()
    
    matches = []
    unmatched_bank = []
    unmatched_local = [tx for tx in local_txs]
    
    for mov in req.movements:
        # Simple matching algorithm by exact amount and similar date
        # In a real system, you'd allow tolerance and better text similarity
        match = next((tx for tx in unmatched_local if abs(tx.amount - abs(mov.amount)) < 0.01), None)
        if match:
            matches.append({
                "bank": mov.dict(),
                "local": {
                    "id": match.id,
                    "date": match.date,
                    "description": match.description,
                    "amount": match.amount,
                    "type": match.type
                }
            })
            unmatched_local.remove(match)
        else:
            unmatched_bank.append(mov.dict())
            
    return {
        "matches": matches,
        "unmatched_bank": unmatched_bank,
        "unmatched_local": [{
            "id": tx.id,
            "date": tx.date,
            "description": tx.description,
            "amount": tx.amount,
            "type": tx.type
        } for tx in unmatched_local]
    }

