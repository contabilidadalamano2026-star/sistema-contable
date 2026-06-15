from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from db.database import get_db
from models import models
from schemas import schemas
from api.businesses import get_current_user
from api.dependencies import get_business_with_roles

from services.hacienda import HaciendaXMLBuilder
from services.hacienda_signer import sign_invoice_xml
import os

router = APIRouter(prefix="/api/businesses/{business_id}/invoices", tags=["invoices"])

@router.post("")
def create_invoice(business_id: int, invoice: schemas.InvoiceCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    biz = get_business_with_roles(business_id, db, user_id)
    
    invoice_number = f"INV-{uuid.uuid4().hex[:6].upper()}"
    
    # 1. Register Transaction in local DB
    total_amount = sum((item.price * item.qty) * (1 + item.iva_rate / 100.0) for item in invoice.items)
    
    # Create an Income Transaction
    from datetime import datetime
    date_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    new_tx = models.Transaction(
        type="income",
        amount=total_amount,
        category="Sales",
        description=f"Factura para {invoice.client_name}",
        is_paid=False,
        invoice_number=invoice_number,
        business_id=business_id,
        user_id=user_id,
        date=date_str
    )
    db.add(new_tx)
    db.flush()
    
    # 2. Build Hacienda XML
    # We pass an object that matches what HaciendaXMLBuilder expects
    class DummyTx:
        def __init__(self, inv_num):
            self.invoice_number = inv_num
            
    builder = HaciendaXMLBuilder(biz)
    items_dict = [i.dict() for i in invoice.items]
    xml_content = builder.generate_invoice_xml(DummyTx(invoice_number), items_dict)
    
    # 3. Sign XML
    # Load test certificate
    p12_path = os.path.join(os.path.dirname(__file__), "..", "certs", "test_hacienda.p12")
    try:
        signed_xml = sign_invoice_xml(xml_content, p12_path, "1234")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error signing XML: {str(e)}")
        
    db.commit()
    
    return {
        "message": "Factura generada y firmada exitosamente",
        "invoice_number": invoice_number,
        "total_amount": total_amount,
        "signed_xml": signed_xml
    }
