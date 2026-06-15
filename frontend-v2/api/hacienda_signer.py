from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.hazmat.primitives import serialization
from signxml import XMLSigner, methods
from lxml import etree
import logging

def extract_p12_keys(p12_path, password):
    """
    Desempaqueta el archivo .p12 para extraer la llave privada y el certificado.
    """
    with open(p12_path, "rb") as f:
        p12_data = f.read()
    
    # Hazmat PKCS12 load expects bytes password
    if isinstance(password, str):
        password = password.encode('utf-8')
        
    private_key, certificate, additional_certificates = pkcs12.load_key_and_certificates(
        p12_data, 
        password
    )
    return private_key, certificate

def sign_factura_xml(xml_bytes, p12_path, pin):
    """
    Firma el XML utilizando el estándar XML-DSig (y base para XAdES).
    """
    try:
        private_key, cert = extract_p12_keys(p12_path, pin)
        
        # Convertir a formato PEM, requerido por signxml
        key_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        cert_pem = cert.public_bytes(serialization.Encoding.PEM)
        
        # Parsear el XML bruto
        root = etree.fromstring(xml_bytes)
        
        # Configurar el firmante: Enveloped, RSA-SHA256, C14N
        signer = XMLSigner(
            method=methods.enveloped,
            signature_algorithm="rsa-sha256",
            digest_algorithm="sha256",
            c14n_algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
        )
        
        # Generar XML firmado
        signed_root = signer.sign(root, key=key_pem, cert=cert_pem)
        
        # Devolver en bytes
        return etree.tostring(signed_root, xml_declaration=True, encoding="UTF-8")
        
    except Exception as e:
        logging.error(f"Error firmando XML: {str(e)}")
        raise RuntimeError(f"Error criptográfico al firmar el XML: Verifique el PIN o la vigencia del certificado .p12. Detalle: {str(e)}")
