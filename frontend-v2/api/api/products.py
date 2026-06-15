from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db
from models import models
from api.businesses import get_current_user
from api.dependencies import get_business_with_roles
from pydantic import BaseModel
from typing import Optional

class ProductCreate(BaseModel):
    name: str
    price: float
    iva_rate: int = 13
    stock: int = 0

class ProductResponse(ProductCreate):
    id: int
    business_id: int
    class Config:
        from_attributes = True

router = APIRouter(prefix="/api/businesses/{business_id}/products", tags=["products"])

@router.get("", response_model=list[ProductResponse])
def get_products(business_id: int, limit: int = 100, offset: int = 0, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    get_business_with_roles(business_id, db, user_id)
    return db.query(models.Product).filter(models.Product.business_id == business_id).limit(limit).offset(offset).all()

@router.post("", response_model=ProductResponse)
def create_product(business_id: int, product: ProductCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    get_business_with_roles(business_id, db, user_id)
    new_prod = models.Product(**product.dict(), business_id=business_id)
    db.add(new_prod)
    db.commit()
    db.refresh(new_prod)
    return new_prod

class ProductPurchase(BaseModel):
    quantity: int
    unit_cost: float

@router.post("/{product_id}/purchase", response_model=ProductResponse)
def purchase_product(business_id: int, product_id: int, purchase: ProductPurchase, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    get_business_with_roles(business_id, db, user_id)
    prod = db.query(models.Product).filter(models.Product.id == product_id, models.Product.business_id == business_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
        
    # Moving Average Cost (MAC) Calculation
    old_value = prod.stock * prod.average_cost
    new_value = purchase.quantity * purchase.unit_cost
    total_qty = prod.stock + purchase.quantity
    
    if total_qty > 0:
        prod.average_cost = (old_value + new_value) / total_qty
    
    prod.stock = total_qty
    db.commit()
    db.refresh(prod)
    return prod
