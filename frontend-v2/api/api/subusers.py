from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..models import models
from .businesses import get_current_user
from pydantic import BaseModel
from typing import Optional
from .auth import get_password_hash

class SubUserCreate(BaseModel):
    id: str
    password: str
    role: str # cashier, accountant

class SubUserResponse(BaseModel):
    id: str
    role: str
    assigned_business_id: int
    class Config:
        from_attributes = True

router = APIRouter(prefix="/api/businesses/{business_id}/subusers", tags=["subusers"])

def check_is_owner(db: Session, business_id: int, user_id: str):
    # Only the owner of the business can create subusers
    biz = db.query(models.Business).filter(models.Business.id == business_id, models.Business.user_id == user_id).first()
    if not biz:
        raise HTTPException(status_code=403, detail="No tienes permiso para gestionar esta empresa")
    return biz

@router.post("", response_model=SubUserResponse)
def create_subuser(business_id: int, subuser: SubUserCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    check_is_owner(db, business_id, user_id)
    
    # Check if user id exists
    existing = db.query(models.User).filter(models.User.id == subuser.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Este ID de usuario ya está en uso")
        
    hashed_pw = get_password_hash(subuser.password)
    new_user = models.User(
        id=subuser.id,
        password_hash=hashed_pw,
        role=subuser.role,
        assigned_business_id=business_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("", response_model=list[SubUserResponse])
def get_subusers(business_id: int, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    check_is_owner(db, business_id, user_id)
    return db.query(models.User).filter(models.User.assigned_business_id == business_id).all()
