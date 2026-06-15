from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from db.database import get_db
from models import models
from schemas import schemas
from api.businesses import get_current_user
from api.dependencies import get_business_with_roles, require_cashier

from services.hacienda import HaciendaXMLBuilder
from services.hacienda_signer import sign_invoice_xml
import os

router = APIRouter(prefix="/api/businesses/{business_id}/invoices", tags=["invoices"], dependencies=[Depends(require_cashier)])

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

from fastapi import UploadFile, File
import xml.etree.ElementTree as ET

@router.post("/receive")
async def receive_invoice(
    business_id: int, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    user_id: str = Depends(get_current_user)
):
    # This endpoint is accessed by accountants or owners to upload expenses
    biz = get_business_with_roles(business_id, db, user_id)
    
    content = await file.read()
    filename = file.filename.lower()
    
    date_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    amount = 0.0
    supplier_name = "Proveedor Desconocido"
    
    if filename.endswith(".xml"):
        # Simple XML parsing for Hacienda format
        try:
            root = ET.fromstring(content)
            # Find namespaces usually used in Hacienda XML
            # For simplicity in this demo we do a text search or ignore namespaces
            # A real implementation uses proper XPath with namespaces
            xml_text = content.decode('utf-8')
            
            import re
            monto_match = re.search(r'<TotalComprobante>([\d\.]+)</TotalComprobante>', xml_text)
            if monto_match:
                amount = float(monto_match.group(1))
                
            nombre_match = re.search(r'<Nombre>(.*?)</Nombre>', xml_text)
            if nombre_match:
                # El primer <Nombre> suele ser del Emisor
                supplier_name = nombre_match.group(1)
        except Exception as e:
            raise HTTPException(status_code=400, detail="Error parseando el XML")
    elif filename.endswith((".png", ".jpg", ".jpeg")):
        # Mock OCR extraction for images (Camera)
        # In a real app we'd send the image to AWS Textract or Google Cloud Vision
        amount = 15000.0
        supplier_name = "Gasto Registrado por Cámara (OCR Simulado)"
    else:
        raise HTTPException(status_code=400, detail="Formato no soportado. Sube XML o Imagen.")

    # Create an Expense Transaction
    new_tx = models.Transaction(
        type="expense",
        amount=amount,
        category="Gastos Operativos",
        description=f"Factura Recibida: {supplier_name}",
        is_paid=True,
        business_id=business_id,
        user_id=user_id,
        date=date_str
    )
    db.add(new_tx)
    db.commit()
    db.refresh(new_tx)
    
    return {
        "message": "Comprobante procesado exitosamente",
        "transaction_id": new_tx.id,
        "amount": amount,
        "supplier": supplier_name
    }
