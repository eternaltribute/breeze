import os

from dotenv import load_dotenv
from fastapi import HTTPException, Security  # for return error responses
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)  # prompt fastapi to look for token in the auth header
from jose import (
    JWTError,
    jwt,
)  # jwt decodes and verifies the token, jwt is for exceptions

load_dotenv()

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")  # reads clerk values from .env file
CLERK_ISSUER_URL = os.getenv("CLERK_ISSUER_URL")

security = HTTPBearer()  # creates bearer token extractor


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
):  # dependency fucntion,any route with this parameter will require a valid token
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            CLERK_SECRET_KEY,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER_URL,
        )
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
