from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.database import get_db
from models import models
from api.businesses import get_current_user
from api.dependencies import get_business_with_roles

router = APIRouter(prefix="/api/businesses/{business_id}/reports", tags=["reports"])

@router.get("/income-statement")
def get_income_statement(business_id: int, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    get_business_with_roles(business_id, db, user_id)
    
    # Calculate Total Revenue
    revenue = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.business_id == business_id,
        models.Transaction.type == 'income'
    ).scalar() or 0.0
    
    # Calculate Total Expenses
    expenses = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.business_id == business_id,
        models.Transaction.type == 'expense'
    ).scalar() or 0.0
    
    net_income = revenue - expenses
    
    return {
        "revenue": revenue,
        "expenses": expenses,
        "net_income": net_income
    }

@router.get("/tax-d104")
def get_tax_d104(business_id: int, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    get_business_with_roles(business_id, db, user_id)
    
    # In a real app we would join Transactions with Invoices and InvoiceItems
    # For now, we simulate the breakdown from total revenue
    revenue = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.business_id == business_id,
        models.Transaction.type == 'income'
    ).scalar() or 0.0
    
    # Assume generic breakdown for testing
    return {
        "ventas": {
            "exentas": revenue * 0.1,
            "iva_1": revenue * 0.0,
            "iva_2": revenue * 0.1,
            "iva_4": revenue * 0.0,
            "iva_13": revenue * 0.8
        },
        "compras": {
            "exentas": 0,
            "iva_13": 0
        },
        "total_iva_pagar": (revenue * 0.8) * 0.13
    }

