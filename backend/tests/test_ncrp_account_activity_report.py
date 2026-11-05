"""
Unit tests for NCRP Account Activity & Exit Report (Report 07).
Validates account discovery, direction classification, KPI calculations,
rapid fund movement timing, exit destinations, reconciliation math, and gaps.
"""

from datetime import datetime, timezone, timedelta
from decimal import Decimal
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.main  # Ensure all models are loaded
from app.core.database import Base
from app.ncrp.ncrp_model import NcrpFile, NcrpTransaction
from app.ncrp.ncrp_schema import (
    NcrpWorkbookAccountsResponse,
    NcrpAccountActivityReportResponse,
)
from app.ncrp.ncrp_account_activity_service import (
    get_ncrp_workbook_accounts,
    get_ncrp_account_activity_report_data,
)


class TestNcrpAccountActivityReport(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db = self.SessionLocal()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def _create_file(self, filename="test_workbook.xlsx", case_id=1):
        ncrp_file = NcrpFile(
            case_id=case_id,
            created_by=1,
            original_filename=filename,
            stored_filename=f"stored_{filename}",
            file_path=f"storage/ncrp/{case_id}/{filename}",
            file_size=4096,
            sheet_count=6,
            total_rows=10,
            imported_rows=10,
            failed_rows=0,
            status="COMPLETED",
        )
        self.db.add(ncrp_file)
        self.db.commit()
        self.db.refresh(ncrp_file)
        return ncrp_file

    def test_01_workbook_accounts_discovery(self):
        """Verify accounts are discovered from transfers, ATM withdrawals, and hold records."""
        f = self._create_file("acc_discovery.xlsx")

        # Transfer L1 -> L2
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="ACC_SENDER",
            transaction_id_utr="UTR_001",
            transaction_date=datetime(2024, 5, 1, 10, 0, tzinfo=timezone.utc),
            transaction_amount=Decimal("100000.00"),
            layer="1",
            bank_name="State Bank of India",
            raw_data={
                "Account No": "ACC_TARGET",
                "Action Taken By bank": "State Bank of India",
                "Bank/FIs": "HDFC Bank",
            }
        ))
        # ATM withdrawal for ACC_TARGET
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="ATM", row_number=3,
            account_or_wallet_id="ACC_TARGET",
            transaction_date=datetime(2024, 5, 1, 11, 0, tzinfo=timezone.utc),
            transaction_amount=Decimal("20000.00"),
            bank_name="HDFC Bank",
            raw_data={"ATM ID": "ATM987", "Location": "Mumbai Central"}
        ))
        self.db.commit()

        res = get_ncrp_workbook_accounts(self.db, f.id)
        validated = NcrpWorkbookAccountsResponse.model_validate(res)

        self.assertEqual(validated.total_accounts, 2)
        accounts_dict = {a.account: a for a in validated.accounts}
        self.assertIn("ACC_SENDER", accounts_dict)
        self.assertIn("ACC_TARGET", accounts_dict)
        self.assertTrue(accounts_dict["ACC_SENDER"].is_starting_account)
        self.assertEqual(accounts_dict["ACC_TARGET"].total_transactions, 2)

    def test_02_incoming_outgoing_classification_and_kpis(self):
        """Test classification of incoming credit, transfer outflow, cash withdrawal, and hold."""
        f = self._create_file("classification.xlsx")
        target_account = "ACC_SUSPECT"

        t0 = datetime(2024, 6, 1, 10, 0, tzinfo=timezone.utc)
        # 1. Incoming credit to ACC_SUSPECT (₹1,50,000)
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="ACC_VICTIM",
            transaction_id_utr="UTR_IN_01",
            transaction_date=t0,
            transaction_amount=Decimal("150000.00"),
            layer="1",
            bank_name="ICICI Bank",
            raw_data={
                "Account No": target_account,
                "Action Taken By bank": "ICICI Bank",
                "Bank/FIs": "Axis Bank",
            }
        ))
        # 2. Outgoing transfer from ACC_SUSPECT (₹50,000) 20 mins later
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id=target_account,
            transaction_id_utr="UTR_OUT_01",
            transaction_date=t0 + timedelta(minutes=20),
            transaction_amount=Decimal("50000.00"),
            layer="2",
            bank_name="Axis Bank",
            raw_data={
                "Account No": "ACC_DEST_1",
                "Action Taken By bank": "Axis Bank",
                "Bank/FIs": "Kotak Mahindra Bank",
            }
        ))
        # 3. Cash withdrawal from ACC_SUSPECT (₹30,000) 45 mins later
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="ATM", row_number=4,
            account_or_wallet_id=target_account,
            transaction_date=t0 + timedelta(minutes=45),
            transaction_amount=Decimal("30000.00"),
            bank_name="Axis Bank",
            raw_data={"ATM ID": "ATM1001", "Location": "Connaught Place"}
        ))
        # 4. Verified hold placed on ACC_SUSPECT (₹40,000)
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Put on Hold", row_number=5,
            account_or_wallet_id=target_account,
            transaction_date=t0 + timedelta(hours=2),
            transaction_amount=Decimal("40000.00"),
            bank_name="Axis Bank",
            raw_data={"Put on Hold Amount": "40000.00"}
        ))
        self.db.commit()

        res = get_ncrp_account_activity_report_data(self.db, f.id, account=target_account)
        validated = NcrpAccountActivityReportResponse.model_validate(res)

        kpis = validated.kpi_cards
        self.assertEqual(kpis["total_transactions"], 4)
        self.assertEqual(kpis["total_incoming"], 150000.00)
        self.assertEqual(kpis["transfer_outflow"], 50000.00)
        self.assertEqual(kpis["cash_withdrawal"], 30000.00)
        self.assertEqual(kpis["verified_held_amount"], 40000.00)
        self.assertEqual(kpis["total_outgoing"], 80000.00)

        # Reconciliation: 150000 - 50000 (transfers) - 30000 (ATM) - 40000 (hold) = 30000 unresolved
        self.assertEqual(kpis["estimated_unresolved_amount"], 30000.00)
        recon = validated.amount_reconciliation
        self.assertEqual(recon["estimated_unresolved_amount"], 30000.00)
        self.assertEqual(recon["reconciliation_status"], "UNRESOLVED_FUNDS_REMAIN")

    def test_03_rapid_fund_movement_analysis(self):
        """Test rapid movement timing thresholds and Possible Temporal Association labeling."""
        f = self._create_file("rapid_movement.xlsx")
        acc = "ACC_RAPID"
        t0 = datetime(2024, 7, 10, 14, 0, tzinfo=timezone.utc)

        # Incoming credit: ₹2,00,000 at 14:00
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="VICTIM_ACC",
            transaction_id_utr="UTR_INC_RAPID",
            transaction_date=t0,
            transaction_amount=Decimal("200000.00"),
            raw_data={"Account No": acc, "Action Taken By bank": "SBI", "Bank/FIs": "HDFC"}
        ))
        # Outgoing 1: ₹90,000 at 14:12 (12 mins - within 15 mins)
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id=acc,
            transaction_id_utr="UTR_OUT_RAPID_1",
            transaction_date=t0 + timedelta(minutes=12),
            transaction_amount=Decimal("90000.00"),
            raw_data={"Account No": "BENE_1", "Action Taken By bank": "HDFC", "Bank/FIs": "ICICI"}
        ))
        # Outgoing 2: ₹80,000 at 14:45 (45 mins - within 1 hour)
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=4,
            account_or_wallet_id=acc,
            transaction_id_utr="UTR_OUT_RAPID_2",
            transaction_date=t0 + timedelta(minutes=45),
            transaction_amount=Decimal("80000.00"),
            raw_data={"Account No": "BENE_2", "Action Taken By bank": "HDFC", "Bank/FIs": "Canara Bank"}
        ))
        self.db.commit()

        res = get_ncrp_account_activity_report_data(self.db, f.id, account=acc)
        rapid = res["rapid_fund_movement"]

        self.assertEqual(len(rapid["records"]), 2)
        self.assertEqual(rapid["threshold_counts"]["within_15_mins"], 1)
        self.assertEqual(rapid["threshold_counts"]["within_1_hour"], 1)

        first_rec = rapid["records"][0]
        self.assertEqual(first_rec["time_gap_minutes"], 12.0)
        self.assertEqual(first_rec["threshold_label"], "Within 15 minutes")
        self.assertEqual(first_rec["link_status"], "Possible Temporal Association")

    def test_04_exit_destinations_and_onward_status(self):
        """Test exit destinations and detection of whether destination has onward transfers in workbook."""
        f = self._create_file("exit_destinations.xlsx")
        acc = "ACC_HUB"

        # Transfer ACC_HUB -> DEST_INTERMEDIARY
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id=acc,
            transaction_id_utr="UTR_EXIT_1",
            transaction_date=datetime(2024, 8, 1, 10, 0, tzinfo=timezone.utc),
            transaction_amount=Decimal("50000.00"),
            raw_data={"Account No": "DEST_INTERMEDIARY", "Bank/FIs": "Punjab National Bank"}
        ))
        # Transfer DEST_INTERMEDIARY -> DEST_TERMINAL (making DEST_INTERMEDIARY have onward transfers)
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id="DEST_INTERMEDIARY",
            transaction_id_utr="UTR_EXIT_2",
            transaction_date=datetime(2024, 8, 1, 12, 0, tzinfo=timezone.utc),
            transaction_amount=Decimal("45000.00"),
            raw_data={"Account No": "DEST_TERMINAL", "Bank/FIs": "Bank of Baroda"}
        ))
        self.db.commit()

        res = get_ncrp_account_activity_report_data(self.db, f.id, account=acc)
        exits = res["exit_activity"]["destinations"]

        self.assertEqual(len(exits), 1)
        dest_item = exits[0]
        self.assertEqual(dest_item["beneficiary_account"], "DEST_INTERMEDIARY")
        self.assertTrue(dest_item["has_onward_transfers"])
        self.assertEqual(dest_item["onward_status_label"], "Onward Transfers Logged")

    def test_05_graph_data_nodes_and_edges(self):
        """Test graph_data contains subject node, sources, destinations, and connecting edges."""
        f = self._create_file("graph_test.xlsx")
        acc = "ACC_SUBJECT"

        # Inbound transfer: SOURCE_1 -> ACC_SUBJECT (₹1,00,000)
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="SOURCE_1",
            transaction_id_utr="UTR_IN_10",
            transaction_date=datetime(2024, 9, 1, 10, 0, tzinfo=timezone.utc),
            transaction_amount=Decimal("100000.00"),
            raw_data={"Account No": acc, "Bank/FIs": "HDFC Bank", "Action Taken By bank": "SBI"}
        ))
        # Outbound transfer: ACC_SUBJECT -> DEST_1 (₹60,000)
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id=acc,
            transaction_id_utr="UTR_OUT_10",
            transaction_date=datetime(2024, 9, 1, 11, 0, tzinfo=timezone.utc),
            transaction_amount=Decimal("60000.00"),
            raw_data={"Account No": "DEST_1", "Bank/FIs": "ICICI Bank", "Action Taken By bank": "HDFC Bank"}
        ))
        # Cash withdrawal: ATM (₹20,000)
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="ATM", row_number=4,
            account_or_wallet_id=acc,
            transaction_date=datetime(2024, 9, 1, 11, 30, tzinfo=timezone.utc),
            transaction_amount=Decimal("20000.00"),
            raw_data={"ATM ID": "ATM202", "Location": "Delhi"}
        ))
        self.db.commit()

        res = get_ncrp_account_activity_report_data(self.db, f.id, account=acc)
        graph = res.get("graph_data", {})
        nodes = graph.get("nodes", [])
        edges = graph.get("edges", [])

        self.assertGreaterEqual(len(nodes), 3)  # Subject, Source, Dest, and Cash-out
        self.assertEqual(len(edges), 3)

        node_ids = {n["id"]: n for n in nodes}
        self.assertIn(acc, node_ids)
        self.assertEqual(node_ids[acc]["role"], "Subject Account")
        self.assertEqual(node_ids[acc]["layer"], 2)

        self.assertIn("SOURCE_1", node_ids)
        self.assertEqual(node_ids["SOURCE_1"]["layer"], 1)

        self.assertIn("DEST_1", node_ids)
        self.assertEqual(node_ids["DEST_1"]["layer"], 3)

        self.assertIn("CASH_DISPERSAL_ENDPOINT", node_ids)
        self.assertEqual(node_ids["CASH_DISPERSAL_ENDPOINT"]["layer"], 3)

    def test_06_workbook_accounts_full_account_distinction(self):
        """Verify full unmasked account numbers are provided so investigators can distinguish similar accounts."""
        f = self._create_file("similar_accounts.xlsx")
        acc1 = "23123456789973"
        acc2 = "23123456789974"

        # Transfer involving acc1
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id=acc1,
            transaction_id_utr="UTR_DCB_01",
            transaction_date=datetime(2024, 10, 1, 9, 0, tzinfo=timezone.utc),
            transaction_amount=Decimal("75000.00"),
            layer="5",
            bank_name="DCB Bank",
            raw_data={
                "Account No": "DEST_99",
                "Action Taken By bank": "DCB Bank",
                "Bank/FIs": "HDFC Bank",
            }
        ))
        # Transfer involving similar acc2
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id=acc2,
            transaction_id_utr="UTR_DCB_02",
            transaction_date=datetime(2024, 10, 1, 9, 30, tzinfo=timezone.utc),
            transaction_amount=Decimal("45000.00"),
            layer="5",
            bank_name="DCB Bank",
            raw_data={
                "Account No": "DEST_99",
                "Action Taken By bank": "DCB Bank",
                "Bank/FIs": "HDFC Bank",
            }
        ))
        self.db.commit()

        res = get_ncrp_workbook_accounts(self.db, f.id)
        validated = NcrpWorkbookAccountsResponse.model_validate(res)

        accounts_dict = {a.account: a for a in validated.accounts}
        # Both complete account numbers must be preserved and distinct
        self.assertIn(acc1, accounts_dict)
        self.assertIn(acc2, accounts_dict)
        self.assertEqual(accounts_dict[acc1].account, "23123456789973")
        self.assertEqual(accounts_dict[acc2].account, "23123456789974")
        self.assertEqual(accounts_dict[acc1].bank, "DCB Bank")
        self.assertEqual(accounts_dict[acc2].bank, "DCB Bank")
        self.assertEqual(accounts_dict[acc1].layers, [5])
        self.assertEqual(accounts_dict[acc2].layers, [5])
        # Masked versions must also be present
        self.assertEqual(accounts_dict[acc1].masked_account, "23XXXXXXXX9973")
        self.assertEqual(accounts_dict[acc2].masked_account, "23XXXXXXXX9974")


if __name__ == "__main__":
    unittest.main()
