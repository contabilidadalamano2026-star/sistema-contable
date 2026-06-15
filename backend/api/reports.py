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
