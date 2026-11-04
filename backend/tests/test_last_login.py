import os
import sys
import unittest
from datetime import datetime, timezone, timedelta
import zoneinfo

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# Ensure all database models are mapped
import app.client.client_model
import app.user.user_model
import app.user.user_permission_model
import app.case.case_model
import app.bank_transactions.bank_transaction_model
import app.audit.audit_model
from app.core.database import Base, get_db
from app.user.user_model import User
from app.audit.audit_model import AuditLog
from app.core.security import hash_password, create_access_token
from app.audit.audit_repository import get_last_login_for_user
from app.audit.audit_service import get_user_last_login, record_audit_log
from app.authentication.auth_controller import get_last_login_controller
from app.authentication.auth_service import login_user, AuthException
from app.main import app


class TestLastLogin(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False)

        def override_get_db():
            db = cls.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()

    def setUp(self):
        self.db = self.SessionLocal()
        self.db.query(AuditLog).delete()
        self.db.query(User).delete()
        self.db.commit()

        # Seed User A
        self.user_a = User(
            id=101,
            username="investigator_a",
            email="investigator_a@example.com",
            password_hash=hash_password("Password123!"),
            role="user",
            is_active=True,
            first_login=False,
        )
        # Seed User B
        self.user_b = User(
            id=102,
            username="analyst_b",
            email="analyst_b@example.com",
            password_hash=hash_password("Password123!"),
            role="user",
            is_active=True,
            first_login=False,
        )
        # Seed New User C (no logins)
        self.user_c = User(
            id=103,
            username="newbie_c",
            email="newbie_c@example.com",
            password_hash=hash_password("Password123!"),
            role="user",
            is_active=True,
            first_login=False,
        )
        self.db.add_all([self.user_a, self.user_b, self.user_c])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_01_user_with_login_audit_returns_correct_timestamp(self):
        """User with audit log record retrieves the most recent login timestamp."""
        t1 = datetime(2026, 11, 1, 10, 0, 0, tzinfo=timezone.utc)
        t2 = datetime(2026, 11, 3, 3, 45, 0, tzinfo=timezone.utc)  # 09:15 AM IST

        log1 = AuditLog(
            user_id=self.user_a.id,
            user_email=self.user_a.email,
            user_name=self.user_a.username,
            user_role="user",
            action="USER_LOGIN",
            entity_type="user",
            entity_id=str(self.user_a.id),
            description="Login 1",
            created_at=t1,
        )
        log2 = AuditLog(
            user_id=self.user_a.id,
            user_email=self.user_a.email,
            user_name=self.user_a.username,
            user_role="user",
            action="USER_LOGIN",
            entity_type="user",
            entity_id=str(self.user_a.id),
            description="Login 2",
            created_at=t2,
        )
        self.db.add_all([log1, log2])
        self.db.commit()

        # Repository test
        last_dt = get_last_login_for_user(self.db, self.user_a.id)
        self.assertIsNotNone(last_dt)

        # Controller test
        response = get_last_login_controller(self.db, self.user_a)
        self.assertTrue(response.success)
        self.assertEqual(response.user_id, self.user_a.id)
        self.assertEqual(response.username, "investigator_a")
        self.assertEqual(response.formatted_last_login, "03 Nov 2026, 09:15 AM")

    def test_02_user_with_no_login_history_returns_null(self):
        """User with no audit login events returns null and None formatted string."""
        last_dt = get_last_login_for_user(self.db, self.user_c.id)
        self.assertIsNone(last_dt)

        response = get_last_login_controller(self.db, self.user_c)
        self.assertTrue(response.success)
        self.assertEqual(response.user_id, self.user_c.id)
        self.assertIsNone(response.last_login)
        self.assertIsNone(response.last_login_at)
        self.assertIsNone(response.formatted_last_login)

    def test_03_multi_user_isolation(self):
        """User A and User B cannot see each other's login timestamp."""
        t_a = datetime(2026, 11, 2, 8, 30, 0, tzinfo=timezone.utc)
        t_b = datetime(2026, 11, 3, 5, 0, 0, tzinfo=timezone.utc)

        log_a = AuditLog(
            user_id=self.user_a.id,
            user_email=self.user_a.email,
            user_name=self.user_a.username,
            user_role="user",
            action="USER_LOGIN",
            entity_type="user",
            entity_id=str(self.user_a.id),
            description="Login A",
            created_at=t_a,
        )
        log_b = AuditLog(
            user_id=self.user_b.id,
            user_email=self.user_b.email,
            user_name=self.user_b.username,
            user_role="user",
            action="USER_LOGIN",
            entity_type="user",
            entity_id=str(self.user_b.id),
            description="Login B",
            created_at=t_b,
        )
        self.db.add_all([log_a, log_b])
        self.db.commit()

        token_a = create_access_token(user_id=self.user_a.id, role=self.user_a.role)
        token_b = create_access_token(user_id=self.user_b.id, role=self.user_b.role)

        # Call API as User A
        res_a = self.client.get(
            "/api/v1/auth/last-login",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        self.assertEqual(res_a.status_code, 200)
        data_a = res_a.json()
        self.assertEqual(data_a["user_id"], self.user_a.id)
        self.assertEqual(data_a["formatted_last_login"], "02 Nov 2026, 02:00 PM")

        # Call API as User B
        res_b = self.client.get(
            "/api/v1/auth/last-login",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        self.assertEqual(res_b.status_code, 200)
        data_b = res_b.json()
        self.assertEqual(data_b["user_id"], self.user_b.id)
        self.assertEqual(data_b["formatted_last_login"], "03 Nov 2026, 10:30 AM")

        # Attempt to pass user_id as query parameter is ignored
        res_spoof = self.client.get(
            f"/api/v1/auth/last-login?user_id={self.user_b.id}",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        self.assertEqual(res_spoof.status_code, 200)
        self.assertEqual(res_spoof.json()["user_id"], self.user_a.id)

    def test_04_alias_endpoint_users_me_last_login(self):
        """Endpoint /api/v1/users/me/last-login returns identical data to /api/v1/auth/last-login."""
        t_a = datetime(2026, 11, 2, 8, 30, 0, tzinfo=timezone.utc)
        log_a = AuditLog(
            user_id=self.user_a.id,
            user_email=self.user_a.email,
            user_name=self.user_a.username,
            user_role="user",
            action="USER_LOGIN",
            entity_type="user",
            entity_id=str(self.user_a.id),
            description="Login A",
            created_at=t_a,
        )
        self.db.add(log_a)
        self.db.commit()

        token_a = create_access_token(user_id=self.user_a.id, role=self.user_a.role)
        res = self.client.get(
            "/api/v1/users/me/last-login",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["user_id"], self.user_a.id)
        self.assertEqual(data["formatted_last_login"], "02 Nov 2026, 02:00 PM")

    def test_05_failed_login_does_not_create_audit_log(self):
        """Failed logins (incorrect password, nonexistent username) do NOT record USER_LOGIN."""
        # Baseline audit count
        initial_count = self.db.query(AuditLog).filter(AuditLog.action == "USER_LOGIN").count()

        # Failed attempt with incorrect password
        with self.assertRaises(AuthException):
            login_user(
                db=self.db,
                username="investigator_a",
                password="WrongPassword999!",
            )

        # Failed attempt with invalid user
        with self.assertRaises(AuthException):
            login_user(
                db=self.db,
                username="completely_nonexistent_user",
                password="AnyPassword123!",
            )

        # Verify no login audit record was written
        new_count = self.db.query(AuditLog).filter(AuditLog.action == "USER_LOGIN").count()
        self.assertEqual(initial_count, new_count)

    def test_06_successful_login_records_audit_log_with_ip(self):
        """Successful login records USER_LOGIN with user details and IP address."""
        login_user(
            db=self.db,
            username="investigator_a",
            password="Password123!",
            ip_address="192.168.1.100",
        )

        last_log = (
            self.db.query(AuditLog)
            .filter(AuditLog.user_id == self.user_a.id, AuditLog.action == "USER_LOGIN")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        self.assertIsNotNone(last_log)
        self.assertEqual(last_log.ip_address, "192.168.1.100")
        self.assertEqual(last_log.entity_name, "investigator_a")

    def test_07_timezone_formatting_accuracy(self):
        """Verifies UTC to IST formatting for edge times (morning AM and evening PM)."""
        # 03 Nov 2026 03:45 UTC = 09:15 AM IST
        dt1 = datetime(2026, 11, 3, 3, 45, tzinfo=timezone.utc)
        # 03 Nov 2026 15:30 UTC = 09:00 PM IST
        dt2 = datetime(2026, 11, 3, 15, 30, tzinfo=timezone.utc)

        log1 = AuditLog(
            user_id=self.user_a.id,
            user_email=self.user_a.email,
            user_name=self.user_a.username,
            user_role="user",
            action="USER_LOGIN",
            entity_type="user",
            entity_id=str(self.user_a.id),
            description="Login Morning",
            created_at=dt1,
        )
        self.db.add(log1)
        self.db.commit()

        resp1 = get_last_login_controller(self.db, self.user_a)
        self.assertEqual(resp1.formatted_last_login, "03 Nov 2026, 09:15 AM")

        log2 = AuditLog(
            user_id=self.user_a.id,
            user_email=self.user_a.email,
            user_name=self.user_a.username,
            user_role="user",
            action="USER_LOGIN",
            entity_type="user",
            entity_id=str(self.user_a.id),
            description="Login Evening",
            created_at=dt2,
        )
        self.db.add(log2)
        self.db.commit()

        resp2 = get_last_login_controller(self.db, self.user_a)
        self.assertEqual(resp2.formatted_last_login, "03 Nov 2026, 09:00 PM")


if __name__ == "__main__":
    unittest.main()
