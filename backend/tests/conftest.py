import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        yield TestClient(app)
