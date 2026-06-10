def test_auth_me_no_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_auth_me_invalid_token(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer faketoken"})
    assert response.status_code == 401


def test_auth_me_missing_bearer(client):
    response = client.get("/auth/me", headers={"Authorization": "notabearer"})
    assert response.status_code == 401
