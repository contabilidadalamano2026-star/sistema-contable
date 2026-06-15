from datetime import datetime

class HaciendaXMLBuilder:
    def __init__(self, business):
        self.business = business
        
    def generate_invoice_xml(self, tx, items):
        # Implementación dinámica requerida en QA (Fase 5)
        # Separación entre Bienes (Mercancias) y Servicios
        # Tarifas de IVA dinámicas (1%, 2%, 4%, 13%, Exento)
        
        total_servicios = 0.0
        total_mercancias = 0.0
        impuestos_totales = 0.0
        
        xml_items = ""
        for index, item in enumerate(items, 1):
            iva_rate = item.get("iva_rate", 13)
            cabys = item.get("cabys", "8999901000000") # Dinámico
            price = item.get("price", 0.0)
            qty = item.get("qty", 1)
            is_service = item.get("is_service", False)
            
            subtotal = price * qty
            tax_amount = subtotal * (iva_rate / 100.0)
            line_total = subtotal + tax_amount
            
            if is_service:
                total_servicios += subtotal
            else:
                total_mercancias += subtotal
                
            impuestos_totales += tax_amount
            
            # Mapeo Código Tarifa
            if iva_rate == 13: codigo_tarifa = "08"
            elif iva_rate == 4: codigo_tarifa = "04"
            elif iva_rate == 2: codigo_tarifa = "02"
            elif iva_rate == 1: codigo_tarifa = "01"
            else: codigo_tarifa = "01" # Exento (Simplificado)
            
            xml_items += f"""
            <LineaDetalle>
                <NumeroLinea>{index}</NumeroLinea>
                <CodigoCabys>{cabys}</CodigoCabys>
                <Detalle>{item.get('name', 'Artículo')}</Detalle>
                <PrecioUnitario>{price}</PrecioUnitario>
                <MontoTotal>{subtotal}</MontoTotal>
                <Impuesto>
                    <Codigo>01</Codigo>
                    <CodigoTarifa>{codigo_tarifa}</CodigoTarifa>
                    <Tarifa>{iva_rate}</Tarifa>
                    <Monto>{tax_amount}</Monto>
                </Impuesto>
                <MontoTotalLinea>{line_total}</MontoTotalLinea>
            </LineaDetalle>
            """
            
        xml = f"""<?xml version="1.0" encoding="utf-8"?>
<FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronica">
    <Clave>{tx.invoice_number}</Clave>
    <CodigoActividad>{self.business.industry or '000000'}</CodigoActividad>
    <FechaEmision>{datetime.now().strftime('%Y-%m-%dT%H:%M:%S-06:00')}</FechaEmision>
    <Emisor>
        <Nombre>{self.business.name}</Nombre>
        <Identificacion>
            <Tipo>01</Tipo>
            <Numero>{self.business.tax_id}</Numero>
        </Identificacion>
    </Emisor>
    <DetalleServicio>
        {xml_items}
    </DetalleServicio>
    <ResumenFactura>
        <TotalServiciosGravados>{total_servicios}</TotalServiciosGravados>
        <TotalMercanciasGravadas>{total_mercancias}</TotalMercanciasGravadas>
        <TotalGravado>{total_servicios + total_mercancias}</TotalGravado>
        <TotalImpuesto>{impuestos_totales}</TotalImpuesto>
        <TotalComprobante>{total_servicios + total_mercancias + impuestos_totales}</TotalComprobante>
    </ResumenFactura>
</FacturaElectronica>"""
        return xml
