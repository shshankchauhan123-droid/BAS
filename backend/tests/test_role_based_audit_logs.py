import os
import sys
import unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.user.user_model import User
from app.client.client_model import Client
from app.audit.audit_model import AuditLog
from app.audit.audit_service import record_audit_log


class TestRoleBasedAuditLogs(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.TestingSessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=cls.engine
        )
        Base.metadata.create_all(cls.engine)

        def override_get_db():
            db = cls.TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(cls.engine)

    def setUp(self):
        self.db = self.TestingSessionLocal()
        self.db.query(AuditLog).delete()
        self.db.query(User).delete()
        self.db.query(Client).delete()
        self.db.commit()

        # Company 1 (Alpha)
        self.client_alpha = Client(
            name="Alpha Corp",
            company_code="ALPHA",
            is_active=True,
        )
        # Company 2 (Beta)
        self.client_beta = Client(
            name="Beta LLC",
            company_code="BETA",
            is_active=True,
        )
        self.db.add_all([self.client_alpha, self.client_beta])
        self.db.commit()
        self.db.refresh(self.client_alpha)
        self.db.refresh(self.client_beta)

        # Users in Alpha
        self.alpha_client_admin = User(
            username="alpha_admin",
            email="admin@alpha.com",
            password_hash=hash_password("Pass123!"),
            role="client_admin",
            client_id=self.client_alpha.id,
            is_active=True,
        )
        self.alpha_user = User(
            username="alpha_analyst",
            email="analyst@alpha.com",
            password_hash=hash_password("Pass123!"),
            role="user",
            client_id=self.client_alpha.id,
            is_active=True,
        )

        # Users in Beta
        self.beta_client_admin = User(
            username="beta_admin",
            email="admin@beta.com",
            password_hash=hash_password("Pass123!"),
            role="client_admin",
            client_id=self.client_beta.id,
            is_active=True,
        )
        self.beta_user = User(
            username="beta_analyst",
            email="analyst@beta.com",
            password_hash=hash_password("Pass123!"),
            role="user",
            client_id=self.client_beta.id,
            is_active=True,
        )

        # Super Admin
        self.superadmin = User(
            username="super_factbyte",
            email="super@factbyte.com",
            password_hash=hash_password("Pass123!"),
            role="superadmin",
            client_id=None,
            is_active=True,
        )

        self.db.add_all([
            self.alpha_client_admin,
            self.alpha_user,
            self.beta_client_admin,
            self.beta_user,
            self.superadmin,
        ])
        self.db.commit()

        for u in [
            self.alpha_client_admin,
            self.alpha_user,
            self.beta_client_admin,
            self.beta_user,
            self.superadmin,
        ]:
            self.db.refresh(u)

        self.token_alpha_admin = create_access_token(self.alpha_client_admin.id, self.alpha_client_admin.role)
        self.token_alpha_user = create_access_token(self.alpha_user.id, self.alpha_user.role)
        self.token_beta_admin = create_access_token(self.beta_client_admin.id, self.beta_client_admin.role)
        self.token_superadmin = create_access_token(self.superadmin.id, self.superadmin.role)

        # Add audit logs
        record_audit_log(
            db=self.db,
            action="CASE_CREATED",
            entity_type="case",
            entity_id="101",
            entity_name="Case 101",
            description="Alpha analyst created case",
            actor=self.alpha_user,
            module="CASE",
            status="SUCCESS",
        )
        record_audit_log(
            db=self.db,
            action="FILE_UPLOADED",
            entity_type="file",
            entity_id="202",
            entity_name="statement.pdf",
            description="Alpha analyst uploaded file",
            actor=self.alpha_user,
            module="UPLOAD",
            status="SUCCESS",
        )
        record_audit_log(
            db=self.db,
            action="CASE_CREATED",
            entity_type="case",
            entity_id="303",
            entity_name="Case 303",
            description="Beta analyst created case",
            actor=self.beta_user,
            module="CASE",
            status="SUCCESS",
        )

    def tearDown(self):
        self.db.close()

    def test_superadmin_can_list_companies(self):
        res = self.client.get(
            "/api/v1/audit-logs/companies",
            headers={"Authorization": f"Bearer {self.token_superadmin}"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        company_names = [c["name"] for c in data["data"]]
        self.assertIn("Alpha Corp", company_names)
        self.assertIn("Beta LLC", company_names)

    def test_client_admin_forbidden_from_listing_all_companies(self):
        res = self.client.get(
            "/api/v1/audit-logs/companies",
            headers={"Authorization": f"Bearer {self.token_alpha_admin}"},
        )
        self.assertEqual(res.status_code, 403)

    def test_superadmin_can_list_company_users(self):
        res = self.client.get(
            f"/api/v1/audit-logs/company-users?company_id={self.client_alpha.id}",
            headers={"Authorization": f"Bearer {self.token_superadmin}"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        usernames = [u["username"] for u in data["data"]]
        self.assertIn("alpha_admin", usernames)
        self.assertIn("alpha_analyst", usernames)
        self.assertNotIn("beta_analyst", usernames)

    def test_client_admin_can_list_own_company_users(self):
        res = self.client.get(
            "/api/v1/audit-logs/me/company-users",
            headers={"Authorization": f"Bearer {self.token_alpha_admin}"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        usernames = [u["username"] for u in data["data"]]
        self.assertIn("alpha_admin", usernames)
        self.assertIn("alpha_analyst", usernames)
        self.assertNotIn("beta_analyst", usernames)

    def test_client_admin_cannot_access_other_company_users(self):
        res = self.client.get(
            f"/api/v1/audit-logs/company-users?company_id={self.client_beta.id}",
            headers={"Authorization": f"Bearer {self.token_alpha_admin}"},
        )
        self.assertEqual(res.status_code, 403)

    def test_client_admin_can_view_logs_and_summary_for_own_user(self):
        res_logs = self.client.get(
            f"/api/v1/audit-logs/user/{self.alpha_user.id}",
            headers={"Authorization": f"Bearer {self.token_alpha_admin}"},
        )
        self.assertEqual(res_logs.status_code, 200)
        data = res_logs.json()
        self.assertEqual(data["total"], 2)

        res_sum = self.client.get(
            f"/api/v1/audit-logs/user/{self.alpha_user.id}/summary",
            headers={"Authorization": f"Bearer {self.token_alpha_admin}"},
        )
        self.assertEqual(res_sum.status_code, 200)
        sum_data = res_sum.json()
        self.assertEqual(sum_data["stats"]["total_activities"], 2)

    def test_client_admin_forbidden_from_viewing_other_company_user_logs(self):
        # Alpha admin trying to view Beta user logs
        res = self.client.get(
            f"/api/v1/audit-logs/user/{self.beta_user.id}",
            headers={"Authorization": f"Bearer {self.token_alpha_admin}"},
        )
        self.assertEqual(res.status_code, 403)

        # Alpha admin trying to view Beta user summary
        res_sum = self.client.get(
            f"/api/v1/audit-logs/user/{self.beta_user.id}/summary",
            headers={"Authorization": f"Bearer {self.token_alpha_admin}"},
        )
        self.assertEqual(res_sum.status_code, 403)

    def test_superadmin_can_view_user_logs_and_summary(self):
        res = self.client.get(
            f"/api/v1/audit-logs/user/{self.alpha_user.id}?company_id={self.client_alpha.id}",
            headers={"Authorization": f"Bearer {self.token_superadmin}"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["total"], 2)

    def test_regular_user_forbidden_from_all_audit_endpoints(self):
        for endpoint in [
            "/api/v1/audit-logs/companies",
            "/api/v1/audit-logs/company-users",
            "/api/v1/audit-logs/me/company-users",
            f"/api/v1/audit-logs/user/{self.alpha_user.id}",
            f"/api/v1/audit-logs/user/{self.alpha_user.id}/summary",
        ]:
            res = self.client.get(
                endpoint,
                headers={"Authorization": f"Bearer {self.token_alpha_user}"},
            )
            self.assertEqual(res.status_code, 403, f"Endpoint {endpoint} should be 403 for user")


if __name__ == "__main__":
    unittest.main()
