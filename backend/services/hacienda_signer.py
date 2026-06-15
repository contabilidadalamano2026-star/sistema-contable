from lxml import etree
from signxml import XMLSigner
from cryptography.hazmat.primitives.serialization import pkcs12

def sign_invoice_xml(xml_string, p12_path, p12_password):
    with open(p12_path, "rb") as f:
        p12_data = f.read()

    # Load certificate and private key
    private_key, cert, additional_certs = pkcs12.load_key_and_certificates(p12_data, p12_password.encode())

    # Parse XML
    root = etree.fromstring(xml_string.encode('utf-8'))

    # Sign XML
    signer = XMLSigner()
    signed_root = signer.sign(root, key=private_key, cert=cert)
    
    return etree.tostring(signed_root, encoding='utf-8').decode('utf-8')
