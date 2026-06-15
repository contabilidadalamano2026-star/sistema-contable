from backend.hacienda_signer import sign_factura_xml

xml_base = b'''<?xml version="1.0" encoding="UTF-8"?>
<FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronica">
  <Clave>5061406202600000012345600100001010000644730181995797</Clave>
  <CodigoActividad>471100</CodigoActividad>
  <NumeroConsecutivo>00100001010000644730</NumeroConsecutivo>
</FacturaElectronica>'''

try:
    signed_xml = sign_factura_xml(xml_base, "test_qa_cert.p12", "1234")
    print(signed_xml.decode('utf-8'))
except Exception as e:
    print("Error:", e)
