from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
import jwt

from ..db.database import get_db
from ..models import models
from ..schemas import schemas

router = APIRouter(prefix="/api/businesses", tags=["businesses"])
SECRET_KEY = "mysecretkey_v2" # move to env later

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token no proporcionado")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

@router.get("", response_model=list[schemas.BusinessResponse])
def get_businesses(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario inválido")
        
    if user.role == "owner":
        return db.query(models.Business).filter(models.Business.user_id == user_id).all()
    else:
        # Sub-user only gets their assigned business
        biz = db.query(models.Business).filter(models.Business.id == user.assigned_business_id).first()
        return [biz] if biz else []

@router.post("", response_model=schemas.BusinessResponse)
def create_business(business: schemas.BusinessCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    new_biz = models.Business(**business.dict(), user_id=user_id)
    db.add(new_biz)
    db.commit()
    db.refresh(new_biz)
    
    # Auto-create default accounts
    default_acc = models.BankAccount(business_id=new_biz.id, name="Caja Principal", currency=new_biz.currency)
    db.add(default_acc)
    db.commit()
    
    return new_biz
