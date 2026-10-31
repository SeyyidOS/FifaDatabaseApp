#!/usr/bin/env python3
"""Signing material for the TestFlight lane, made through the App Store Connect API instead of Xcode's
automatic signing (frontend/ios/README.md, "Known problems": Xcode's own signature can't satisfy itself
while the team's name has a letter outside ASCII).

  asc_signing.py prepare DIR   a temporary Apple Distribution certificate, its private key made here, and
                               an App Store profile for the app with it: DIR/key.pem, cert.der,
                               profile.mobileprovision; their ids in DIR/ids.json
  asc_signing.py cleanup DIR   revokes that certificate and deletes the profile (builds already uploaded
                               aren't affected: Apple signs them again for TestFlight and the App Store)

Reads ASC_KEY_ID, ASC_ISSUER_ID and APP_ID (the bundle id) from the environment, and the API key from
~/private_keys/AuthKey_<ASC_KEY_ID>.p8. Needs the cryptography package.
"""

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.x509.oid import NameOID

API = "https://api.appstoreconnect.apple.com/v1"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def token() -> str:
    """A short-lived ES256 token for the API, signed with the team's API key."""
    key_id = os.environ["ASC_KEY_ID"]
    key = serialization.load_pem_private_key((Path.home() / "private_keys" / f"AuthKey_{key_id}.p8").read_bytes(), None)
    now = int(time.time())
    header = {"alg": "ES256", "kid": key_id, "typ": "JWT"}
    payload = {"iss": os.environ["ASC_ISSUER_ID"], "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"}
    signing_input = f"{b64url(json.dumps(header).encode())}.{b64url(json.dumps(payload).encode())}"
    r, s = decode_dss_signature(key.sign(signing_input.encode(), ec.ECDSA(hashes.SHA256())))
    return f"{signing_input}.{b64url(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))}"


def call(method: str, path: str, body: dict | None = None, check: bool = True):
    request = urllib.request.Request(
        API + path,
        method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
            # an empty answer (204) is a success too; None is kept for a refused call
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        message = f"App Store Connect {method} {path.split('?')[0]}: {e.code} {e.read().decode(errors='replace')[:800]}"
        if check:
            sys.exit(f"::error::{message}")
        print(f"::warning::{message}")
        return None


def prepare(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    (out / "key.pem").write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()
        )
    )
    os.chmod(out / "key.pem", 0o600)
    csr = (
        x509.CertificateSigningRequestBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Matchnight CI")]))
        .sign(key, hashes.SHA256())
    )
    attributes = {
        "certificateType": "DISTRIBUTION",
        "csrContent": csr.public_bytes(serialization.Encoding.PEM).decode(),
    }
    cert = call("POST", "/certificates", {"data": {"type": "certificates", "attributes": attributes}})["data"]
    ids = {"certificate": cert["id"]}
    # written straight away, so cleanup can revoke it even if the profile fails
    (out / "ids.json").write_text(json.dumps(ids))
    der = base64.b64decode(cert["attributes"]["certificateContent"])
    (out / "cert.der").write_bytes(der)
    print(f"certificate {cert['id']}, until {cert['attributes'].get('expirationDate', '?')}")
    # the team's name as Apple writes it into certificates: outside ASCII it breaks Xcode's own signing
    name = x509.load_der_x509_certificate(der).subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
    odd = [f"{c}=U+{ord(c):04X}" for c in name if ord(c) > 127]
    print(f"name on the certificate: {'ASCII only' if not odd else 'has ' + ' '.join(odd)}")

    app_id = os.environ["APP_ID"]
    bundles = call("GET", f"/bundleIds?filter[identifier]={app_id}&limit=200")["data"]
    bundle = next((b for b in bundles if b["attributes"]["identifier"] == app_id), None)
    if bundle is None:
        sys.exit(f"::error::{app_id} isn't registered under Certificates, Identifiers & Profiles › Identifiers")
    name = f"Matchnight CI {os.environ.get('GITHUB_RUN_ID', int(time.time()))}"
    relationships = {
        "bundleId": {"data": {"type": "bundleIds", "id": bundle["id"]}},
        "certificates": {"data": [{"type": "certificates", "id": cert["id"]}]},
    }
    profile = call(
        "POST",
        "/profiles",
        {
            "data": {
                "type": "profiles",
                "attributes": {"name": name, "profileType": "IOS_APP_STORE"},
                "relationships": relationships,
            }
        },
    )["data"]
    ids["profile"] = profile["id"]
    (out / "ids.json").write_text(json.dumps(ids))
    (out / "profile.mobileprovision").write_bytes(base64.b64decode(profile["attributes"]["profileContent"]))
    print(f"profile {profile['id']} ({name})")


def cleanup(out: Path) -> None:
    ids = json.loads((out / "ids.json").read_text()) if (out / "ids.json").exists() else {}
    if "profile" in ids:
        call("DELETE", f"/profiles/{ids['profile']}", check=False)
        print(f"profile {ids['profile']} deleted")
    if "certificate" in ids:
        call("DELETE", f"/certificates/{ids['certificate']}", check=False)
        print(f"certificate {ids['certificate']} revoked")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("prepare", "cleanup"):
        sys.exit(__doc__)
    {"prepare": prepare, "cleanup": cleanup}[sys.argv[1]](Path(sys.argv[2]))
