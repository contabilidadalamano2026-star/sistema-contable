from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
import datetime
import os

# Generate private key
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
)

# Generate subject and issuer
subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COUNTRY_NAME, u"CR"),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"Testing"),
    x509.NameAttribute(NameOID.COMMON_NAME, u"TestHacienda"),
])

# Generate certificate
cert = x509.CertificateBuilder().subject_name(
    subject
).issuer_name(
    issuer
).public_key(
    private_key.public_key()
).serial_number(
    x509.random_serial_number()
).not_valid_before(
    datetime.datetime.utcnow()
).not_valid_after(
    datetime.datetime.utcnow() + datetime.timedelta(days=365)
).sign(private_key, hashes.SHA256())

from cryptography.hazmat.primitives.serialization import BestAvailableEncryption, NoEncryption

p12 = pkcs12.serialize_key_and_certificates(
    b"test_hacienda",
    private_key,
    cert,
    None,
    NoEncryption()
)

os.makedirs("backend/certs", exist_ok=True)
with open("backend/certs/test_hacienda.p12", "wb") as f:
    f.write(p12)

print("Certificate generated successfully at backend/certs/test_hacienda.p12")
