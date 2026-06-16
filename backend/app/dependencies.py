import os
from functools import lru_cache

import requests
from dotenv import load_dotenv
from fastapi import HTTPException, Security
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from jose import (
    JWTError,
    jwt,
)

load_dotenv()

CLERK_ISSUER_URL = os.getenv("CLERK_ISSUER_URL")
JWKS_URL = f"{CLERK_ISSUER_URL}/.well-known/jwks.json"

security = HTTPBearer()


@lru_cache(maxsize=1)
def get_jwks():
    # get the clerk public key
    url = f"{CLERK_ISSUER_URL}/.well-known/jwks.json"
    return requests.get(url).json()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
):
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            get_jwks(),
            algorithms=["RS256"],
            issuer=CLERK_ISSUER_URL,
            options={
                "leeway": 60,
                "verify_aud": False,
            },  # lee way incase our clock is off, and skips audience checking
        )
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
