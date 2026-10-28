import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.client.client_model import Client
from app.user.user_model import User
from app.user.user_permission_model import UserPermission
from app.case.case_model import Case
from app.files.file_model import File
from app.ncrp.ncrp_model import NcrpFile
from app.io_master.io_master_model import IOMaster
from app.audit.audit_model import AuditLog
from app.client.client_schema import ClientUpdateRequest
from app.client.client_service import update_client_details, delete_client_safely
from app.client.client_controller import update_client_controller, delete_client_controller


class TestClientEditAndDelete(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()
        self.db.query(AuditLog).delete()
        self.db.query(NcrpFile).delete()
        self.db.query(File).delete()
        self.db.query(Case).delete()
        self.db.query(IOMaster).delete()
        self.db.query(UserPermission).delete()
        self.db.query(User).delete()
        self.db.query(Client).delete()
        self.db.commit()

        # Create two clients
        self.client_1 = Client(
            id=1,
            name="Bank of Baroda",
            company_code="BOB01",
            max_users=5,
            is_active=True,
        )
        self.client_2 = Client(
            id=2,
            name="State Bank of India",
            company_code="SBI01",
            max_users=10,
            is_active=True,
        )
        self.db.add_all([self.client_1, self.client_2])
        self.db.commit()

        # Super Admin
        self.superadmin = User(
            id=1,
            username="superadmin",
            email="superadmin@bas.gov.in",
            password_hash="secret",
            role="superadmin",
            is_active=True,
        )

        # Client 1 Admin and Users
        self.client_1_admin = User(
            id=2,
            username="bob_admin",
            email="admin@bob.com",
            password_hash="secret",
            role="client_admin",
            client_id=1,
            is_active=True,
        )
        self.client_1_user = User(
            id=3,
            username="bob_investigator",
            email="inv@bob.com",
            password_hash="secret",
            role="user",
            client_id=1,
            is_active=True,
        )

        # Client 2 Admin
        self.client_2_admin = User(
            id=4,
            username="sbi_admin",
            email="admin@sbi.com",
            password_hash="secret",
            role="client_admin",
            client_id=2,
            is_active=True,
        )

        self.db.add_all([
            self.superadmin,
            self.client_1_admin,
            self.client_1_user,
            self.client_2_admin,
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_update_client_success(self):
        """Super Admin can update client name, code, limit, status, and primary admin email/username."""
        update_data = ClientUpdateRequest(
            name="Bank of Baroda Cyber Division",
            company_code="BOB_CYBER",
            max_users=8,
            is_active=False,
            admin_email="lead_admin@bob.com",
            admin_username="bob_cyber_admin",
        )

        result = update_client_details(
            db=self.db,
            client_id=1,
            data=update_data,
            actor=self.superadmin,
        )

        self.assertEqual(result["client"].name, "Bank of Baroda Cyber Division")
        self.assertEqual(result["client"].company_code, "BOB_CYBER")
        self.assertEqual(result["client"].max_users, 8)
        self.assertFalse(result["client"].is_active)
        self.assertEqual(result["admin_email"], "lead_admin@bob.com")
        self.assertEqual(result["admin_username"], "bob_cyber_admin")
        self.assertEqual(result["current_users_count"], 2)

    def test_update_client_duplicate_name(self):
        """Cannot rename client to an existing client company name."""
        update_data = ClientUpdateRequest(name="State Bank of India")
        with self.assertRaises(ValueError) as ctx:
            update_client_details(
                db=self.db,
                client_id=1,
                data=update_data,
                actor=self.superadmin,
            )
        self.assertIn("already exists", str(ctx.exception))

    def test_update_client_duplicate_code(self):
        """Cannot rename client code to an existing client company code."""
        update_data = ClientUpdateRequest(company_code="SBI01")
        with self.assertRaises(ValueError) as ctx:
            update_client_details(
                db=self.db,
                client_id=1,
                data=update_data,
                actor=self.superadmin,
            )
        self.assertIn("already exists", str(ctx.exception))

    def test_update_client_limit_below_registered_users(self):
        """Cannot decrease max_users below the number of registered users."""
        # Client 1 has 2 users (admin + investigator)
        update_data = ClientUpdateRequest(max_users=1)
        with self.assertRaises(ValueError) as ctx:
            update_client_details(
                db=self.db,
                client_id=1,
                data=update_data,
                actor=self.superadmin,
            )
        self.assertIn("already has 2 registered users", str(ctx.exception))

    def test_update_client_duplicate_admin_email(self):
        """Cannot change admin email to an email used by another user."""
        update_data = ClientUpdateRequest(admin_email="admin@sbi.com")
        with self.assertRaises(ValueError) as ctx:
            update_client_details(
                db=self.db,
                client_id=1,
                data=update_data,
                actor=self.superadmin,
            )
        self.assertIn("already in use by another user", str(ctx.exception))

    def test_delete_client_blocked_by_case_dependencies(self):
        """Cannot delete client if it has dependent investigation cases."""
        # Create case for client 1
        case = Case(
            id=101,
            case_number="BAS-2026-BOB01",
            case_name="Fraud Investigation 01",
            client_id=1,
            created_by=2,
            assigned_to=3,
            status="IN_PROGRESS",
        )
        self.db.add(case)
        self.db.commit()

        with self.assertRaises(ValueError) as ctx:
            delete_client_safely(
                db=self.db,
                client_id=1,
                actor=self.superadmin,
            )

        err_msg = str(ctx.exception)
        self.assertIn("associated investigation records", err_msg)
        self.assertIn("1 investigation case(s)", err_msg)
        self.assertIn("Please deactivate the client instead", err_msg)

    def test_delete_client_blocked_by_file_dependencies(self):
        """Cannot delete client if it has uploaded bank statements or NCRP workbooks."""
        # Create bank statement file created by client 1 user
        file_rec = File(
            id=201,
            case_id=999,
            original_filename="statement.pdf",
            stored_filename="statement_stored.pdf",
            file_path="uploads/statement.pdf",
            file_size=1024,
            mime_type="application/pdf",
            status="UPLOADED",
            created_by=3,
        )
        self.db.add(file_rec)
        self.db.commit()

        with self.assertRaises(ValueError) as ctx:
            delete_client_safely(
                db=self.db,
                client_id=1,
                actor=self.superadmin,
            )

        err_msg = str(ctx.exception)
        self.assertIn("associated investigation records", err_msg)
        self.assertIn("1 bank statement document(s)", err_msg)

    def test_delete_client_success_zero_dependencies(self):
        """Safe to delete client with 0 investigation records; preserves audit logs."""
        # Create an audit log record for client 2
        audit = AuditLog(
            id=1,
            action="LOGIN",
            entity_type="USER",
            entity_id=4,
            entity_name="sbi_admin",
            description="User logged in",
            client_id=2,
            user_id=4,
            user_name="sbi_admin",
            user_email="admin@sbi.com",
            user_role="client_admin",
        )
        self.db.add(audit)
        self.db.commit()

        # Delete client 2 (which has 0 cases, files, or NCRP records)
        result = delete_client_safely(
            db=self.db,
            client_id=2,
            actor=self.superadmin,
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["client_id"], 2)

        # Verify client 2 is removed
        deleted_client = self.db.query(Client).filter(Client.id == 2).first()
        self.assertIsNone(deleted_client)

        # Verify client 2 user is removed
        deleted_user = self.db.query(User).filter(User.client_id == 2).first()
        self.assertIsNone(deleted_user)

        # Verify audit log is preserved with nullified foreign keys
        preserved_audit = self.db.query(AuditLog).filter(AuditLog.id == 1).first()
        self.assertIsNotNone(preserved_audit)
        self.assertIsNone(preserved_audit.client_id)
        self.assertIsNone(preserved_audit.user_id)
        self.assertEqual(preserved_audit.user_email, "admin@sbi.com")

    def test_controller_client_not_found(self):
        """Controller raises ValueError when client ID does not exist."""
        update_data = ClientUpdateRequest(name="Non Existent")
        with self.assertRaises(ValueError) as ctx:
            update_client_controller(
                db=self.db,
                client_id=999,
                data=update_data,
                actor=self.superadmin,
            )
        self.assertIn("not found", str(ctx.exception))

        with self.assertRaises(ValueError) as ctx:
            delete_client_controller(
                db=self.db,
                client_id=999,
                actor=self.superadmin,
            )
        self.assertIn("not found", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
