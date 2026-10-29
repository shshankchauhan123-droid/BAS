import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.user.user_model import User
from app.case.case_model import Case
from app.files.file_model import File
from app.ncrp.ncrp_model import NcrpFile, NcrpTransaction
from app.case.case_service import populate_case_document_counts
from app.case.case_controller import get_cases as controller_get_cases
from app.case.case_schema import CaseListResponse, CaseKPIs, CaseData


class TestCaseKPIsAndDocumentCounts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Use an in-memory SQLite database for isolated unit testing
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()
        # Clean tables
        self.db.query(NcrpTransaction).delete()
        self.db.query(NcrpFile).delete()
        self.db.query(File).delete()
        self.db.query(Case).delete()
        self.db.query(User).delete()
        self.db.commit()

        # Create admin user
        self.admin = User(
            id=1,
            username="admin_user",
            email="admin@example.com",
            password_hash="dummy",
            role="superadmin",
            is_active=True,
        )
        self.db.add(self.admin)

        # Create 4 cases with different statuses:
        # Case 1: DRAFT with 2 bank statements and 1 NCRP workbook
        self.case1 = Case(
            id=1,
            case_number="BAS-2026-000001",
            case_name="Fraud Investigation Case 1",
            status="DRAFT",
            created_by=1,
        )
        # Case 2: IN_PROGRESS with 1 bank statement (and 1 superseded file that shouldn't count)
        self.case2 = Case(
            id=2,
            case_number="BAS-2026-000002",
            case_name="Hawala Tracking Case 2",
            status="IN_PROGRESS",
            created_by=1,
        )
        # Case 3: COMPLETED with 1 NCRP workbook (with multiple transactions) and 0 bank statements
        self.case3 = Case(
            id=3,
            case_number="BAS-2026-000003",
            case_name="Cyber Financial Scam Case 3",
            status="COMPLETED",
            created_by=1,
        )
        # Case 4: DRAFT with 0 documents
        self.case4 = Case(
            id=4,
            case_number="BAS-2026-000004",
            case_name="Empty Case 4",
            status="DRAFT",
            created_by=1,
        )
        self.db.add_all([self.case1, self.case2, self.case3, self.case4])
        self.db.commit()

        # Add files for Case 1 (2 active bank statements, 1 NCRP workbook)
        self.f1 = File(
            id=1,
            case_id=1,
            created_by=1,
            original_filename="hdfc_stmt.pdf",
            stored_filename="s1.pdf",
            file_path="/tmp/s1.pdf",
            file_size=1024,
            document_type="BANK_STATEMENT",
            is_superseded=False,
        )
        self.f2 = File(
            id=2,
            case_id=1,
            created_by=1,
            original_filename="sbi_stmt.pdf",
            stored_filename="s2.pdf",
            file_path="/tmp/s2.pdf",
            file_size=2048,
            document_type="BANK_STATEMENT",
            is_superseded=False,
        )
        self.ncrp1 = NcrpFile(
            id=1,
            case_id=1,
            created_by=1,
            original_filename="ncrp_portal_export.xlsx",
            stored_filename="n1.xlsx",
            file_path="/tmp/n1.xlsx",
            file_size=1024,
            total_rows=250,
            status="COMPLETED",
        )

        # Add files for Case 2 (1 active bank statement, 1 superseded file)
        self.f3 = File(
            id=3,
            case_id=2,
            created_by=1,
            original_filename="icici_merged.xlsx",
            stored_filename="s3.xlsx",
            file_path="/tmp/s3.xlsx",
            file_size=4096,
            document_type="BANK_STATEMENT",
            is_superseded=False,
        )
        self.f3_old = File(
            id=4,
            case_id=2,
            created_by=1,
            original_filename="icici_part1.xlsx",
            stored_filename="s4.xlsx",
            file_path="/tmp/s4.xlsx",
            file_size=2048,
            document_type="BANK_STATEMENT",
            is_superseded=True,  # superseded must not count
        )

        # Add NCRP file for Case 3 (1 workbook with multiple transactions across worksheets)
        self.ncrp2 = NcrpFile(
            id=2,
            case_id=3,
            created_by=1,
            original_filename="multi_layer_workbook.xlsx",
            stored_filename="n2.xlsx",
            file_path="/tmp/n2.xlsx",
            file_size=2048,
            total_rows=500,
            status="COMPLETED",
        )
        self.db.add_all([self.f1, self.f2, self.ncrp1, self.f3, self.f3_old, self.ncrp2])
        self.db.commit()

        # Add multiple transaction records under NCRP file 2 to verify transactions don't inflate file count
        for i in range(10):
            tx = NcrpTransaction(
                case_id=3,
                ncrp_file_id=2,
                sheet_name=f"Layer {i % 3 + 1}",
                row_number=i + 1,
                transaction_id_utr=f"TXN-{i:04d}",
                transaction_amount=10000 + i * 500,
            )
            self.db.add(tx)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_populate_case_document_counts(self):
        """Test that populate_case_document_counts attaches correct counts to each case."""
        cases = [self.case1, self.case2, self.case3, self.case4]
        populate_case_document_counts(self.db, cases)

        # Case 1: 2 active bank statements + 1 NCRP workbook = 3 total documents
        self.assertEqual(self.case1.bank_statement_count, 2)
        self.assertEqual(self.case1.ncrp_count, 1)
        self.assertEqual(self.case1.total_document_count, 3)

        # Case 2: 1 active bank statement (superseded ignored) + 0 NCRP = 1 total document
        self.assertEqual(self.case2.bank_statement_count, 1)
        self.assertEqual(self.case2.ncrp_count, 0)
        self.assertEqual(self.case2.total_document_count, 1)

        # Case 3: 0 bank statements + 1 NCRP workbook (even with 10 transactions) = 1 total document
        self.assertEqual(self.case3.bank_statement_count, 0)
        self.assertEqual(self.case3.ncrp_count, 1)
        self.assertEqual(self.case3.total_document_count, 1)

        # Case 4: 0 documents
        self.assertEqual(self.case4.bank_statement_count, 0)
        self.assertEqual(self.case4.ncrp_count, 0)
        self.assertEqual(self.case4.total_document_count, 0)

    def test_case_kpis_and_document_totals(self):
        """Test get_cases controller response includes accurate KPIs and document counts."""
        res = controller_get_cases(self.db, user_id=1)
        self.assertTrue(res["success"])
        self.assertEqual(res["total"], 4)

        kpis = res["kpis"]
        # Case status counts
        self.assertEqual(kpis["total_cases"], 4)
        self.assertEqual(kpis["draft_cases"], 2)  # Case 1 & Case 4
        self.assertEqual(kpis["in_progress_cases"], 1)  # Case 2
        self.assertEqual(kpis["completed_cases"], 1)  # Case 3

        # Document counts (separated from case KPIs)
        self.assertEqual(kpis["total_bank_statements"], 3)  # 2 in case 1 + 1 in case 2
        self.assertEqual(kpis["total_ncrp_workbooks"], 2)  # 1 in case 1 + 1 in case 3
        self.assertEqual(kpis["total_documents"], 5)  # 3 + 2

    def test_schema_serialization(self):
        """Test that CaseListResponse validates and serializes CaseKPIs and CaseData."""
        res = controller_get_cases(self.db, user_id=1)
        validated = CaseListResponse.model_validate(res)

        self.assertTrue(validated.success)
        self.assertEqual(validated.total, 4)
        self.assertIsNotNone(validated.kpis)
        self.assertEqual(validated.kpis.total_cases, 4)
        self.assertEqual(validated.kpis.total_documents, 5)

        # Check that individual case items carry document counts
        case_map = {c.id: c for c in validated.data}
        self.assertEqual(case_map[1].bank_statement_count, 2)
        self.assertEqual(case_map[1].ncrp_count, 1)
        self.assertEqual(case_map[1].total_document_count, 3)

        self.assertEqual(case_map[3].bank_statement_count, 0)
        self.assertEqual(case_map[3].ncrp_count, 1)
        self.assertEqual(case_map[3].total_document_count, 1)


if __name__ == "__main__":
    unittest.main()
