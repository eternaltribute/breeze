# S1-011: User Login and Session Handling
# These tests verify that the /auth/me endpoint rejects unauthenticated requests.
# Per S1-003 guardrails, unauthenticated requests must return 401 Unauthorized.
def test_auth_me_no_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_auth_me_invalid_token(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer faketoken"})
    assert response.status_code == 401


def test_auth_me_missing_bearer(client):
    response = client.get("/auth/me", headers={"Authorization": "notabearer"})
    assert response.status_code == 401


# S1-012: Logout and Session Invalidation
# These tests verify that the /auth/logout endpoint rejects unauthenticated requests.
# Clerk handles actual session invalidation on the frontend.
# Backend enforces that a valid token is required to even call logout.
def test_logout_no_token(client):
    response = client.post("/auth/logout")
    assert response.status_code == 401


def test_logout_invalid_token(client):
    response = client.post(
        "/auth/logout", headers={"Authorization": "Bearer faketoken"}
    )
    assert response.status_code == 401


# S1-014: Route Protection
# These tests verify that protected routes reject unauthenticated requests.
def test_protected_ping_no_token(client):
    response = client.get("/protected/ping")
    assert response.status_code == 401


def test_protected_ping_invalid_token(client):
    response = client.get(
        "/protected/ping", headers={"Authorization": "Bearer faketoken"}
    )
    assert response.status_code == 401


# S1-015: Per-User Data Authorization
# These tests verify that job endpoints reject unauthenticated requests.
# Cross-user access is denied by filtering jobs by owner_id from the Clerk JWT.
def test_get_jobs_no_token(client):
    response = client.get("/jobs/")
    assert response.status_code == 401


def test_get_jobs_invalid_token(client):
    response = client.get("/jobs/", headers={"Authorization": "Bearer faketoken"})
    assert response.status_code == 401


def test_get_job_no_token(client):
    response = client.get("/jobs/1")
    assert response.status_code == 401
