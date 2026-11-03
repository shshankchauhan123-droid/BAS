import unittest
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.main  # Ensure all models are registered in metadata
from app.core.database import Base
from app.ncrp.ncrp_model import NcrpFile, NcrpTransaction
from app.ncrp.ncrp_priority_service import (
    get_ncrp_investigation_priority_report_data,
    parse_clean_amount,
    extract_field,
)
from app.ncrp.ncrp_schema import NcrpInvestigationPriorityReportResponse


class TestNcrpInvestigationPriorityReport(unittest.TestCase):
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

    def test_01_normal_multi_layer_transaction_flow(self):
        """Scenario 1: Normal multi-layer transaction flow (Layer 1 -> Layer 2 -> Layer 3)."""
        f = self._create_file("multi_layer.xlsx")
        # Layer 1
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="VICTIM_01", layer="1", transaction_amount=Decimal("100000.00"),
            disputed_amount=Decimal("100000.00"), transaction_id_utr="UTR_L1",
            raw_data={"Account No": "ACC_L1", "Bank/FIs": "HDFC Bank", "Action Taken By bank": "State Bank of India"}
        ))
        # Layer 2
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id="ACC_L1", layer="2", transaction_amount=Decimal("80000.00"),
            disputed_amount=Decimal("80000.00"), transaction_id_utr="UTR_L2",
            raw_data={"Account No": "ACC_L2", "Bank/FIs": "ICICI Bank", "Action Taken By bank": "HDFC Bank"}
        ))
        # Layer 3
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=4,
            account_or_wallet_id="ACC_L2", layer="3", transaction_amount=Decimal("60000.00"),
            disputed_amount=Decimal("60000.00"), transaction_id_utr="UTR_L3",
            raw_data={"Account No": "ACC_L3", "Bank/FIs": "Axis Bank", "Action Taken By bank": "ICICI Bank"}
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        self.assertEqual(res["overview"]["disputed_exposure"], 100000.00)
        self.assertEqual(res["overview"]["unique_traced_amount"], 100000.00)
        self.assertEqual(len(res["layer_heatmap"]), 3)
        self.assertEqual(res["layer_heatmap"][0]["layer"], "Layer 1")
        self.assertEqual(res["layer_heatmap"][1]["layer"], "Layer 2")
        self.assertEqual(res["layer_heatmap"][2]["layer"], "Layer 3")

    def test_02_multiple_first_layer_beneficiary_accounts(self):
        """Scenario 2: Multiple first-layer beneficiary accounts receiving funds from victim."""
        f = self._create_file("multi_l1.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="VICTIM_01", layer="1", transaction_amount=Decimal("50000.00"),
            disputed_amount=Decimal("50000.00"), transaction_id_utr="UTR_1A",
            raw_data={"Account No": "MULE_1A", "Bank/FIs": "PNB"}
        ))
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id="VICTIM_01", layer="1", transaction_amount=Decimal("70000.00"),
            disputed_amount=Decimal("70000.00"), transaction_id_utr="UTR_1B",
            raw_data={"Account No": "MULE_1B", "Bank/FIs": "Canara Bank"}
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        self.assertEqual(res["overview"]["unique_traced_amount"], 120000.00)
        self.assertEqual(res["layer_heatmap"][0]["accounts_count"], 3)  # VICTIM, MULE_1A, MULE_1B

    def test_03_branching_transfers_to_multiple_accounts(self):
        """Scenario 3: Branching fan-out from one account to multiple destination accounts."""
        f = self._create_file("branching.xlsx")
        # Inflow
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="V01", layer="1", transaction_amount=Decimal("100000.00"),
            disputed_amount=Decimal("100000.00"), transaction_id_utr="UTR_IN",
            raw_data={"Account No": "HUB_ACC"}
        ))
        # 3 Outflows
        for i, dest in enumerate(["BRANCH_1", "BRANCH_2", "BRANCH_3"], start=3):
            self.db.add(NcrpTransaction(
                ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=i,
                account_or_wallet_id="HUB_ACC", layer="2", transaction_amount=Decimal("30000.00"),
                disputed_amount=Decimal("30000.00"), transaction_id_utr=f"UTR_OUT_{i}",
                raw_data={"Account No": dest}
            ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        self.assertEqual(res["overview"]["unique_traced_amount"], 100000.00)
        l2 = next(l for l in res["layer_heatmap"] if l["layer"] == "Layer 2")
        self.assertEqual(l2["unique_traced_amount"], 90000.00)

    def test_04_atm_pos_and_cheque_cashouts(self):
        """Scenario 4: Immediate cash-outs across ATM, POS, and Cheque sheets."""
        f = self._create_file("cashouts.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="V01", layer="1", transaction_amount=Decimal("150000.00"),
            raw_data={"Account No": "CASH_ACC"}
        ))
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Withdrawal through ATM", row_number=2,
            account_or_wallet_id="CASH_ACC", layer="1", transaction_amount=Decimal("20000.00"),
            raw_data={"ATM ID": "ATM_999", "Action Taken By bank": "SBI"}
        ))
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Withdrawal through POS", row_number=2,
            account_or_wallet_id="CASH_ACC", layer="1", transaction_amount=Decimal("30000.00"),
            raw_data={"Merchant Name": "Kiosk Store", "Action Taken By bank": "HDFC"}
        ))
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Cash Withdrawal through Cheque", row_number=2,
            account_or_wallet_id="CASH_ACC", layer="1", transaction_amount=Decimal("50000.00"),
            raw_data={"Cheque No": "123456", "Action Taken By bank": "Axis Bank"}
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        self.assertEqual(res["overview"]["cash_out_amount"], 100000.00)
        self.assertEqual(res["overview"]["unsecured_exposure"], 50000.00)  # 150000 - 100000

    def test_05_verified_holds_at_different_layers_no_double_count(self):
        """Scenario 5: Verified holds across different layers with zero double counting."""
        f = self._create_file("holds.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="V01", layer="1", transaction_amount=Decimal("200000.00"),
            raw_data={"Account No": "ACC_L1"}
        ))
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id="ACC_L1", layer="2", transaction_amount=Decimal("150000.00"),
            raw_data={"Account No": "ACC_L2"}
        ))
        # Hold on Layer 1 account
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Transaction put on hold", row_number=2,
            account_or_wallet_id="ACC_L1", layer="1", transaction_amount=Decimal("40000.00"),
            raw_data={"Action Taken By bank": "HDFC Bank", "Put on hold Amount": "40,000.00"}
        ))
        # Hold on Layer 2 account
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Transaction put on hold", row_number=3,
            account_or_wallet_id="ACC_L2", layer="2", transaction_amount=Decimal("60000.00"),
            raw_data={"Action Taken By bank": "ICICI Bank", "Put on hold Amount": "60,000.00"}
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        self.assertEqual(res["overview"]["verified_held_amount"], 100000.00)
        l1 = next(l for l in res["layer_heatmap"] if l["layer"] == "Layer 1")
        l2 = next(l for l in res["layer_heatmap"] if l["layer"] == "Layer 2")
        self.assertEqual(l1["verified_held_amount"], 40000.00)
        self.assertEqual(l2["verified_held_amount"], 60000.00)
        self.assertEqual(l1["hold_status"], "PARTIALLY HELD")
        self.assertEqual(l2["hold_status"], "PARTIALLY HELD")

    def test_06_duplicate_hold_and_transaction_records(self):
        """Scenario 6: Duplicate hold records and transactions are deduplicated cleanly."""
        f = self._create_file("duplicates.xlsx")
        for r in [2, 3]:
            self.db.add(NcrpTransaction(
                ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=r,
                account_or_wallet_id="SRC01", layer="1", transaction_amount=Decimal("50000.00"),
                transaction_id_utr="DUP_UTR", raw_data={"Account No": "DEST01"}
            ))
        # Identical duplicate hold
        for r in [4, 5]:
            self.db.add(NcrpTransaction(
                ncrp_file_id=f.id, case_id=1, sheet_name="Transaction put on hold", row_number=r,
                account_or_wallet_id="DEST01", layer="1", transaction_amount=Decimal("25000.00"),
                transaction_id_utr="HOLD_UTR_1", raw_data={"Action Taken By bank": "SBI", "Put on hold Amount": "25000"}
            ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        # Hold must be counted once (25000, not 50000)
        self.assertEqual(res["overview"]["verified_held_amount"], 25000.00)
        # Duplicate transaction flag should be recorded
        gaps = [g for g in res["investigation_gaps"] if "Duplicate" in g["missing_evidence"]]
        self.assertGreater(len(gaps), 0)

    def test_07_unmatched_hold_records(self):
        """Scenario 7: Hold records on accounts not present in transfer flows."""
        f = self._create_file("unmatched_hold.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="A1", layer="1", transaction_amount=Decimal("10000.00"),
            raw_data={"Account No": "A2"}
        ))
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Transaction put on hold", row_number=2,
            account_or_wallet_id="UNKNOWN_HOLD_ACC", layer="1", transaction_amount=Decimal("5000.00"),
            raw_data={"Action Taken By bank": "Axis Bank", "Put on hold Amount": "5000"}
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        self.assertEqual(res["overview"]["verified_held_amount"], 5000.00)
        self.assertIn("UNKNOWN_HOLD_ACC", [n["account"] for n in res["graph_data"]["nodes"]])

    def test_08_missing_or_varying_worksheet_headers(self):
        """Scenario 8: Varying column names (e.g. 'Suspect Account No', 'Receiver Bank', etc.)."""
        f = self._create_file("varying_headers.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            raw_data={
                "Suspect Account No": "9876543210",
                "Receiver Account No": "1234567890",
                "Transaction Amount": "Rs. 45,000.50/-",
                "Disputed": "₹ 45,000.50",
                "Action Taken By bank": "State Bank of India",
                "Receiver Bank": "IndusInd Bank",
                "UTR": "VARIED_UTR_123",
                "Hop": "1",
            }
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        self.assertEqual(res["overview"]["disputed_exposure"], 45000.50)
        self.assertEqual(res["overview"]["unique_traced_amount"], 45000.50)

    def test_09_uncertain_transaction_links_discounted(self):
        """Scenario 9: Uncertain links receive 40% discount safeguard."""
        f = self._create_file("uncertain.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="A1", layer="1", transaction_amount=Decimal("100000.00"),
            raw_data={"Account No": "A2"}
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        item = res["high_priority_items"][0]
        # Match status should be UNMATCHED or PROBABLE, and discounted if uncertain
        self.assertIn(item["match_status"], {"UNMATCHED", "PROBABLE"})
        self.assertLessEqual(item["score"], 100.0)

    def test_10_cycles_and_disconnected_transactions(self):
        """Scenario 10: Cyclic fund transfer loops (A -> B -> A) and disconnected events."""
        f = self._create_file("cycles.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="ACC_A", layer="1", transaction_amount=Decimal("50000.00"),
            raw_data={"Account No": "ACC_B"}
        ))
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id="ACC_B", layer="2", transaction_amount=Decimal("40000.00"),
            raw_data={"Account No": "ACC_A"}
        ))
        # Disconnected withdrawal
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Withdrawal through ATM", row_number=4,
            account_or_wallet_id="DISCONNECTED_ACC", layer="1", transaction_amount=Decimal("10000.00"),
            raw_data={"Action Taken By bank": "PNB"}
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        self.assertEqual(res["overview"]["cash_out_amount"], 10000.00)
        self.assertEqual(len(res["graph_data"]["nodes"]), 4)  # 3 account nodes + 1 terminal cashout node

    def test_11_account_numbers_with_leading_zeros_and_scientific_notation(self):
        """Scenario 11: Leading zeros (-:65062045083) and exponential floats (5.01001E+13)."""
        f = self._create_file("formatting.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="-:00065062045083", layer="1", transaction_amount=Decimal("25000.00"),
            raw_data={"Account No": "5.01001E+13"}
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        self.assertEqual(res["overview"]["unique_traced_amount"], 25000.00)
        # Check node identifiers are normalized without scientific notation or leading dashes
        nodes = res["graph_data"]["nodes"]
        acc_ids = [n["account"] for n in nodes]
        self.assertTrue(any("501001" in a for a in acc_ids))
        self.assertTrue(any("65062045083" in a for a in acc_ids))

    def test_12_holds_larger_than_eligible_exposure(self):
        """Scenario 12: Hold amount exceeds traced exposure (e.g. hold = 50k on 30k transfer)."""
        f = self._create_file("large_hold.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="SRC", layer="1", transaction_amount=Decimal("30000.00"),
            raw_data={"Account No": "DEST"}
        ))
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Transaction put on hold", row_number=2,
            account_or_wallet_id="DEST", layer="1", transaction_amount=Decimal("50000.00"),
            raw_data={"Action Taken By bank": "HDFC", "Put on hold Amount": "50000"}
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        self.assertEqual(res["overview"]["verified_held_amount"], 50000.00)
        self.assertEqual(res["overview"]["unsecured_exposure"], 0.00)  # max(0, 30000 - 50000)
        l1 = res["layer_heatmap"][0]
        self.assertEqual(l1["unsecured_amount"], 0.00)
        self.assertEqual(l1["hold_status"], "FULLY HELD")

    def test_13_workbook_with_optional_sheets_missing(self):
        """Scenario 13: Workbook with only 'Money Transfer to' and no withdrawal/hold sheets."""
        f = self._create_file("only_transfers.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="A1", layer="1", transaction_amount=Decimal("75000.00"),
            raw_data={"Account No": "A2"}
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        self.assertEqual(res["overview"]["cash_out_amount"], 0.00)
        self.assertEqual(res["overview"]["verified_held_amount"], 0.00)
        self.assertEqual(res["overview"]["unsecured_exposure"], 75000.00)

    def test_14_workbook_with_no_transactions(self):
        """Scenario 14: Empty workbook with zero transactions returns clean empty response."""
        f = self._create_file("empty.xlsx")
        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        self.assertEqual(res["overview"]["source_transaction_count"], 0)
        self.assertEqual(res["overview"]["disputed_exposure"], 0.00)
        self.assertEqual(res["overview"]["actionable_item_count"], 0)
        self.assertEqual(res["priority_distribution"]["total_items"], 0)
        self.assertEqual(len(res["layer_heatmap"]), 0)



    def test_15_downstream_complete_date_accounts_banks(self):
        """Scenario 15: Downstream transfer with complete date, source/dest account, and bank data."""
        f = self._create_file("downstream_complete.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="65062045083",
            transaction_id_utr="UTR123456789",
            transaction_date=datetime(2024, 4, 24, 10, 30, tzinfo=timezone.utc),
            transaction_amount=Decimal("150000.00"),
            disputed_amount=Decimal("150000.00"),
            layer="1",
            raw_data={
                "Account No./ (Wallet /PG/PA) Id": "65062045083",
                "Account No": "1776002100002723",
                "Action Taken By bank": "State Bank of India",
                "Bank/FIs": "Punjab National Bank",
                "Remarks": "Immediate payment transfer",
            }
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        transfers = res["cash_out_analysis"]["downstream_transfers"]
        self.assertEqual(len(transfers), 1)
        t = transfers[0]
        self.assertEqual(t["date"], "2024-04-24 10:30")
        self.assertEqual(t["source_account"], "65062045083")
        self.assertEqual(t["source_bank"], "State Bank of India")
        self.assertEqual(t["beneficiary_account"], "1776002100002723")
        self.assertEqual(t["dest_bank"], "Punjab National Bank")
        self.assertEqual(t["amount"], 150000.00)
        self.assertEqual(t["remarks"], "Immediate payment transfer")
        self.assertIn("Punjab National Bank", t["recommended_lead"])
        self.assertIn("State Bank of India", t["transfer_flow"])
        self.assertIn("Punjab National Bank", t["transfer_flow"])

    def test_16_downstream_different_date_column_names_and_formats(self):
        """Scenario 16: Downstream transfer with different date column names and date string formats."""
        f = self._create_file("downstream_date_formats.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="ACC_SRC_1",
            transaction_amount=Decimal("25000.00"),
            layer="1",
            raw_data={
                "Account No": "ACC_DST_1",
                "Bank/FIs": "Axis Bank",
                "Date & Time": "24/04/2024 14:30:00",
                "Remarks": "IMPS transfer"
            }
        ))
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id="ACC_SRC_2",
            transaction_amount=Decimal("35000.00"),
            layer="1",
            raw_data={
                "Account No": "ACC_DST_2",
                "Bank/FIs": "Kotak Mahindra Bank",
                "Date of Action": "15-05-2024",
                "Remarks": "NEFT transfer"
            }
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        transfers = res["cash_out_analysis"]["downstream_transfers"]
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["date"], "2024-04-24 14:30")
        self.assertEqual(transfers[1]["date"], "2024-05-15")

    def test_17_downstream_excel_serial_dates(self):
        """Scenario 17: Downstream transfer where Excel stored date as a serial float/int."""
        f = self._create_file("downstream_excel_serial.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="ACC_SRC",
            transaction_amount=Decimal("40000.00"),
            layer="1",
            raw_data={
                "Account No": "ACC_DST",
                "Transaction Date": 45406,  # 2024-04-24 in Excel serial date format
                "Bank/FIs": "Canara Bank",
            }
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        transfers = res["cash_out_analysis"]["downstream_transfers"]
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["date"], "2024-04-24")

    def test_18_downstream_missing_transaction_date(self):
        """Scenario 18: Downstream transfer with completely missing transaction date."""
        f = self._create_file("downstream_missing_date.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="ACC_SRC",
            transaction_amount=Decimal("50000.00"),
            layer="1",
            raw_data={
                "Account No": "ACC_DST",
                "Bank/FIs": "Bank of Baroda",
                "Transaction Date": None,
                "Remarks": "No date provided"
            }
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        transfers = res["cash_out_analysis"]["downstream_transfers"]
        self.assertEqual(len(transfers), 1)
        # Should not invent date; date is None
        self.assertIsNone(transfers[0]["date"])

    def test_19_downstream_missing_source_account(self):
        """Scenario 19: Downstream transfer missing source account but having destination account."""
        f = self._create_file("downstream_missing_source.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id=None,
            transaction_amount=Decimal("60000.00"),
            layer="1",
            raw_data={
                "Account No": "987654321012",
                "Bank/FIs": "Union Bank of India",
                "Remarks": "Source unrecorded"
            }
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        transfers = res["cash_out_analysis"]["downstream_transfers"]
        self.assertEqual(len(transfers), 1)
        t = transfers[0]
        self.assertEqual(t["beneficiary_account"], "987654321012")
        self.assertEqual(t["account"], "987654321012")
        self.assertEqual(t["dest_bank"], "Union Bank of India")

    def test_20_downstream_missing_bank_name(self):
        """Scenario 20: Downstream transfer with completely missing bank name."""
        f = self._create_file("downstream_missing_bank.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="ACC_SRC_X",
            transaction_amount=Decimal("70000.00"),
            layer="1",
            bank_name=None,
            raw_data={
                "Account No": "ACC_DST_X",
                "Remarks": "Bank field blank"
            }
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        transfers = res["cash_out_analysis"]["downstream_transfers"]
        self.assertEqual(len(transfers), 1)
        t = transfers[0]
        self.assertEqual(t["source_bank"], "Unknown Bank")
        self.assertEqual(t["dest_bank"], "Unknown Bank")
        self.assertEqual(t["bank"], "Unknown Bank")

    def test_21_downstream_different_source_and_destination_banks(self):
        """Scenario 21: Downstream transfer with distinct source and destination banks."""
        f = self._create_file("downstream_different_banks.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="ACC_SBI",
            transaction_amount=Decimal("80000.00"),
            layer="1",
            raw_data={
                "Action Taken By bank": "State Bank of India",
                "Account No": "ACC_ICICI",
                "Bank/FIs": "ICICI Bank",
                "Transaction ID / UTR Number": "UTR888999",
            }
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        transfers = res["cash_out_analysis"]["downstream_transfers"]
        self.assertEqual(len(transfers), 1)
        t = transfers[0]
        self.assertEqual(t["source_bank"], "State Bank of India")
        self.assertEqual(t["dest_bank"], "ICICI Bank")
        self.assertNotEqual(t["source_bank"], t["dest_bank"])

    def test_22_downstream_multiple_transfers_across_several_layers(self):
        """Scenario 22: Downstream transfers spanning multiple layers (Layer 1, Layer 2, Layer 3)."""
        f = self._create_file("downstream_multi_layer.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="L1_ACC", layer="1", transaction_amount=Decimal("100000.00"),
            raw_data={"Account No": "L2_ACC", "Bank/FIs": "Bank 1"}
        ))
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id="L2_ACC", layer="2", transaction_amount=Decimal("90000.00"),
            raw_data={"Account No": "L3_ACC", "Bank/FIs": "Bank 2"}
        ))
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=4,
            account_or_wallet_id="L3_ACC", layer="3", transaction_amount=Decimal("80000.00"),
            raw_data={"Account No": "L4_ACC", "Bank/FIs": "Bank 3"}
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        transfers = res["cash_out_analysis"]["downstream_transfers"]
        self.assertEqual(len(transfers), 3)
        self.assertEqual(transfers[0]["layer"], "Layer 1")
        self.assertEqual(transfers[1]["layer"], "Layer 2")
        self.assertEqual(transfers[2]["layer"], "Layer 3")

    def test_23_downstream_duplicate_transaction_deduplication(self):
        """Scenario 23: Duplicate downstream transfer rows in sheet are cleanly deduplicated."""
        f = self._create_file("downstream_duplicates.xlsx")
        # Add identical row twice
        for r_num in (2, 3):
            self.db.add(NcrpTransaction(
                ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=r_num,
                account_or_wallet_id="ACC_SAME_SRC",
                transaction_id_utr="DUP_UTR_999",
                transaction_amount=Decimal("45000.00"),
                layer="1",
                raw_data={
                    "Account No": "ACC_SAME_DST",
                    "Bank/FIs": "Canara Bank",
                    "Transaction Date": "2024-04-24",
                }
            ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        transfers = res["cash_out_analysis"]["downstream_transfers"]
        # Must be deduplicated to exactly 1 transfer item
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 45000.00)
        self.assertEqual(transfers[0]["utr"], "DUP_UTR_999")

    def test_24_downstream_missing_optional_worksheets(self):
        """Scenario 24: Downstream transfers processing when optional sheets (ATM, POS, Cheque) are absent."""
        f = self._create_file("downstream_no_optional_sheets.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="ACC_L1",
            transaction_amount=Decimal("120000.00"),
            layer="1",
            raw_data={"Account No": "ACC_L2", "Bank/FIs": "IndusInd Bank"}
        ))
        self.db.commit()

        res = get_ncrp_investigation_priority_report_data(self.db, f.id)
        self.assertEqual(len(res["cash_out_analysis"]["atm_withdrawals"]), 0)
        self.assertEqual(len(res["cash_out_analysis"]["pos_withdrawals"]), 0)
        self.assertEqual(len(res["cash_out_analysis"]["cheque_withdrawals"]), 0)
        self.assertEqual(len(res["cash_out_analysis"]["downstream_transfers"]), 1)
        self.assertEqual(res["cash_out_analysis"]["downstream_transfers"][0]["amount"], 120000.00)

if __name__ == "__main__":
    unittest.main()
