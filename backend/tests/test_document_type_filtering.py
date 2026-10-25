import unittest
import os
import sys
from datetime import date
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.user.user_model import User
from app.case.case_model import Case
from app.files.file_model import File, MergedFileSource
from app.bank_transactions.bank_transaction_model import BankTransaction
from app.files.file_repository import (
    get_files_by_case,
    resolve_source_file_ids,
)
from app.bank_transactions.bank_transaction_repository import (
    get_transactions_by_case,
    get_transactions_by_case_paginated,
    get_filtered_transactions_by_case,
    get_case_transaction_summary,
    get_mode_wise_by_case,
    get_timeline_by_case,
    get_transaction_relationships,
    get_counterparty_analysis,
)


class TestDocumentTypeAndReportFiltering(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Use an in-memory SQLite database for isolated unit testing
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()
        # Clean tables
        self.db.query(BankTransaction).delete()
        self.db.query(MergedFileSource).delete()
        self.db.query(File).delete()
        self.db.query(Case).delete()
        self.db.query(User).delete()
        self.db.commit()

        # Create dummy user
        self.user = User(
            id=1,
            username="investigator",
            email="inv@example.com",
            password_hash="dummy",
            role="user",
        )
        self.db.add(self.user)

        # Create Case 1 and Case 2
        self.case1 = Case(
            id=1,
            case_number="CASE-001",
            case_name="Case One",
            created_by=1,
        )
        self.case2 = Case(
            id=2,
            case_number="CASE-002",
            case_name="Case Two",
            created_by=1,
        )
        self.db.add_all([self.case1, self.case2])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_document_type_default_and_files_query(self):
        """Verify document_type default is BANK_STATEMENT and get_files_by_case filters correctly."""
        file1 = File(
            id=101,
            case_id=1,
            created_by=1,
            original_filename="statement1.pdf",
            stored_filename="statement1.pdf",
            file_path="/tmp/statement1.pdf",
            file_size=1024,
            document_type="BANK_STATEMENT",
            is_superseded=False,
        )
        file2 = File(
            id=102,
            case_id=1,
            created_by=1,
            original_filename="invoice_or_other.pdf",
            stored_filename="invoice_or_other.pdf",
            file_path="/tmp/invoice_or_other.pdf",
            file_size=2048,
            document_type="UNKNOWN",
            is_superseded=False,
        )
        self.db.add_all([file1, file2])
        self.db.commit()

        # Query only BANK_STATEMENT
        bank_files = get_files_by_case(self.db, case_id=1, document_type="BANK_STATEMENT")
        self.assertEqual(len(bank_files), 1)
        self.assertEqual(bank_files[0].id, 101)
        self.assertEqual(bank_files[0].document_type, "BANK_STATEMENT")

        # Query all files
        all_files = get_files_by_case(self.db, case_id=1)
        self.assertEqual(len(all_files), 2)

    def test_resolve_source_file_ids_with_merged_files(self):
        """Verify merged statements resolve to their underlying bank statement leaf sources."""
        # Statement A & B in Case 1
        f_a = File(id=1, case_id=1, created_by=1, original_filename="A.pdf", stored_filename="A.pdf", file_path="/p/A", file_size=100, document_type="BANK_STATEMENT", is_superseded=True)
        f_b = File(id=2, case_id=1, created_by=1, original_filename="B.pdf", stored_filename="B.pdf", file_path="/p/B", file_size=100, document_type="BANK_STATEMENT", is_superseded=True)
        # Merged AB
        f_ab = File(id=3, case_id=1, created_by=1, original_filename="Merged_AB.pdf", stored_filename="Merged_AB.pdf", file_path="/p/AB", file_size=200, is_merged=True, document_type="BANK_STATEMENT", is_superseded=False)
        # Non-bank statement file
        f_other = File(id=4, case_id=1, created_by=1, original_filename="Other.pdf", stored_filename="Other.pdf", file_path="/p/O", file_size=100, document_type="UNKNOWN", is_superseded=False)

        self.db.add_all([f_a, f_b, f_ab, f_other])
        self.db.commit()

        mfs1 = MergedFileSource(merged_file_id=3, source_file_id=1)
        mfs2 = MergedFileSource(merged_file_id=3, source_file_id=2)
        self.db.add_all([mfs1, mfs2])
        self.db.commit()

        # Resolve all bank statements for Case 1 when file_ids is None
        resolved = resolve_source_file_ids(self.db, case_id=1, file_ids=None, document_type="BANK_STATEMENT")
        # Should resolve to leaf sources of active merged file f_ab (which are 1 and 2), excluding f_other (UNKNOWN)
        self.assertIn(1, resolved)
        self.assertIn(2, resolved)
        self.assertNotIn(4, resolved)

        # Resolving specifically with f_ab ID
        resolved_ab = resolve_source_file_ids(self.db, case_id=1, file_ids=[3], document_type="BANK_STATEMENT")
        self.assertEqual(sorted(resolved_ab), [1, 2])

        # Resolving with f_other (UNKNOWN) when filtering by BANK_STATEMENT excludes it
        resolved_other = resolve_source_file_ids(self.db, case_id=1, file_ids=[4], document_type="BANK_STATEMENT")
        self.assertEqual(resolved_other, [])

    def test_transaction_queries_isolate_by_case_and_bank_statement(self):
        """Verify transactions from UNKNOWN files or other cases are never included in reports."""
        # Case 1 Bank Statement
        f1 = File(id=10, case_id=1, created_by=1, original_filename="bs1.pdf", stored_filename="bs1.pdf", file_path="/p/1", file_size=100, document_type="BANK_STATEMENT", is_superseded=False)
        # Case 1 UNKNOWN file
        f2 = File(id=11, case_id=1, created_by=1, original_filename="unk.pdf", stored_filename="unk.pdf", file_path="/p/2", file_size=100, document_type="UNKNOWN", is_superseded=False)
        # Case 2 Bank Statement
        f3 = File(id=20, case_id=2, created_by=1, original_filename="bs2.pdf", stored_filename="bs2.pdf", file_path="/p/3", file_size=100, document_type="BANK_STATEMENT", is_superseded=False)

        self.db.add_all([f1, f2, f3])
        self.db.commit()

        # Transactions
        # Valid Case 1 Bank Statement transaction
        tx1 = BankTransaction(
            id=1,
            case_id=1,
            file_id=10,
            transaction_date=date(2025, 1, 15),
            description="Salary Credit",
            credit=Decimal("50000.00"),
            debit=Decimal("0.00"),
            mode="NEFT",
            counterparty_name="Employer Corp",
            counterparty_status="EXTRACTED",
        )
        # Transaction on UNKNOWN file in Case 1
        tx2 = BankTransaction(
            id=2,
            case_id=1,
            file_id=11,
            transaction_date=date(2025, 1, 16),
            description="Unknown Document Tx",
            credit=Decimal("10000.00"),
            debit=Decimal("0.00"),
            mode="OTHER",
            counterparty_name="Mystery Party",
        )
        # Transaction in Case 2
        tx3 = BankTransaction(
            id=3,
            case_id=2,
            file_id=20,
            transaction_date=date(2025, 1, 17),
            description="Case 2 Transaction",
            credit=Decimal("99999.00"),
            debit=Decimal("0.00"),
            mode="RTGS",
            counterparty_name="Case2 Party",
        )
        self.db.add_all([tx1, tx2, tx3])
        self.db.commit()

        # 1. get_transactions_by_case with file_ids=None (should only include BANK_STATEMENT files of Case 1)
        txs = get_transactions_by_case(self.db, case_id=1)
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0].id, 1)

        # 2. get_transactions_by_case_paginated
        paginated_txs, total = get_transactions_by_case_paginated(self.db, case_id=1, page=1, page_size=10)
        self.assertEqual(total, 1)
        self.assertEqual(paginated_txs[0].id, 1)

        # 3. get_filtered_transactions_by_case
        filtered_txs, f_total, _ = get_filtered_transactions_by_case(self.db, case_id=1, page=1, page_size=10)
        self.assertEqual(f_total, 1)
        self.assertEqual(filtered_txs[0].id, 1)

        # 4. Summary calculation
        summary = get_case_transaction_summary(self.db, case_id=1)
        self.assertEqual(summary["total_transactions"], 1)
        self.assertEqual(summary["total_credits"], Decimal("50000.00"))

        # 5. Mode wise
        mode_data = get_mode_wise_by_case(self.db, case_id=1)
        self.assertEqual(mode_data["total_transactions"], 1)
        self.assertEqual(mode_data["modes"][0]["mode"], "NEFT")

        # 6. If explicit empty file_ids passed (e.g. invalid selection), returns 0 / empty
        empty_txs = get_transactions_by_case(self.db, case_id=1, file_ids=[])
        self.assertEqual(empty_txs, [])
        empty_summary = get_case_transaction_summary(self.db, case_id=1, file_ids=[])
        self.assertEqual(empty_summary["total_transactions"], 0)

        # 7. Counterparty analysis
        cp_data = get_counterparty_analysis(self.db, case_id=1, file_ids=[10])
        self.assertNotIn("error", cp_data)
        self.assertEqual(len(cp_data["counterparties"]), 1)
        self.assertEqual(cp_data["counterparties"][0]["counterparty_name"], "Employer Corp")

        # 8. Relationships query with UNKNOWN file returns empty
        rel_data = get_transaction_relationships(self.db, case_id=1, file_ids=[11])
        self.assertEqual(len(rel_data["nodes"]), 0)

        # 9. Cross-case file resolution prevention
        # File 20 belongs to Case 2. If queried in context of Case 1, it must be excluded!
        cross_case_resolved = resolve_source_file_ids(self.db, case_id=1, file_ids=[20], document_type="BANK_STATEMENT")
        self.assertEqual(cross_case_resolved, [])

    def test_file_creation_default_document_type(self):
        """Verify new File instances default to BANK_STATEMENT document_type."""
        f = File(
            case_id=1,
            created_by=1,
            original_filename="new_statement.pdf",
            stored_filename="new_statement.pdf",
            file_path="/p/new",
            file_size=500,
        )
        self.db.add(f)
        self.db.commit()
        self.db.refresh(f)
        self.assertEqual(f.document_type, "BANK_STATEMENT")

    def test_parse_and_validate_file_ids(self):
        """Test parse_and_validate_file_ids helper handles None, empty string, valid IDs, and cross-case/unknown files."""
        from app.bank_transactions.bank_transaction_routes import parse_and_validate_file_ids
        from fastapi import HTTPException

        f1 = File(id=301, case_id=1, created_by=1, original_filename="bs_301.pdf", stored_filename="bs_301.pdf", file_path="/p/301", file_size=100, document_type="BANK_STATEMENT", is_superseded=False)
        f_unk = File(id=302, case_id=1, created_by=1, original_filename="unk_302.pdf", stored_filename="unk_302.pdf", file_path="/p/302", file_size=100, document_type="UNKNOWN", is_superseded=False)
        f_case2 = File(id=303, case_id=2, created_by=1, original_filename="bs_303.pdf", stored_filename="bs_303.pdf", file_path="/p/303", file_size=100, document_type="BANK_STATEMENT", is_superseded=False)
        self.db.add_all([f1, f_unk, f_case2])
        self.db.commit()

        # None returns None (means no file filter requested, use all case bank statements)
        self.assertIsNone(parse_and_validate_file_ids(None, case_id=1, db=self.db, user=self.user))

        # Empty string or 'none' returns [] (means user deselected all files)
        self.assertEqual(parse_and_validate_file_ids("", case_id=1, db=self.db, user=self.user), [])
        self.assertEqual(parse_and_validate_file_ids("   ", case_id=1, db=self.db, user=self.user), [])
        self.assertEqual(parse_and_validate_file_ids("none", case_id=1, db=self.db, user=self.user), [])
        self.assertEqual(parse_and_validate_file_ids("empty", case_id=1, db=self.db, user=self.user), [])

        # Valid bank statement file ID
        self.assertEqual(parse_and_validate_file_ids("301", case_id=1, db=self.db, user=self.user), [301])

        # UNKNOWN document type file ID raises HTTPException (400)
        with self.assertRaises(HTTPException) as ctx:
            parse_and_validate_file_ids("302", case_id=1, db=self.db, user=self.user)
        self.assertEqual(ctx.exception.status_code, 400)

        # Cross-case file ID raises HTTPException (400)
        with self.assertRaises(HTTPException) as ctx:
            parse_and_validate_file_ids("303", case_id=1, db=self.db, user=self.user)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_financial_analysis_filtering_by_bank_statement(self):
        """Verify Report 5 (get_financial_analysis) only includes BANK_STATEMENT files."""
        from app.bank_transactions.financial_analysis_service import get_financial_analysis

        f_bs = File(id=401, case_id=1, created_by=1, original_filename="bs_401.pdf", stored_filename="bs_401.pdf", file_path="/p/401", file_size=100, document_type="BANK_STATEMENT", is_superseded=False)
        f_unk = File(id=402, case_id=1, created_by=1, original_filename="unk_402.pdf", stored_filename="unk_402.pdf", file_path="/p/402", file_size=100, document_type="UNKNOWN", is_superseded=False)
        self.db.add_all([f_bs, f_unk])
        self.db.commit()

        tx_bs = BankTransaction(id=4001, case_id=1, file_id=401, transaction_date=date(2025, 2, 1), debit=Decimal("2500.00"), credit=Decimal("0.00"), description="Valid BS Tx")
        tx_unk = BankTransaction(id=4002, case_id=1, file_id=402, transaction_date=date(2025, 2, 2), debit=Decimal("7500.00"), credit=Decimal("0.00"), description="Ignored UNK Tx")
        self.db.add_all([tx_bs, tx_unk])
        self.db.commit()

        # Without file_ids, defaults to all BANK_STATEMENT files in case
        res = get_financial_analysis(db=self.db, case_id=1)
        self.assertNotIn("error", res)
        # Total debit should only be 2500.00 (from 401), not 10000.00
        self.assertEqual(res["stats"]["total_debit"], 2500.0)
        self.assertEqual(res["kpis"]["total_value"], 2500.0)

        # With empty file_ids list [], returns error / no transactions
        res_empty = get_financial_analysis(db=self.db, case_id=1, file_ids=[])
        self.assertIn("error", res_empty)

        # Explicitly passing UNKNOWN file_id returns no transactions
        res_unk = get_financial_analysis(db=self.db, case_id=1, file_ids=[402])
        self.assertIn("error", res_unk)


if __name__ == "__main__":
    unittest.main()
