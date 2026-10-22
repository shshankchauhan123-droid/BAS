import sys
import os
from datetime import datetime, timezone

# Ensure backend root is on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.security import hash_password, create_access_token
from app.user.user_model import User
from app.client.client_model import Client

def run_tests():
    client = TestClient(app)
    db = SessionLocal()
    results = []

    def record(name: str, passed: bool, detail: str = ""):
        results.append((name, passed, detail))
        status_str = "PASS" if passed else "FAIL"
        print(f"[{status_str}] {name} {f'({detail})' if detail else ''}")

    created_users = []
    created_clients = []

    try:
        # Create a test tenant client
        test_client = Client(
            name="Login Test Org",
            company_code="LOGINTST",
            is_active=True,
        )
        db.add(test_client)
        db.commit()
        db.refresh(test_client)
        created_clients.append(test_client)

        # Create regular user
        user_pwd = "UserPass123!"
        regular_user = User(
            client_id=test_client.id,
            username="regular_test_user_77",
            email="regular77@logintest.com",
            password_hash=hash_password(user_pwd),
            role="user",
            is_active=True,
            first_login=False,
        )
        db.add(regular_user)

        # Create client admin
        cadmin_user = User(
            client_id=test_client.id,
            username="cadmin_test_user_77",
            email="cadmin77@logintest.com",
            password_hash=hash_password(user_pwd),
            role="client_admin",
            is_active=True,
            first_login=False,
        )
        db.add(cadmin_user)

        # Create superadmin (global, client_id is None)
        super_user = User(
            client_id=None,
            username="super_test_user_77",
            email="super77@logintest.com",
            password_hash=hash_password(user_pwd),
            role="superadmin",
            is_active=True,
            first_login=False,
        )
        db.add(super_user)

        db.commit()
        db.refresh(regular_user)
        db.refresh(cadmin_user)
        db.refresh(super_user)
        created_users.extend([regular_user, cadmin_user, super_user])

        # -------------------------------------------------------------
        # SCENARIO 1: Nonexistent username -> USER_NOT_FOUND
        # -------------------------------------------------------------
        resp1 = client.post("/api/v1/auth/login", json={
            "username": "definitely_nonexistent_user_99999",
            "password": "AnyPassword123!",
        })
        data1 = resp1.json()
        detail1 = data1.get("detail", {})
        code1 = detail1.get("code") if isinstance(detail1, dict) else None
        msg1 = detail1.get("message") if isinstance(detail1, dict) else str(detail1)
        ok1 = (
            resp1.status_code == 401 and
            code1 == "USER_NOT_FOUND" and
            "Invalid username or email" in msg1
        )
        record("Scenario 1: Nonexistent username returns USER_NOT_FOUND (401)", ok1, f"Status: {resp1.status_code}, Code: {code1}, Msg: {msg1}")

        # -------------------------------------------------------------
        # SCENARIO 2: Valid username + Incorrect password -> INVALID_PASSWORD
        # -------------------------------------------------------------
        resp2 = client.post("/api/v1/auth/login", json={
            "username": "regular_test_user_77",
            "password": "WrongPassword999!",
        })
        data2 = resp2.json()
        detail2 = data2.get("detail", {})
        code2 = detail2.get("code") if isinstance(detail2, dict) else None
        msg2 = detail2.get("message") if isinstance(detail2, dict) else str(detail2)
        ok2 = (
            resp2.status_code == 401 and
            code2 == "INVALID_PASSWORD" and
            "Incorrect password" in msg2
        )
        record("Scenario 2: Incorrect password returns INVALID_PASSWORD (401)", ok2, f"Status: {resp2.status_code}, Code: {code2}, Msg: {msg2}")

        # -------------------------------------------------------------
        # SCENARIO 3: Valid credentials -> Successful login (tokens + user role)
        # -------------------------------------------------------------
        resp3 = client.post("/api/v1/auth/login", json={
            "username": "regular_test_user_77",
            "password": user_pwd,
        })
        data3 = resp3.json()
        ok3 = (
            resp3.status_code == 200 and
            bool(data3.get("access_token")) and
            bool(data3.get("refresh_token")) and
            data3.get("user", {}).get("username") == "regular_test_user_77" and
            data3.get("user", {}).get("role") == "user"
        )
        record("Scenario 3: Valid regular user credentials return 200 with tokens", ok3, f"Token received: {bool(data3.get('access_token'))}")

        # -------------------------------------------------------------
        # SCENARIO 4: Client Admin login
        # -------------------------------------------------------------
        resp4 = client.post("/api/v1/auth/login", json={
            "username": "cadmin_test_user_77",
            "password": user_pwd,
        })
        data4 = resp4.json()
        ok4 = (
            resp4.status_code == 200 and
            data4.get("user", {}).get("role") == "client_admin" and
            data4.get("user", {}).get("client_id") == test_client.id
        )
        record("Scenario 4: Client Admin login returns client_admin role", ok4, f"Role: {data4.get('user', {}).get('role')}")

        # -------------------------------------------------------------
        # SCENARIO 5: Super Admin login
        # -------------------------------------------------------------
        resp5 = client.post("/api/v1/auth/login", json={
            "username": "super_test_user_77",
            "password": user_pwd,
        })
        data5 = resp5.json()
        ok5 = (
            resp5.status_code == 200 and
            data5.get("user", {}).get("role") == "superadmin"
        )
        record("Scenario 5: Super Admin login returns superadmin role", ok5, f"Role: {data5.get('user', {}).get('role')}")

        # -------------------------------------------------------------
        # SCENARIO 6: Inactive user account -> ACCOUNT_INACTIVE (403)
        # -------------------------------------------------------------
        regular_user.is_active = False
        db.commit()

        resp6 = client.post("/api/v1/auth/login", json={
            "username": "regular_test_user_77",
            "password": user_pwd,
        })
        data6 = resp6.json()
        detail6 = data6.get("detail", {})
        code6 = detail6.get("code") if isinstance(detail6, dict) else None
        ok6 = (
            resp6.status_code == 403 and
            code6 == "ACCOUNT_INACTIVE"
        )
        record("Scenario 6: Inactive user returns ACCOUNT_INACTIVE (403)", ok6, f"Status: {resp6.status_code}, Code: {code6}")

        # Restore user active
        regular_user.is_active = True
        db.commit()

        # -------------------------------------------------------------
        # SCENARIO 7: Deactivated client/company -> COMPANY_DEACTIVATED (403)
        # -------------------------------------------------------------
        test_client.is_active = False
        db.commit()

        resp7 = client.post("/api/v1/auth/login", json={
            "username": "regular_test_user_77",
            "password": user_pwd,
        })
        data7 = resp7.json()
        detail7 = data7.get("detail", {})
        code7 = detail7.get("code") if isinstance(detail7, dict) else None
        ok7 = (
            resp7.status_code == 403 and
            code7 == "COMPANY_DEACTIVATED"
        )
        record("Scenario 7: Deactivated company returns COMPANY_DEACTIVATED (403)", ok7, f"Status: {resp7.status_code}, Code: {code7}")

        # -------------------------------------------------------------
        # SCENARIO 8: Protected endpoint with expired/invalid token -> 401
        # -------------------------------------------------------------
        resp8 = client.get("/api/v1/cases/my-cases", headers={
            "Authorization": "Bearer invalid.expired.jwt.token.here"
        })
        ok8 = (resp8.status_code == 401 and "Invalid" in resp8.text)
        record("Scenario 8: Protected endpoint with invalid token returns 401", ok8, f"Status: {resp8.status_code}")

    finally:
        print("\nCleaning up test data...")
        try:
            for u in created_users:
                db.delete(u)
            for c in created_clients:
                db.delete(c)
            db.commit()
            print("Test data cleaned successfully.")
        except Exception as e:
            db.rollback()
            print("Cleanup error:", e)
        db.close()

    total = len(results)
    passed = sum(1 for _, p, _ in results if p)
    failed = total - passed

    print("\n" + "=" * 60)
    print(f"TEST SUITE SUMMARY:")
    print(f"Total: {total} | Passed: {passed} | Failed: {failed}")
    print("=" * 60)

    if failed > 0:
        sys.exit(1)
    else:
        print("ALL LOGIN VALIDATION TESTS PASSED CONVINCINGLY!\n")
        sys.exit(0)

if __name__ == "__main__":
    run_tests()
