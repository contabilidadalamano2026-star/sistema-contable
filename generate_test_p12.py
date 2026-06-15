from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.hazmat.primitives import serialization
import datetime

# Generar llave privada
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
)

# Generar certificado auto-firmado
subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COUNTRY_NAME, u"CR"),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"QA Testing Inc"),
    x509.NameAttribute(NameOID.COMMON_NAME, u"QA Testing Cert"),
])
cert = x509.CertificateBuilder().subject_name(
    subject
).issuer_name(
    issuer
).public_key(
    private_key.public_key()
).serial_number(
    x509.random_serial_number()
).not_valid_before(
    datetime.datetime.now(datetime.timezone.utc)
).not_valid_after(
    datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=10)
).sign(private_key, hashes.SHA256())

# Guardar como .p12 (PKCS12)
p12_data = pkcs12.serialize_key_and_certificates(
    b"QA Test Cert",
    private_key,
    cert,
    None,
    serialization.BestAvailableEncryption(b"1234")
)

with open("test_qa_cert.p12", "wb") as f:
    f.write(p12_data)

print("test_qa_cert.p12 generado exitosamente con PIN: 1234")
