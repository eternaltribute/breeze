import os
from functools import lru_cache

import requests
from dotenv import load_dotenv
from fastapi import HTTPException, Request, Security
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from jose import (
    JWTError,
    jwt,
)

from app.logging_config import logger  # S3-018

load_dotenv()

CLERK_ISSUER_URL = os.getenv("CLERK_ISSUER_URL")
JWKS_URL = f"{CLERK_ISSUER_URL}/.well-known/jwks.json"

security = HTTPBearer()


@lru_cache(maxsize=1)
def get_jwks():
    # get the clerk public key
    url = f"{CLERK_ISSUER_URL}/.well-known/jwks.json"
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        # S3-018 : if Clerk's JWKs endpoint is down,every request fails auth
        # this deserves its own log line, distinct from a bad individual token.
        logger.error("Failed to fetch JWK from %s: %s", url, e, exc_info=True)
        raise


def get_current_user(
    request: Request,  # S3-018 need to attach user_id to request.state
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
        # S3-018 : stash user_id so middleware.py and exception_handlers.py
        # can log who made the request without re-decoding the token
        request.state.user_id = payload.get("sub")
        return payload
    except JWTError as e:
        logger.warning("Auth failed for %s: %s", request.url.path, e)  # S3-018
        raise HTTPException(status_code=401, detail="Invalid or expired token")
