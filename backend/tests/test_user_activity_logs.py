import unittest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from datetime import datetime, timezone
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


class TestUserActivityLogs(unittest.TestCase):
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
        # Clean existing test data
        self.db.query(AuditLog).delete()
        self.db.query(User).delete()
        self.db.query(Client).delete()
        self.db.commit()

        # Create two test users
        self.client_company = Client(
            name="Alpha Corp",
            company_code="ALPHA",
            is_active=True,
        )
        self.db.add(self.client_company)
        self.db.commit()
        self.db.refresh(self.client_company)

        self.user1 = User(
            username="investigator1",
            email="inv1@alphacorp.com",
            password_hash=hash_password("Password123!"),
            role="user",
            client_id=self.client_company.id,
            is_active=True,
        )
        self.user2 = User(
            username="investigator2",
            email="inv2@alphacorp.com",
            password_hash=hash_password("Password123!"),
            role="user",
            client_id=self.client_company.id,
            is_active=True,
        )
        self.superadmin = User(
            username="superadmin_user",
            email="admin@factbyte.com",
            password_hash=hash_password("Password123!"),
            role="superadmin",
            client_id=None,
            is_active=True,
        )
        self.db.add_all([self.user1, self.user2, self.superadmin])
        self.db.commit()
        self.db.refresh(self.user1)
        self.db.refresh(self.user2)
        self.db.refresh(self.superadmin)

        self.token1 = create_access_token(self.user1.id, self.user1.role)
        self.token2 = create_access_token(self.user2.id, self.user2.role)
        self.admin_token = create_access_token(self.superadmin.id, self.superadmin.role)

    def tearDown(self):
        self.db.close()

    def test_unauthenticated_request_rejected(self):
        res = self.client.get("/api/v1/audit-logs/me")
        self.assertEqual(res.status_code, 401)

        res2 = self.client.get("/api/v1/audit-logs/me/summary")
        self.assertEqual(res2.status_code, 401)

    def test_user_sees_only_own_activity_logs(self):
        # Create logs for user1
        record_audit_log(
            db=self.db,
            action="USER_LOGIN",
            entity_type="user",
            entity_id=str(self.user1.id),
            entity_name=self.user1.username,
            description="User 1 logged in",
            actor=self.user1,
            module="AUTH",
            status="SUCCESS",
        )
        record_audit_log(
            db=self.db,
            action="CASE_CREATED",
            entity_type="case",
            entity_id="101",
            entity_name="Case Alpha",
            description="Created Case Alpha",
            actor=self.user1,
            module="CASE",
            status="SUCCESS",
        )

        # Create logs for user2
        record_audit_log(
            db=self.db,
            action="USER_LOGIN",
            entity_type="user",
            entity_id=str(self.user2.id),
            entity_name=self.user2.username,
            description="User 2 logged in",
            actor=self.user2,
            module="AUTH",
            status="SUCCESS",
        )

        # User 1 requests /me
        res1 = self.client.get(
            "/api/v1/audit-logs/me",
            headers={"Authorization": f"Bearer {self.token1}"},
        )
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()
        self.assertEqual(data1["total"], 2)
        for log in data1["data"]:
            self.assertEqual(log["user_id"], self.user1.id)

        # User 2 requests /me
        res2 = self.client.get(
            "/api/v1/audit-logs/me",
            headers={"Authorization": f"Bearer {self.token2}"},
        )
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertEqual(data2["total"], 1)
        self.assertEqual(data2["data"][0]["user_id"], self.user2.id)

    def test_filter_by_module_and_status(self):
        record_audit_log(
            db=self.db,
            action="CASE_CREATED",
            entity_type="case",
            entity_id="1",
            entity_name="Case 1",
            description="Created case 1",
            actor=self.user1,
            module="CASE",
            status="SUCCESS",
        )
        record_audit_log(
            db=self.db,
            action="FILE_UPLOAD_FAILED",
            entity_type="file",
            entity_id="2",
            entity_name="test.xlsx",
            description="Upload failed: invalid format",
            actor=self.user1,
            module="UPLOAD",
            status="FAILED",
        )

        # Filter by module=CASE
        res = self.client.get(
            "/api/v1/audit-logs/me?module=CASE",
            headers={"Authorization": f"Bearer {self.token1}"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["total"], 1)
        self.assertEqual(res.json()["data"][0]["module"], "CASE")

        # Filter by status=FAILED
        res_failed = self.client.get(
            "/api/v1/audit-logs/me?status=FAILED",
            headers={"Authorization": f"Bearer {self.token1}"},
        )
        self.assertEqual(res_failed.status_code, 200)
        self.assertEqual(res_failed.json()["total"], 1)
        self.assertEqual(res_failed.json()["data"][0]["status"], "FAILED")

    def test_search_filter(self):
        record_audit_log(
            db=self.db,
            action="FILE_UPLOADED",
            entity_type="file",
            entity_id="12",
            entity_name="HDFC_Statement_March.pdf",
            description="Uploaded statement HDFC_Statement_March.pdf",
            actor=self.user1,
            module="UPLOAD",
            status="SUCCESS",
        )
        record_audit_log(
            db=self.db,
            action="CASE_CREATED",
            entity_type="case",
            entity_id="13",
            entity_name="Operation Hawk",
            description="Initiated case Operation Hawk",
            actor=self.user1,
            module="CASE",
            status="SUCCESS",
        )

        # Search for 'HDFC'
        res = self.client.get(
            "/api/v1/audit-logs/me?search=HDFC",
            headers={"Authorization": f"Bearer {self.token1}"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["total"], 1)
        self.assertIn("HDFC", res.json()["data"][0]["description"])

    def test_user_activity_summary(self):
        record_audit_log(
            db=self.db,
            action="USER_LOGIN",
            entity_type="user",
            entity_id=str(self.user1.id),
            entity_name=self.user1.username,
            description="Login",
            actor=self.user1,
            module="AUTH",
            status="SUCCESS",
        )
        record_audit_log(
            db=self.db,
            action="CASE_CREATED",
            entity_type="case",
            entity_id="5",
            entity_name="Case 5",
            description="Created case",
            actor=self.user1,
            module="CASE",
            status="SUCCESS",
        )
        record_audit_log(
            db=self.db,
            action="REPORT_EXPORTED",
            entity_type="report",
            entity_id="rep-1",
            entity_name="NCRP Report",
            description="Exported NCRP report to Excel",
            actor=self.user1,
            module="REPORT",
            status="SUCCESS",
        )

        res = self.client.get(
            "/api/v1/audit-logs/me/summary",
            headers={"Authorization": f"Bearer {self.token1}"},
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["success"])
        stats = body["stats"]
        self.assertEqual(stats["total_activities"], 3)
        self.assertEqual(stats["successful_actions"], 3)
        self.assertEqual(stats["failed_actions"], 0)
        self.assertEqual(stats["login_sessions"], 1)
        self.assertEqual(stats["cases_created_updated"], 1)
        self.assertEqual(stats["reports_generated"], 1)
        self.assertGreater(len(body["activity_trend"]), 0)
        self.assertGreater(len(body["by_module"]), 0)

    def test_record_client_activity(self):
        payload = {
            "action": "PAGE_VIEW",
            "module": "DASHBOARD",
            "description": "User opened Activity Logs page",
            "entity_type": "page",
            "entity_id": "activity-logs",
            "status": "SUCCESS",
            "details": {"source": "profile_menu"},
        }
        res = self.client.post(
            "/api/v1/audit-logs/activity",
            json=payload,
            headers={"Authorization": f"Bearer {self.token1}"},
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["action"], "PAGE_VIEW")
        self.assertEqual(data["module"], "DASHBOARD")
        self.assertEqual(data["user_id"], self.user1.id)

    def test_activity_logs_alias_endpoint(self):
        # Testing /api/v1/activity-logs/me alias
        res = self.client.get(
            "/api/v1/activity-logs/me",
            headers={"Authorization": f"Bearer {self.token1}"},
        )
        self.assertEqual(res.status_code, 200)

        res_sum = self.client.get(
            "/api/v1/activity-logs/me/summary",
            headers={"Authorization": f"Bearer {self.token1}"},
        )
        self.assertEqual(res_sum.status_code, 200)


if __name__ == "__main__":
    unittest.main()
