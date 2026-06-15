from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from db.database import get_db
from models import models
from schemas import schemas
from api.dependencies import get_business_with_roles

router = APIRouter(prefix="/opportunities", tags=["opportunities"])

@router.post("/", response_model=schemas.OpportunityResponse)
def create_opportunity(
    opp: schemas.OpportunityCreate,
    db: Session = Depends(get_db),
    business: models.Business = Depends(get_business_with_roles(["owner", "sales"]))
):
    db_opp = models.Opportunity(**opp.dict(), business_id=business.id)
    db.add(db_opp)
    db.commit()
    db.refresh(db_opp)
    return db_opp

@router.get("/", response_model=List[schemas.OpportunityResponse])
def get_opportunities(
    db: Session = Depends(get_db),
    business: models.Business = Depends(get_business_with_roles(["owner", "sales", "accountant"]))
):
    return db.query(models.Opportunity).filter(models.Opportunity.business_id == business.id).all()

@router.put("/{opp_id}", response_model=schemas.OpportunityResponse)
def update_opportunity(
    opp_id: int,
    opp: schemas.OpportunityCreate,
    db: Session = Depends(get_db),
    business: models.Business = Depends(get_business_with_roles(["owner", "sales"]))
):
    db_opp = db.query(models.Opportunity).filter(
        models.Opportunity.id == opp_id,
        models.Opportunity.business_id == business.id
    ).first()
    if not db_opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    for key, value in opp.dict().items():
        setattr(db_opp, key, value)
        
    db.commit()
    db.refresh(db_opp)
    return db_opp

@router.delete("/{opp_id}")
def delete_opportunity(
    opp_id: int,
    db: Session = Depends(get_db),
    business: models.Business = Depends(get_business_with_roles(["owner", "sales"]))
):
    db_opp = db.query(models.Opportunity).filter(
        models.Opportunity.id == opp_id,
        models.Opportunity.business_id == business.id
    ).first()
    if not db_opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    db.delete(db_opp)
    db.commit()
    return {"message": "Opportunity deleted"}
