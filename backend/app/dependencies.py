import os
import requests
from functools import lru_cache

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


@lru_cache(maxsize=1)
def get_jwks():
    # fetch Clerk's public keys (cached so we only hit the endpoint once)
    url = f"{CLERK_ISSUER_URL}/.well-known/jwks.json"
    return requests.get(url).json()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
):  # dependency fucntion,any route with this parameter will require a valid token
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            get_jwks(),
            algorithms=["RS256"],
            issuer=CLERK_ISSUER_URL,
            options={"leeway": 60, "verify_aud": False},
        )
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
