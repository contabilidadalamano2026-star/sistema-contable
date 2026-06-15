from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db
from models import models
from api.businesses import get_current_user
from api.dependencies import get_business_with_roles
from pydantic import BaseModel
from typing import Optional

class ContactCreate(BaseModel):
    name: str
    role: str
    email: Optional[str] = None
    phone: Optional[str] = None
    tax_id: Optional[str] = None

class ContactResponse(ContactCreate):
    id: int
    business_id: int
    points: float
    class Config:
        from_attributes = True

router = APIRouter(prefix="/api/businesses/{business_id}/contacts", tags=["contacts"])

@router.get("", response_model=list[ContactResponse])
def get_contacts(business_id: int, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    get_business_with_roles(business_id, db, user_id)
    return db.query(models.Contact).filter(models.Contact.business_id == business_id).all()

@router.post("", response_model=ContactResponse)
def create_contact(business_id: int, contact: ContactCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    get_business_with_roles(business_id, db, user_id)
    new_contact = models.Contact(**contact.dict(), business_id=business_id)
    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)
    return new_contact
