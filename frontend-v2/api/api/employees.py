from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db
from models import models
from api.businesses import get_current_user
from api.dependencies import get_business_with_roles
from pydantic import BaseModel
from typing import Optional

class EmployeeCreate(BaseModel):
    name: str
    identification: str
    base_salary: float
    is_active: bool = True

class EmployeeResponse(EmployeeCreate):
    id: int
    business_id: int
    class Config:
        from_attributes = True

router = APIRouter(prefix="/api/businesses/{business_id}/employees", tags=["employees"])

@router.get("", response_model=list[EmployeeResponse])
def get_employees(business_id: int, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    get_business_with_roles(business_id, db, user_id)
    return db.query(models.Employee).filter(models.Employee.business_id == business_id).all()

@router.post("", response_model=EmployeeResponse)
def create_employee(business_id: int, emp: EmployeeCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    get_business_with_roles(business_id, db, user_id)
    new_emp = models.Employee(**emp.dict(), business_id=business_id)
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)
    return new_emp
