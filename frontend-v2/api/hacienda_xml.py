from lxml import etree
import datetime
import random

# Definición de Namespaces oficiales de Hacienda v4.4
NSMAP = {
    None: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronica", # Usando v4.3/v4.4 según el endpoint
    "ds": "http://www.w3.org/2000/09/xmldsig#",
    "xsd": "http://www.w3.org/2001/XMLSchema",
    "xsi": "http://www.w3.org/2001/XMLSchema-instance"
}

def generate_clave(tipo_doc, cedula_emisor, sucursal="001", terminal="00001", situacion="1"):
    """
    Genera la clave única de 50 dígitos numéricos.
    tipo_doc: '01' Factura, '04' Tiquete
    """
    now = datetime.datetime.now()
    dia = f"{now.day:02d}"
    mes = f"{now.month:02d}"
    ano = f"{now.year:02d}" # Ej: 26
    
    # Rellenar cédula a 12 espacios
    cedula_pad = str(cedula_emisor).zfill(12)
    
    # Consecutivo: 3 (sucursal) + 5 (terminal) + 2 (tipo) + 10 (numero)
    numero_rand = f"{random.randint(1, 999999):010d}"
    consecutivo = f"{sucursal}{terminal}{tipo_doc}{numero_rand}"
    
    # Código de seguridad: 8 dígitos random
    cod_seguridad = f"{random.randint(11111111, 99999999)}"
    
    clave = f"506{dia}{mes}{ano}{cedula_pad}{consecutivo}{situacion}{cod_seguridad}"
    return clave, consecutivo

def build_factura_xml(data: dict) -> bytes:
    """
    Construye el XML sin firmar de una Factura Electrónica v4.4
    data contiene:
    - emisor: dict (cedula, nombre, correo, tipo_id)
    - receptor: dict (cedula, nombre, correo) (Opcional si es tiquete)
    - detalle: list of dicts (cantidad, unidad, detalle, precio_unitario, monto_total, subtotal, iva, tarifa_iva)
    """
    is_tiquete = not bool(data.get("receptor"))
    tipo_doc = "04" if is_tiquete else "01"
    
    clave, consecutivo = generate_clave(tipo_doc, data["emisor"]["cedula"])
    
    root_tag = "TiqueteElectronico" if is_tiquete else "FacturaElectronica"
    root = etree.Element(root_tag, nsmap=NSMAP)
    
    etree.SubElement(root, "Clave").text = clave
    etree.SubElement(root, "CodigoActividad").text = str(data["emisor"].get("actividad", "471100"))
    etree.SubElement(root, "NumeroConsecutivo").text = consecutivo
    
    now_iso = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S-06:00")
    etree.SubElement(root, "FechaEmision").text = now_iso
    
    # --- EMISOR ---
    emisor_node = etree.SubElement(root, "Emisor")
    etree.SubElement(emisor_node, "Nombre").text = data["emisor"]["nombre"]
    id_emisor = etree.SubElement(emisor_node, "Identificacion")
    etree.SubElement(id_emisor, "Tipo").text = data["emisor"].get("tipo_id", "01") # 01 Fisica, 02 Juridica
    etree.SubElement(id_emisor, "Numero").text = data["emisor"]["cedula"]
    
    ubicacion = etree.SubElement(emisor_node, "Ubicacion")
    etree.SubElement(ubicacion, "Provincia").text = "1"
    etree.SubElement(ubicacion, "Canton").text = "01"
    etree.SubElement(ubicacion, "Distrito").text = "01"
    etree.SubElement(ubicacion, "Barrio").text = "01"
    etree.SubElement(ubicacion, "OtrasSenas").text = "Oficina Central"
    etree.SubElement(emisor_node, "CorreoElectronico").text = data["emisor"]["correo"]
    
    # --- RECEPTOR (Opcional) ---
    if not is_tiquete:
        receptor_node = etree.SubElement(root, "Receptor")
        etree.SubElement(receptor_node, "Nombre").text = data["receptor"]["nombre"]
        id_receptor = etree.SubElement(receptor_node, "Identificacion")
        etree.SubElement(id_receptor, "Tipo").text = data["receptor"].get("tipo_id", "01")
        etree.SubElement(id_receptor, "Numero").text = data["receptor"]["cedula"]
        etree.SubElement(receptor_node, "CorreoElectronico").text = data["receptor"]["correo"]
    
    etree.SubElement(root, "CondicionVenta").text = "01" # 01 Contado
    etree.SubElement(root, "MedioPago").text = "01" # 01 Efectivo, 02 Tarjeta
    
    # --- DETALLE DE SERVICIO ---
    detalle_node = etree.SubElement(root, "DetalleServicio")
    total_servicios = 0
    total_mercancias = 0
    total_impuesto = 0
    
    for i, item in enumerate(data["detalle"], start=1):
        linea = etree.SubElement(detalle_node, "LineaDetalle")
        etree.SubElement(linea, "NumeroLinea").text = str(i)
        
        # CABYS: Codigo obligatorio del Banco Central, usamos un genérico comercial
        etree.SubElement(linea, "Codigo").text = "8999901000000" 
        etree.SubElement(linea, "Cantidad").text = f"{item['cantidad']:.3f}"
        etree.SubElement(linea, "UnidadMedida").text = item.get("unidad", "Unid")
        etree.SubElement(linea, "Detalle").text = item["detalle"]
        etree.SubElement(linea, "PrecioUnitario").text = f"{item['precio_unitario']:.5f}"
        etree.SubElement(linea, "MontoTotal").text = f"{item['monto_total']:.5f}"
        etree.SubElement(linea, "SubTotal").text = f"{item['subtotal']:.5f}"
        
        total_mercancias += item['subtotal']
        
        if item.get("iva", 0) > 0:
            imp_node = etree.SubElement(linea, "Impuesto")
            etree.SubElement(imp_node, "Codigo").text = "01" # IVA
            etree.SubElement(imp_node, "CodigoTarifa").text = "08" # 13% General
            etree.SubElement(imp_node, "Tarifa").text = f"{item['tarifa_iva']:.2f}"
            etree.SubElement(imp_node, "Monto").text = f"{item['iva']:.5f}"
            total_impuesto += item['iva']
            
        etree.SubElement(linea, "MontoTotalLinea").text = f"{(item['subtotal'] + item.get('iva', 0)):.5f}"
        
    # --- RESUMEN FACTURA ---
    resumen = etree.SubElement(root, "ResumenFactura")
    codigo_moneda = etree.SubElement(resumen, "CodigoTipoMoneda")
    etree.SubElement(codigo_moneda, "CodigoMoneda").text = "CRC"
    etree.SubElement(codigo_moneda, "TipoCambio").text = "1.00000"
    
    etree.SubElement(resumen, "TotalServiciosGravados").text = "0.00000"
    etree.SubElement(resumen, "TotalServiciosExentos").text = "0.00000"
    etree.SubElement(resumen, "TotalMercanciasGravadas").text = f"{total_mercancias:.5f}" if total_impuesto > 0 else "0.00000"
    etree.SubElement(resumen, "TotalMercanciasExentas").text = "0.00000" if total_impuesto > 0 else f"{total_mercancias:.5f}"
    
    etree.SubElement(resumen, "TotalGravado").text = f"{total_mercancias:.5f}" if total_impuesto > 0 else "0.00000"
    etree.SubElement(resumen, "TotalExento").text = "0.00000" if total_impuesto > 0 else f"{total_mercancias:.5f}"
    
    etree.SubElement(resumen, "TotalVenta").text = f"{total_mercancias:.5f}"
    etree.SubElement(resumen, "TotalDescuentos").text = "0.00000"
    etree.SubElement(resumen, "TotalVentaNeta").text = f"{total_mercancias:.5f}"
    etree.SubElement(resumen, "TotalImpuesto").text = f"{total_impuesto:.5f}"
    etree.SubElement(resumen, "TotalComprobante").text = f"{(total_mercancias + total_impuesto):.5f}"
    
    # Convertir a bytes
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", pretty_print=True)
