import os

import requests
from dotenv import load_dotenv
from fastapi import HTTPException, Security  # for return error responses
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)  # prompt fastapi to look for token in the auth header
from jose import (
    JWTError,
    jwk,
    jwt,
)  # jwt decodes and verifies the token, jwt is for exceptions

load_dotenv()

CLERK_ISSUER_URL = os.getenv("CLERK_ISSUER_URL")
JWKS_URL = f"{CLERK_ISSUER_URL}/.well-known/jwks.json"

security = HTTPBearer()  # creates bearer token extractor

_jwks_cache = None


def get_jwks():
    global _jwks_cache
    if _jwks_cache is None:
        response = requests.get(JWKS_URL, timeout=5)
        response.raise_for_status()
        _jwks_cache = response.json()
    return _jwks_cache


def get_signing_key(token: str):
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")

    jwks = get_jwks()
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return jwk.construct(key, algorithm="RS256")

    raise JWTError("Unable to find matching signing key")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
):  # dependency fucntion,any route with this parameter will require a valid token
    token = credentials.credentials
    try:
        signing_key = get_signing_key(token)
        payload = jwt.decode(
            token,
            signing_key.to_pem().decode("utf-8"),
            algorithms=["RS256"],
            issuer=CLERK_ISSUER_URL,
            options={"verify_aud": False},
        )
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
