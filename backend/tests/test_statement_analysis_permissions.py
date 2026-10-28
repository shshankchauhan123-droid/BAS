import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import HTTPException, UploadFile
import io
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.client.client_model import Client
from app.user.user_model import User
from app.user.user_permission_model import UserPermission
from app.case.case_model import Case
from app.files.file_model import File
from app.ncrp.ncrp_model import NcrpFile, NcrpTransaction
from app.user.user_schema import (
    UserCreateRequest,
    UserPermissionsSchema,
    UserPermissionsUpdateRequest,
)
from app.user.user_service import (
    create_user_by_admin,
    update_user_permissions_by_actor,
)
from app.files.file_service import upload_file, get_case_files, get_file_for_view
from app.bank_transactions.bank_transaction_routes import (
    verify_bank_statement_access,
    parse_and_validate_file_ids,
)
from app.ncrp.ncrp_service import validate_ncrp_case_access, process_ncrp_upload


class TestStatementAnalysisPermissions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()
        self.db.query(NcrpTransaction).delete()
        self.db.query(NcrpFile).delete()
        self.db.query(File).delete()
        self.db.query(Case).delete()
        self.db.query(UserPermission).delete()
        self.db.query(User).delete()
        self.db.query(Client).delete()
        self.db.commit()

        # Create Client
        self.client = Client(
            id=1,
            name="Alpha Forensics Bank",
            company_code="AFB01",
            max_users=10,
            is_active=True,
        )
        self.client_other = Client(
            id=2,
            name="Beta Investigation Bureau",
            company_code="BIB01",
            max_users=10,
            is_active=True,
        )
        self.db.add_all([self.client, self.client_other])
        self.db.commit()

        # Create Client Admin
        self.admin = User(
            id=1,
            username="client_admin_alpha",
            email="admin@alpha.com",
            password_hash="secret",
            role="client_admin",
            client_id=1,
            is_active=True,
        )
        self.db.add(self.admin)
        self.db.commit()

        # Create Case belonging to Client 1
        self.case = Case(
            id=10,
            case_number="CASE-AFB-001",
            case_name="Corporate Embezzlement 001",
            client_id=1,
            created_by=1,
            status="IN_PROGRESS",
        )
        # Create Case belonging to Client 2
        self.case_other = Case(
            id=20,
            case_number="CASE-BIB-001",
            case_name="Cross-Tenant Case",
            client_id=2,
            created_by=99,
            status="IN_PROGRESS",
        )
        self.db.add_all([self.case, self.case_other])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_create_user_scenarios_permissions_persistence(self):
        """Test creating users with neither, bank only, ncrp only, or both permissions."""
        # Scenario 1: Neither permission
        user1 = create_user_by_admin(
            db=self.db,
            actor=self.admin,
            data=UserCreateRequest(
                username="user_neither",
                email="neither@alpha.com",
                password="password123",
                permissions=UserPermissionsSchema(
                    can_bank_statement_analysis=False,
                    can_ncrp_statement_analysis=False,
                ),
            ),
        )
        self.assertFalse(user1.permissions.can_bank_statement_analysis)
        self.assertFalse(user1.permissions.can_ncrp_statement_analysis)

        # Scenario 2: Bank Statement Analysis only
        user2 = create_user_by_admin(
            db=self.db,
            actor=self.admin,
            data=UserCreateRequest(
                username="user_bank_only",
                email="bank_only@alpha.com",
                password="password123",
                permissions=UserPermissionsSchema(
                    can_bank_statement_analysis=True,
                    can_ncrp_statement_analysis=False,
                ),
            ),
        )
        self.assertTrue(user2.permissions.can_bank_statement_analysis)
        self.assertFalse(user2.permissions.can_ncrp_statement_analysis)

        # Scenario 3: NCRP Statement Analysis only
        user3 = create_user_by_admin(
            db=self.db,
            actor=self.admin,
            data=UserCreateRequest(
                username="user_ncrp_only",
                email="ncrp_only@alpha.com",
                password="password123",
                permissions=UserPermissionsSchema(
                    can_bank_statement_analysis=False,
                    can_ncrp_statement_analysis=True,
                ),
            ),
        )
        self.assertFalse(user3.permissions.can_bank_statement_analysis)
        self.assertTrue(user3.permissions.can_ncrp_statement_analysis)

        # Scenario 4: Both permissions
        user4 = create_user_by_admin(
            db=self.db,
            actor=self.admin,
            data=UserCreateRequest(
                username="user_both",
                email="both@alpha.com",
                password="password123",
                permissions=UserPermissionsSchema(
                    can_bank_statement_analysis=True,
                    can_ncrp_statement_analysis=True,
                ),
            ),
        )
        self.assertTrue(user4.permissions.can_bank_statement_analysis)
        self.assertTrue(user4.permissions.can_ncrp_statement_analysis)

    def test_edit_user_permissions_updates_persistence(self):
        """Client Admin can modify statement analysis permissions later via update_user_permissions."""
        user = create_user_by_admin(
            db=self.db,
            actor=self.admin,
            data=UserCreateRequest(
                username="user_to_edit",
                email="edit@alpha.com",
                password="password123",
                permissions=UserPermissionsSchema(
                    can_bank_statement_analysis=False,
                    can_ncrp_statement_analysis=False,
                ),
            ),
        )
        self.assertFalse(user.permissions.can_bank_statement_analysis)
        self.assertFalse(user.permissions.can_ncrp_statement_analysis)

        # Update to enable Bank Statement Analysis
        updated_user = update_user_permissions_by_actor(
            db=self.db,
            actor=self.admin,
            user_id=user.id,
            data=UserPermissionsUpdateRequest(
                can_bank_statement_analysis=True,
                can_ncrp_statement_analysis=False,
            ),
        )
        self.assertTrue(updated_user.permissions.can_bank_statement_analysis)
        self.assertFalse(updated_user.permissions.can_ncrp_statement_analysis)

        # Update to enable NCRP and disable Bank
        updated_user_2 = update_user_permissions_by_actor(
            db=self.db,
            actor=self.admin,
            user_id=user.id,
            data=UserPermissionsUpdateRequest(
                can_bank_statement_analysis=False,
                can_ncrp_statement_analysis=True,
            ),
        )
        self.assertFalse(updated_user_2.permissions.can_bank_statement_analysis)
        self.assertTrue(updated_user_2.permissions.can_ncrp_statement_analysis)

    def test_bank_statement_analysis_permission_enforcement(self):
        """User without can_bank_statement_analysis cannot upload bank statements, view bank transactions or reports."""
        user_no_bank = create_user_by_admin(
            db=self.db,
            actor=self.admin,
            data=UserCreateRequest(
                username="investigator_no_bank",
                email="no_bank@alpha.com",
                password="password123",
                permissions=UserPermissionsSchema(
                    can_upload_files=True,  # General upload is granted
                    can_bank_statement_analysis=False,  # But bank statement analysis is denied!
                    can_ncrp_statement_analysis=True,
                ),
            ),
        )

        # Assign case to user
        self.case.assigned_to = user_no_bank.id
        self.db.commit()

        # 1. Attempting to upload bank statement raises PermissionError
        dummy_file = UploadFile(filename="statement.pdf", file=io.BytesIO(b"%PDF-1.4 dummy"))
        with self.assertRaises(PermissionError) as ctx:
            upload_file(
                db=self.db,
                file=dummy_file,
                case_id=self.case.id,
                user=user_no_bank,
                document_type="BANK_STATEMENT",
            )
        self.assertIn("Bank Statement Analysis", str(ctx.exception))

        # 2. Attempting to access bank transaction APIs raises 403
        with self.assertRaises(HTTPException) as ctx:
            verify_bank_statement_access(user_no_bank)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Bank Statement Analysis", ctx.exception.detail)

        # 3. parse_and_validate_file_ids raises 403
        with self.assertRaises(HTTPException) as ctx:
            parse_and_validate_file_ids(
                file_ids="101",
                case_id=self.case.id,
                db=self.db,
                user=user_no_bank,
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_ncrp_statement_analysis_permission_enforcement(self):
        """User without can_ncrp_statement_analysis cannot access NCRP workflows or upload NCRP workbooks."""
        user_no_ncrp = create_user_by_admin(
            db=self.db,
            actor=self.admin,
            data=UserCreateRequest(
                username="investigator_no_ncrp",
                email="no_ncrp@alpha.com",
                password="password123",
                permissions=UserPermissionsSchema(
                    can_upload_files=True,
                    can_bank_statement_analysis=True,
                    can_ncrp_statement_analysis=False,  # NCRP is denied!
                ),
            ),
        )

        # Assign case to user
        self.case.assigned_to = user_no_ncrp.id
        self.db.commit()

        # 1. validate_ncrp_case_access raises 403
        with self.assertRaises(HTTPException) as ctx:
            validate_ncrp_case_access(
                db=self.db,
                case_id=self.case.id,
                user=user_no_ncrp,
            )
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("NCRP Statement Analysis", ctx.exception.detail)

        # 2. process_ncrp_upload raises 403
        dummy_excel = UploadFile(filename="ncrp_sample.xlsx", file=io.BytesIO(b"PK dummy excel"))
        with self.assertRaises(HTTPException) as ctx:
            process_ncrp_upload(
                db=self.db,
                case_id=self.case.id,
                file=dummy_excel,
                current_user=user_no_ncrp,
            )
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("NCRP Statement Analysis", ctx.exception.detail)

    def test_general_upload_and_reports_independence(self):
        """General can_upload_files=False blocks upload even if can_bank/ncrp is True."""
        user_no_upload = create_user_by_admin(
            db=self.db,
            actor=self.admin,
            data=UserCreateRequest(
                username="analyst_no_upload",
                email="no_upload@alpha.com",
                password="password123",
                permissions=UserPermissionsSchema(
                    can_upload_files=False,  # Upload denied
                    can_bank_statement_analysis=True,
                    can_ncrp_statement_analysis=True,
                ),
            ),
        )
        self.case.assigned_to = user_no_upload.id
        self.db.commit()

        # Bank statement upload is blocked by general can_upload_files
        dummy_file = UploadFile(filename="statement.pdf", file=io.BytesIO(b"%PDF-1.4 dummy"))
        with self.assertRaises(PermissionError) as ctx:
            upload_file(
                db=self.db,
                file=dummy_file,
                case_id=self.case.id,
                user=user_no_upload,
                document_type="BANK_STATEMENT",
            )
        self.assertIn("permission to upload files", str(ctx.exception))

        # NCRP upload is blocked by general can_upload_files
        dummy_excel = UploadFile(filename="ncrp_sample.xlsx", file=io.BytesIO(b"PK dummy excel"))
        with self.assertRaises(HTTPException) as ctx:
            process_ncrp_upload(
                db=self.db,
                case_id=self.case.id,
                file=dummy_excel,
                current_user=user_no_upload,
            )
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("permission to upload files", ctx.exception.detail)

    def test_tenant_isolation_preserved_with_permissions(self):
        """Even with both permissions, user cannot access cases from another client."""
        user_client1 = create_user_by_admin(
            db=self.db,
            actor=self.admin,
            data=UserCreateRequest(
                username="investigator_both",
                email="both_alpha@alpha.com",
                password="password123",
                permissions=UserPermissionsSchema(
                    can_bank_statement_analysis=True,
                    can_ncrp_statement_analysis=True,
                ),
            ),
        )

        # Attempt to access case belonging to Client 2
        with self.assertRaises(HTTPException) as ctx:
            validate_ncrp_case_access(
                db=self.db,
                case_id=self.case_other.id,
                user=user_client1,
            )
        # Should return 404 (not found or access denied) protecting tenant privacy
        self.assertEqual(ctx.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
