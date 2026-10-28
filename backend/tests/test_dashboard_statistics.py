import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.user.user_model import User
from app.case.case_model import Case
from app.io_master.io_master_model import IOMaster
from app.files.file_model import File
from app.bank_transactions.bank_transaction_model import BankTransaction
from app.ncrp.ncrp_model import NcrpFile, NcrpTransaction
from app.dashboard.dashboard_route import get_dashboard_statistics


class TestDashboardStatistics(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()
        # Clean tables in safe order
        self.db.query(NcrpTransaction).delete()
        self.db.query(NcrpFile).delete()
        self.db.query(BankTransaction).delete()
        self.db.query(File).delete()
        self.db.query(IOMaster).delete()
        self.db.query(Case).delete()
        self.db.query(User).delete()
        self.db.commit()

        # Create Users
        # 1. SuperAdmin
        self.superadmin = User(
            id=1,
            username="superadmin",
            email="superadmin@bas.local",
            password_hash="hash",
            role="superadmin",
            is_active=True,
        )
        # 2. Client Admin (client_id=10)
        self.client_admin = User(
            id=2,
            username="client_admin_10",
            email="ca10@bas.local",
            password_hash="hash",
            role="client_admin",
            client_id=10,
            is_active=True,
        )
        # 3. Regular User A (client_id=10)
        self.user_a = User(
            id=3,
            username="user_a",
            email="usera@bas.local",
            password_hash="hash",
            role="user",
            client_id=10,
            is_active=True,
        )
        # 4. Regular User B (client_id=20, different client)
        self.user_b = User(
            id=4,
            username="user_b",
            email="userb@bas.local",
            password_hash="hash",
            role="user",
            client_id=20,
            is_active=True,
        )
        self.db.add_all([self.superadmin, self.client_admin, self.user_a, self.user_b])
        self.db.commit()

        # Create Cases
        # Case 1: Owned by user_a, client_id=10
        self.case1 = Case(
            id=1,
            case_number="BAS-TEST-001",
            case_name="Client 10 Case 1",
            status="IN_PROGRESS",
            client_id=10,
            created_by=self.user_a.id,
            assigned_to=self.user_a.id,
        )
        # Case 2: Owned by user_b, client_id=20
        self.case2 = Case(
            id=2,
            case_number="BAS-TEST-002",
            case_name="Client 20 Case 2",
            status="DRAFT",
            client_id=20,
            created_by=self.user_b.id,
            assigned_to=self.user_b.id,
        )
        self.db.add_all([self.case1, self.case2])
        self.db.commit()

        # Create IO Master records
        self.io1 = IOMaster(id=1, officer_name="Officer 1", designation="Inspector", police_station="PS 1", created_by=self.user_a.id)
        self.io2 = IOMaster(id=2, officer_name="Officer 2", designation="DSP", police_station="PS 2", created_by=self.user_b.id)
        self.db.add_all([self.io1, self.io2])
        self.db.commit()

        # Create Bank Statement Files
        # File 1: Bank statement on Case 1 (active)
        self.stmt1 = File(
            id=1,
            case_id=self.case1.id,
            created_by=self.user_a.id,
            original_filename="hdfc.pdf",
            stored_filename="hdfc.pdf",
            file_path="/tmp/hdfc.pdf",
            file_size=1024,
            document_type="BANK_STATEMENT",
            is_superseded=False,
        )
        # File 2: Bank statement on Case 1 (superseded - should NOT be counted)
        self.stmt_old = File(
            id=2,
            case_id=self.case1.id,
            created_by=self.user_a.id,
            original_filename="hdfc_old.pdf",
            stored_filename="hdfc_old.pdf",
            file_path="/tmp/hdfc_old.pdf",
            file_size=1024,
            document_type="BANK_STATEMENT",
            is_superseded=True,
        )
        # File 3: Bank statement on Case 2 (active)
        self.stmt2 = File(
            id=3,
            case_id=self.case2.id,
            created_by=self.user_b.id,
            original_filename="sbi.pdf",
            stored_filename="sbi.pdf",
            file_path="/tmp/sbi.pdf",
            file_size=2048,
            document_type="BANK_STATEMENT",
            is_superseded=False,
        )
        self.db.add_all([self.stmt1, self.stmt_old, self.stmt2])
        self.db.commit()

        # Create Bank Transactions
        # 2 transactions on stmt1
        self.btxn1 = BankTransaction(id=1, file_id=self.stmt1.id, case_id=self.case1.id, description="Txn 1", credit=500.0)
        self.btxn2 = BankTransaction(id=2, file_id=self.stmt1.id, case_id=self.case1.id, description="Txn 2", credit=1500.0)
        # 1 transaction on stmt2
        self.btxn3 = BankTransaction(id=3, file_id=self.stmt2.id, case_id=self.case2.id, description="Txn 3", credit=2500.0)
        self.db.add_all([self.btxn1, self.btxn2, self.btxn3])
        self.db.commit()

        # Create NCRP Files (Workbooks)
        # NCRP File 1: COMPLETED, on Case 1
        self.ncrp1 = NcrpFile(
            id=1,
            case_id=self.case1.id,
            original_filename="ncrp_fraud_data.xlsx",
            stored_filename="ncrp1.xlsx",
            file_path="/tmp/ncrp1.xlsx",
            file_size=50000,
            status="COMPLETED",
            created_by=self.user_a.id,
        )
        # NCRP File 2: FAILED, on Case 1 (should NOT be counted)
        self.ncrp_failed = NcrpFile(
            id=2,
            case_id=self.case1.id,
            original_filename="corrupted.xlsx",
            stored_filename="corrupted.xlsx",
            file_path="/tmp/corrupted.xlsx",
            file_size=1000,
            status="FAILED",
            created_by=self.user_a.id,
        )
        # NCRP File 3: COMPLETED, on Case 2
        self.ncrp2 = NcrpFile(
            id=3,
            case_id=self.case2.id,
            original_filename="ncrp_case2_data.xlsx",
            stored_filename="ncrp2.xlsx",
            file_path="/tmp/ncrp2.xlsx",
            file_size=60000,
            status="COMPLETED",
            created_by=self.user_b.id,
        )
        self.db.add_all([self.ncrp1, self.ncrp_failed, self.ncrp2])
        self.db.commit()

        # Create NCRP Transactions
        # ncrp1 has 3 transactions across multiple sheets
        self.ntxn1 = NcrpTransaction(
            id=1,
            ncrp_file_id=self.ncrp1.id,
            case_id=self.case1.id,
            row_number=1,
            layer="Layer 1",
            sheet_name="Money Transfer to",
            account_or_wallet_id="1111111111",
            transaction_amount=10000.0,
        )
        self.ntxn2 = NcrpTransaction(
            id=2,
            ncrp_file_id=self.ncrp1.id,
            case_id=self.case1.id,
            row_number=2,
            layer="Layer 2",
            sheet_name="Withdrawal through ATM",
            account_or_wallet_id="2222222222",
            transaction_amount=5000.0,
        )
        self.ntxn3 = NcrpTransaction(
            id=3,
            ncrp_file_id=self.ncrp1.id,
            case_id=self.case1.id,
            row_number=3,
            layer="Layer 3",
            sheet_name="Other",
            account_or_wallet_id="3333333333",
            transaction_amount=2500.0,
        )
        # Transaction on the FAILED ncrp file (should NOT be counted)
        self.ntxn_failed = NcrpTransaction(
            id=4,
            ncrp_file_id=self.ncrp_failed.id,
            case_id=self.case1.id,
            row_number=1,
            layer="Layer 1",
            sheet_name="Money Transfer to",
            account_or_wallet_id="9999999999",
            transaction_amount=99999.0,
        )
        # ncrp2 has 2 transactions
        self.ntxn5 = NcrpTransaction(
            id=5,
            ncrp_file_id=self.ncrp2.id,
            case_id=self.case2.id,
            row_number=1,
            layer="Layer 1",
            sheet_name="Money Transfer to",
            account_or_wallet_id="4444444444",
            transaction_amount=12000.0,
        )
        self.ntxn6 = NcrpTransaction(
            id=6,
            ncrp_file_id=self.ncrp2.id,
            case_id=self.case2.id,
            row_number=2,
            layer="Layer 2",
            sheet_name="Withdrawal through POS",
            account_or_wallet_id="5555555555",
            transaction_amount=8000.0,
        )
        self.db.add_all([self.ntxn1, self.ntxn2, self.ntxn3, self.ntxn_failed, self.ntxn5, self.ntxn6])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_superadmin_statistics(self):
        """Superadmin should see all statistics across all clients and users."""
        stats = get_dashboard_statistics(db=self.db, current_user=self.superadmin)

        self.assertEqual(stats["analysis_cases"], 2)
        self.assertEqual(stats["investigating_officers"], 2)
        # Bank statements: 2 active (stmt_old is superseded)
        self.assertEqual(stats["bank_statements"], 2)
        # Bank transactions: 3 total
        self.assertEqual(stats["transactions"], 3)
        # NCRP statements: 2 non-failed workbooks (ncrp_failed is excluded)
        self.assertEqual(stats["ncrp_statements"], 2)
        self.assertEqual(stats["ncrp_statement_count"], 2)
        # NCRP transactions: 5 (ntxn_failed is excluded)
        self.assertEqual(stats["ncrp_transactions"], 5)
        self.assertEqual(stats["ncrp_transaction_count"], 5)
        self.assertEqual(stats["analytical_reports"], 0)

    def test_client_admin_statistics(self):
        """Client admin for client_id=10 should only see records associated with client_id=10."""
        stats = get_dashboard_statistics(db=self.db, current_user=self.client_admin)

        # Only Case 1 belongs to client 10
        self.assertEqual(stats["analysis_cases"], 1)
        # Only IO created by user in client 10
        self.assertEqual(stats["investigating_officers"], 1)
        # Only stmt1 on Case 1
        self.assertEqual(stats["bank_statements"], 1)
        # Only 2 transactions on stmt1
        self.assertEqual(stats["transactions"], 2)
        # Only ncrp1 on Case 1
        self.assertEqual(stats["ncrp_statements"], 1)
        self.assertEqual(stats["ncrp_statement_count"], 1)
        # Only 3 transactions on ncrp1
        self.assertEqual(stats["ncrp_transactions"], 3)
        self.assertEqual(stats["ncrp_transaction_count"], 3)

    def test_regular_user_statistics(self):
        """Regular user_a should only see records created by or assigned to user_a."""
        stats = get_dashboard_statistics(db=self.db, current_user=self.user_a)

        self.assertEqual(stats["analysis_cases"], 1)
        self.assertEqual(stats["investigating_officers"], 1)
        self.assertEqual(stats["bank_statements"], 1)
        self.assertEqual(stats["transactions"], 2)
        self.assertEqual(stats["ncrp_statements"], 1)
        self.assertEqual(stats["ncrp_statement_count"], 1)
        self.assertEqual(stats["ncrp_transactions"], 3)
        self.assertEqual(stats["ncrp_transaction_count"], 3)

    def test_empty_ncrp_data_returns_zero(self):
        """When no NCRP data exists, KPI counts should return integer 0."""
        self.db.query(NcrpTransaction).delete()
        self.db.query(NcrpFile).delete()
        self.db.commit()

        stats = get_dashboard_statistics(db=self.db, current_user=self.superadmin)
        self.assertEqual(stats["ncrp_statements"], 0)
        self.assertEqual(stats["ncrp_statement_count"], 0)
        self.assertEqual(stats["ncrp_transactions"], 0)
        self.assertEqual(stats["ncrp_transaction_count"], 0)
        # Bank statements and transactions are intact
        self.assertEqual(stats["bank_statements"], 2)
        self.assertEqual(stats["transactions"], 3)


if __name__ == "__main__":
    unittest.main()
