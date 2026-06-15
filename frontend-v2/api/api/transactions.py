from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from ..db.database import get_db
from ..models import models
from ..schemas import schemas
from .businesses import get_current_user
from .dependencies import get_business_with_roles

router = APIRouter(prefix="/api/businesses/{business_id}/transactions", tags=["transactions"])

@router.get("", response_model=list[schemas.TransactionResponse])
def get_transactions(business_id: int, limit: int = 100, offset: int = 0, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    get_business_with_roles(business_id, db, user_id)
    return db.query(models.Transaction).filter(models.Transaction.business_id == business_id).order_by(models.Transaction.date.desc()).limit(limit).offset(offset).all()

@router.post("", response_model=schemas.TransactionResponse)
def create_transaction(business_id: int, tx: schemas.TransactionCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    get_business_with_roles(business_id, db, user_id)
    
    date_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    new_tx = models.Transaction(**tx.dict(), business_id=business_id, user_id=user_id, date=date_str)
    db.add(new_tx)
    db.flush() # get new_tx.id
    
    # Update account balance if needed
    if tx.account_id and tx.is_paid:
        acc = db.query(models.BankAccount).filter(models.BankAccount.id == tx.account_id, models.BankAccount.business_id == business_id).first()
        if acc:
            if tx.type == 'income':
                acc.current_balance += tx.amount
            elif tx.type == 'expense':
                acc.current_balance -= tx.amount
                
    # Double Entry Accounting (Partida Doble Automática)
    # Get or create default accounts for this category
    cash_acc = db.query(models.AccountCatalog).filter(models.AccountCatalog.business_id == business_id, models.AccountCatalog.type == 'Asset', models.AccountCatalog.name == 'Efectivo/Bancos').first()
    if not cash_acc:
        cash_acc = models.AccountCatalog(business_id=business_id, code='1000', name='Efectivo/Bancos', type='Asset')
        db.add(cash_acc)
        db.flush()
        
    revenue_acc = db.query(models.AccountCatalog).filter(models.AccountCatalog.business_id == business_id, models.AccountCatalog.type == 'Revenue', models.AccountCatalog.name == 'Ingresos Generales').first()
    if not revenue_acc:
        revenue_acc = models.AccountCatalog(business_id=business_id, code='4000', name='Ingresos Generales', type='Revenue')
        db.add(revenue_acc)
        db.flush()
        
    expense_acc = db.query(models.AccountCatalog).filter(models.AccountCatalog.business_id == business_id, models.AccountCatalog.type == 'Expense', models.AccountCatalog.name == 'Gastos Generales').first()
    if not expense_acc:
        expense_acc = models.AccountCatalog(business_id=business_id, code='5000', name='Gastos Generales', type='Expense')
        db.add(expense_acc)
        db.flush()

    if tx.type == 'income':
        db.add(models.JournalLine(transaction_id=new_tx.id, account_id=cash_acc.id, debit=tx.amount, credit=0.0))
        db.add(models.JournalLine(transaction_id=new_tx.id, account_id=revenue_acc.id, debit=0.0, credit=tx.amount))
    elif tx.type == 'expense':
        db.add(models.JournalLine(transaction_id=new_tx.id, account_id=expense_acc.id, debit=tx.amount, credit=0.0))
        db.add(models.JournalLine(transaction_id=new_tx.id, account_id=cash_acc.id, debit=0.0, credit=tx.amount))

    db.commit()
    db.refresh(new_tx)
    return new_tx
