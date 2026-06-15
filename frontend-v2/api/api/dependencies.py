from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..models import models
from .auth import get_current_user

def get_business_with_roles(business_id: int, db: Session, user_id: str):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario inválido")
        
    if user.role == "owner":
        biz = db.query(models.Business).filter(models.Business.id == business_id, models.Business.user_id == user_id).first()
        if not biz:
            raise HTTPException(status_code=404, detail="Negocio no encontrado")
        return biz
    else:
        # Sub-users can only access their assigned business
        if user.assigned_business_id != business_id:
            raise HTTPException(status_code=403, detail="No tienes acceso a este negocio")
        biz = db.query(models.Business).filter(models.Business.id == business_id).first()
        if not biz:
            raise HTTPException(status_code=404, detail="Negocio no encontrado")
        return biz
