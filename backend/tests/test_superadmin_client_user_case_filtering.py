import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.client.client_model import Client
from app.user.user_model import User
from app.case.case_model import Case
from app.files.file_model import File
from app.ncrp.ncrp_model import NcrpFile, NcrpTransaction
from fastapi import HTTPException
from app.case.case_service import get_cases as service_get_cases
from app.case.case_controller import get_cases as controller_get_cases
from app.ncrp.ncrp_service import validate_ncrp_case_access


class TestSuperAdminClientUserCaseFiltering(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()
        self.db.query(File).delete()
        self.db.query(Case).delete()
        self.db.query(User).delete()
        self.db.query(Client).delete()
        self.db.commit()

        # Create 2 clients
        self.client_a = Client(
            id=1,
            name="Bank of Baroda Cyber Cell",
            company_code="BOB001",
            max_users=10,
            is_active=True,
        )
        self.client_b = Client(
            id=2,
            name="State Bank of India CID",
            company_code="SBI001",
            max_users=10,
            is_active=True,
        )
        self.db.add_all([self.client_a, self.client_b])
        self.db.commit()

        # Create SuperAdmin
        self.superadmin = User(
            id=1,
            username="superadmin_user",
            email="superadmin@bas.gov.in",
            password_hash="hashed",
            role="superadmin",
            is_active=True,
        )

        # Create Client Admin for Client A
        self.client_a_admin = User(
            id=2,
            username="bob_admin",
            email="admin@bob.com",
            password_hash="hashed",
            role="client_admin",
            client_id=1,
            is_active=True,
        )

        # Create Users under Client A
        self.user_a1 = User(
            id=3,
            username="bob_investigator_1",
            email="inv1@bob.com",
            password_hash="hashed",
            role="user",
            client_id=1,
            is_active=True,
        )
        self.user_a2 = User(
            id=4,
            username="bob_investigator_2",
            email="inv2@bob.com",
            password_hash="hashed",
            role="user",
            client_id=1,
            is_active=True,
        )

        # Create User under Client B
        self.user_b1 = User(
            id=5,
            username="sbi_investigator_1",
            email="inv1@sbi.com",
            password_hash="hashed",
            role="user",
            client_id=2,
            is_active=True,
        )

        self.db.add_all([
            self.superadmin,
            self.client_a_admin,
            self.user_a1,
            self.user_a2,
            self.user_b1,
        ])
        self.db.commit()

        # Create cases:
        # Case 1: Client A, created by user_a1
        self.case_a1 = Case(
            id=1,
            case_number="BAS-2026-000001",
            case_name="BOB Fraud Ring Case A1",
            status="IN_PROGRESS",
            created_by=self.user_a1.id,
            client_id=self.client_a.id,
        )
        # Case 2: Client A, created by user_a2
        self.case_a2 = Case(
            id=2,
            case_number="BAS-2026-000002",
            case_name="BOB Mule Accounts Case A2",
            status="DRAFT",
            created_by=self.user_a2.id,
            client_id=self.client_a.id,
        )
        # Case 3: Client B, created by user_b1
        self.case_b1 = Case(
            id=3,
            case_number="BAS-2026-000003",
            case_name="SBI Phishing Ring Case B1",
            status="COMPLETED",
            created_by=self.user_b1.id,
            client_id=self.client_b.id,
        )

        self.db.add_all([self.case_a1, self.case_a2, self.case_b1])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_superadmin_see_all_cases_when_no_filter(self):
        cases = service_get_cases(
            db=self.db,
            user_id=self.superadmin.id,
        )
        self.assertEqual(len(cases), 3)

    def test_superadmin_filter_by_client_id(self):
        # Filter by Client A (should return case_a1 and case_a2)
        cases_a = service_get_cases(
            db=self.db,
            user_id=self.superadmin.id,
            target_client_id=self.client_a.id,
        )
        self.assertEqual(len(cases_a), 2)
        case_ids_a = {c.id for c in cases_a}
        self.assertEqual(case_ids_a, {self.case_a1.id, self.case_a2.id})

        # Filter by Client B (should return case_b1)
        cases_b = service_get_cases(
            db=self.db,
            user_id=self.superadmin.id,
            target_client_id=self.client_b.id,
        )
        self.assertEqual(len(cases_b), 1)
        self.assertEqual(cases_b[0].id, self.case_b1.id)

    def test_superadmin_filter_by_user_id(self):
        cases_user_a1 = service_get_cases(
            db=self.db,
            user_id=self.superadmin.id,
            target_user_id=self.user_a1.id,
        )
        self.assertEqual(len(cases_user_a1), 1)
        self.assertEqual(cases_user_a1[0].id, self.case_a1.id)

    def test_superadmin_filter_by_client_and_user_cascading(self):
        # Matching user_a1 under client_a
        cases = service_get_cases(
            db=self.db,
            user_id=self.superadmin.id,
            target_user_id=self.user_a1.id,
            target_client_id=self.client_a.id,
        )
        self.assertEqual(len(cases), 1)
        self.assertEqual(cases[0].id, self.case_a1.id)

    def test_superadmin_mismatched_client_and_user_rejected(self):
        # user_b1 belongs to client_b, but client_a is requested
        with self.assertRaises(ValueError) as ctx:
            service_get_cases(
                db=self.db,
                user_id=self.superadmin.id,
                target_user_id=self.user_b1.id,
                target_client_id=self.client_a.id,
            )
        self.assertIn("does not belong to the selected client", str(ctx.exception))

    def test_superadmin_nonexistent_client_rejected(self):
        with self.assertRaises(ValueError) as ctx:
            service_get_cases(
                db=self.db,
                user_id=self.superadmin.id,
                target_client_id=9999,
            )
        self.assertIn("Selected client not found", str(ctx.exception))

    def test_superadmin_nonexistent_user_rejected(self):
        with self.assertRaises(ValueError) as ctx:
            service_get_cases(
                db=self.db,
                user_id=self.superadmin.id,
                target_user_id=9999,
            )
        self.assertIn("Selected user not found", str(ctx.exception))

    def test_client_admin_cannot_access_other_client(self):
        with self.assertRaises(PermissionError) as ctx:
            service_get_cases(
                db=self.db,
                user_id=self.client_a_admin.id,
                target_client_id=self.client_b.id,
            )
        self.assertIn("do not have permission", str(ctx.exception))

    def test_controller_kpis_with_cascaded_filtering(self):
        res = controller_get_cases(
            db=self.db,
            user_id=self.superadmin.id,
            target_user_id=self.user_a1.id,
            target_client_id=self.client_a.id,
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["total"], 1)
        self.assertEqual(res["kpis"]["total_cases"], 1)
        self.assertEqual(res["kpis"]["in_progress_cases"], 1)

    def test_ncrp_case_access_superadmin_with_valid_client_and_user(self):
        case = validate_ncrp_case_access(
            db=self.db,
            case_id=self.case_a1.id,
            user=self.superadmin,
            target_client_id=self.client_a.id,
            target_user_id=self.user_a1.id,
        )
        self.assertIsNotNone(case)
        self.assertEqual(case.id, self.case_a1.id)

    def test_ncrp_case_access_superadmin_with_mismatched_client(self):
        with self.assertRaises(HTTPException) as ctx:
            validate_ncrp_case_access(
                db=self.db,
                case_id=self.case_a1.id,
                user=self.superadmin,
                target_client_id=self.client_b.id,
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("does not belong to the selected client", ctx.exception.detail)

    def test_ncrp_case_access_superadmin_with_mismatched_user(self):
        with self.assertRaises(HTTPException) as ctx:
            validate_ncrp_case_access(
                db=self.db,
                case_id=self.case_a1.id,
                user=self.superadmin,
                target_client_id=self.client_a.id,
                target_user_id=self.user_a2.id,
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("does not belong to the selected user", ctx.exception.detail)

    def test_ncrp_case_access_client_admin_forbidden_other_client(self):
        with self.assertRaises(HTTPException) as ctx:
            validate_ncrp_case_access(
                db=self.db,
                case_id=self.case_b1.id,
                user=self.client_a_admin,
            )
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("permission to access cases for another client", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()
