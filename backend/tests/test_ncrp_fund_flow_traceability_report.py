"""
Automated unit tests for NCRP Fund Flow Traceability Report (Report 06).
Validates multi-layer fund flow tracking, starting account filtering,
link confidence classification, cycle handling, terminal accounts,
financial summaries, investigation gaps, and statutory action suggestions.
"""

from datetime import datetime, timezone
from decimal import Decimal
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.main  # Ensure all models are registered in metadata
from app.core.database import Base
from app.ncrp.ncrp_model import NcrpFile, NcrpTransaction
from app.ncrp.ncrp_schema import NcrpFundFlowTraceabilityReportResponse
from app.ncrp.ncrp_traceability_service import get_ncrp_fund_flow_traceability_report_data


class TestNcrpFundFlowTraceabilityReport(unittest.TestCase):
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

    def test_01_normal_multi_layer_traceability_flow(self):
        """Scenario 1: Normal 3-layer fund flow (L1 -> L2 -> L3) with proper layer assignment."""
        f = self._create_file("multi_layer.xlsx")
        # L1 -> L2
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="ACC_L1",
            transaction_id_utr="UTR_L1_L2",
            transaction_date=datetime(2024, 4, 1, 10, 0, tzinfo=timezone.utc),
            transaction_amount=Decimal("100000.00"),
            layer="1",
            raw_data={
                "Account No": "ACC_L2",
                "Action Taken By bank": "State Bank of India",
                "Bank/FIs": "HDFC Bank",
            }
        ))
        # L2 -> L3
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id="ACC_L2",
            transaction_id_utr="UTR_L2_L3",
            transaction_date=datetime(2024, 4, 2, 11, 0, tzinfo=timezone.utc),
            transaction_amount=Decimal("90000.00"),
            layer="2",
            raw_data={
                "Account No": "ACC_L3",
                "Action Taken By bank": "HDFC Bank",
                "Bank/FIs": "ICICI Bank",
            }
        ))
        self.db.commit()

        res = get_ncrp_fund_flow_traceability_report_data(self.db, f.id)
        validated = NcrpFundFlowTraceabilityReportResponse.model_validate(res)

        self.assertEqual(validated.summary_kpis["total_ncrp_transactions"], 2)
        self.assertEqual(validated.summary_kpis["total_recorded_inflow"], 100000.00)
        self.assertEqual(validated.summary_kpis["total_recorded_outflow"], 190000.00)
        self.assertEqual(validated.summary_kpis["distinct_accounts_count"], 3)

        # Check nodes & layers
        nodes_by_id = {n["id"]: n for n in validated.graph["nodes"]}
        self.assertEqual(nodes_by_id["ACC_L1"]["layer"], 1)
        self.assertEqual(nodes_by_id["ACC_L1"]["role"], "Starting Account")
        self.assertEqual(nodes_by_id["ACC_L2"]["layer"], 2)
        self.assertEqual(nodes_by_id["ACC_L2"]["role"], "Intermediary Account")
        self.assertEqual(nodes_by_id["ACC_L3"]["layer"], 3)
        self.assertEqual(nodes_by_id["ACC_L3"]["role"], "Terminal Account")

    def test_02_starting_account_filtering(self):
        """Scenario 2: Selecting a specific Layer 1 starting account isolates that fund trail."""
        f = self._create_file("two_roots.xlsx")
        # Trail A: ROOT_A -> BENE_A
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="ROOT_A", transaction_amount=Decimal("50000.00"), layer="1",
            raw_data={"Account No": "BENE_A", "Action Taken By bank": "Bank A", "Bank/FIs": "Bank X"}
        ))
        # Trail B: ROOT_B -> BENE_B
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id="ROOT_B", transaction_amount=Decimal("75000.00"), layer="1",
            raw_data={"Account No": "BENE_B", "Action Taken By bank": "Bank B", "Bank/FIs": "Bank Y"}
        ))
        self.db.commit()

        # Query all
        res_all = get_ncrp_fund_flow_traceability_report_data(self.db, f.id, starting_account="ALL")
        self.assertEqual(len(res_all["starting_accounts"]), 2)
        self.assertEqual(res_all["summary_kpis"]["distinct_accounts_count"], 4)

        # Filter to ROOT_A only
        res_a = get_ncrp_fund_flow_traceability_report_data(self.db, f.id, starting_account="ROOT_A")
        self.assertEqual(res_a["selected_starting_account"], "ROOT_A")
        self.assertEqual(res_a["summary_kpis"]["distinct_accounts_count"], 2)
        node_ids = [n["id"] for n in res_a["graph"]["nodes"]]
        self.assertIn("ROOT_A", node_ids)
        self.assertIn("BENE_A", node_ids)
        self.assertNotIn("ROOT_B", node_ids)

    def test_03_confirmed_vs_possible_link_confidence(self):
        """Scenario 3: Links with valid UTR are CONFIRMED, missing UTRs are POSSIBLE."""
        f = self._create_file("confidence.xlsx")
        # Confirmed transfer
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="SRC_1", transaction_id_utr="IMPS12345678",
            transaction_amount=Decimal("30000.00"), layer="1",
            raw_data={"Account No": "DST_1", "Bank/FIs": "Axis Bank"}
        ))
        # Possible transfer (no UTR / placeholder)
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id="SRC_2", transaction_id_utr=None,
            transaction_amount=Decimal("40000.00"), layer="1",
            raw_data={"Account No": "DST_2", "Bank/FIs": "Kotak Bank", "Transaction ID / UTR Number": "N/A"}
        ))
        self.db.commit()

        res = get_ncrp_fund_flow_traceability_report_data(self.db, f.id)
        self.assertEqual(res["summary_kpis"]["confirmed_links_count"], 1)
        self.assertEqual(res["summary_kpis"]["possible_links_count"], 1)

        edges = res["graph"]["edges"]
        edge_1 = next(e for e in edges if e["source"] == "SRC_1")
        self.assertEqual(edge_1["status"], "CONFIRMED")
        self.assertIn("Exact UTR/Reference match", edge_1["evidence"][0])

        edge_2 = next(e for e in edges if e["source"] == "SRC_2")
        self.assertEqual(edge_2["status"], "POSSIBLE")

    def test_04_cyclic_flow_prevention(self):
        """Scenario 4: Cyclic fund flow (A -> B -> C -> A) terminates safely with is_cycle flag."""
        f = self._create_file("cycle.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="ACC_A", transaction_amount=Decimal("50000.00"), layer="1",
            raw_data={"Account No": "ACC_B"}
        ))
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id="ACC_B", transaction_amount=Decimal("45000.00"), layer="2",
            raw_data={"Account No": "ACC_C"}
        ))
        # C sends back to A (cycle)
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=4,
            account_or_wallet_id="ACC_C", transaction_amount=Decimal("40000.00"), layer="3",
            raw_data={"Account No": "ACC_A"}
        ))
        self.db.commit()

        # Should complete without infinite recursion or hanging
        res = get_ncrp_fund_flow_traceability_report_data(self.db, f.id)
        self.assertEqual(res["summary_kpis"]["distinct_accounts_count"], 3)
        # Check cycle edge
        edges = res["graph"]["edges"]
        cycle_edge = next(e for e in edges if e["source"] == "ACC_C" and e["target"] == "ACC_A")
        self.assertTrue(cycle_edge["is_cycle"])

    def test_05_terminal_accounts_and_statuses(self):
        """Scenario 5: Terminal accounts identification, withdrawal evidence, and hold integration."""
        f = self._create_file("terminals.xlsx")
        # L1 -> L2 (ordinary terminal)
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="SRC_ACC", transaction_amount=Decimal("100000.00"), layer="1",
            raw_data={"Account No": "TERM_PLAIN", "Bank/FIs": "PNB"}
        ))
        # L1 -> L2 (cash-out terminal)
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id="SRC_ACC", transaction_amount=Decimal("80000.00"), layer="1",
            raw_data={"Account No": "TERM_CASHOUT", "Bank/FIs": "SBI"}
        ))
        # ATM withdrawal on TERM_CASHOUT
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Withdrawal through ATM", row_number=4,
            account_or_wallet_id="TERM_CASHOUT", transaction_amount=Decimal("80000.00"),
            raw_data={"ATM ID": "ATM999", "Location": "Delhi"}
        ))
        # L1 -> L2 (held terminal)
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=5,
            account_or_wallet_id="SRC_ACC", transaction_amount=Decimal("60000.00"), layer="1",
            raw_data={"Account No": "TERM_HELD", "Bank/FIs": "HDFC"}
        ))
        # Put on hold for TERM_HELD
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Transaction put on hold", row_number=6,
            account_or_wallet_id="TERM_HELD", transaction_amount=Decimal("60000.00"),
            raw_data={"Action Taken By bank": "HDFC"}
        ))
        self.db.commit()

        res = get_ncrp_fund_flow_traceability_report_data(self.db, f.id)
        term_map = {t["account"]: t for t in res["terminal_accounts"]}
        self.assertEqual(len(term_map), 3)

        # Plain terminal
        self.assertEqual(term_map["TERM_PLAIN"]["terminal_status"], "Terminal — No Further Outgoing Record")
        self.assertEqual(term_map["TERM_PLAIN"]["unresolved_amount"], 100000.00)

        # Cash-out terminal
        self.assertEqual(term_map["TERM_CASHOUT"]["terminal_status"], "Possible Cash-Out — Evidence Required")
        self.assertEqual(term_map["TERM_CASHOUT"]["withdrawn_amount"], 80000.00)
        self.assertEqual(term_map["TERM_CASHOUT"]["unresolved_amount"], 0.00)

        # Held terminal
        self.assertEqual(term_map["TERM_HELD"]["terminal_status"], "Terminal — No Further Outgoing Record")
        self.assertEqual(term_map["TERM_HELD"]["held_amount"], 60000.00)
        self.assertEqual(term_map["TERM_HELD"]["unresolved_amount"], 0.00)

    def test_06_account_financial_summary_no_double_counting(self):
        """Scenario 6: Account financial summaries calculate incoming, outgoing, net, and unresolved."""
        f = self._create_file("accounting.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="A1", transaction_amount=Decimal("150000.00"), layer="1",
            raw_data={"Account No": "A2"}
        ))
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=3,
            account_or_wallet_id="A2", transaction_amount=Decimal("50000.00"), layer="2",
            raw_data={"Account No": "A3"}
        ))
        self.db.commit()

        res = get_ncrp_fund_flow_traceability_report_data(self.db, f.id)
        acc_map = {a["account"]: a for a in res["accounts_summary"]}

        # A2 received 150k and sent 50k
        a2 = acc_map["A2"]
        self.assertEqual(a2["total_incoming"], 150000.00)
        self.assertEqual(a2["total_outgoing"], 50000.00)
        self.assertEqual(a2["net_movement"], 100000.00)
        self.assertEqual(a2["unresolved_amount"], 100000.00)

        # Overall unresolved trace amount at terminal endpoints is exactly A3's 50k
        self.assertEqual(res["summary_kpis"]["unresolved_trace_amount"], 50000.00)

    def test_07_broken_links_and_gaps_audit(self):
        """Scenario 7: Audit flags missing UTRs and statement gaps at terminal accounts."""
        f = self._create_file("gaps.xlsx")
        # Transfer without UTR
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="ACC_S", transaction_id_utr=None,
            transaction_amount=Decimal("65000.00"), layer="1",
            raw_data={"Account No": "ACC_D", "Bank/FIs": "Canara Bank"}
        ))
        self.db.commit()

        res = get_ncrp_fund_flow_traceability_report_data(self.db, f.id)
        gaps = res["broken_links_and_gaps"]
        self.assertGreaterEqual(len(gaps), 2)  # 1 for missing UTR + 1 for unresolved statement gap

        utr_gap = next((g for g in gaps if "Missing UTR" in g["issue_type"]), None)
        self.assertIsNotNone(utr_gap)
        self.assertIn("Canara Bank", utr_gap["bank"])

        statement_gap = next((g for g in gaps if "Unresolved Trail" in g["issue_type"]), None)
        self.assertIsNotNone(statement_gap)
        self.assertIn("91 CrPC", statement_gap["suggested_action"])

    def test_08_suggested_investigative_actions(self):
        """Scenario 8: Formulates evidence-grounded action plans with legal basis."""
        f = self._create_file("actions.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="ACC_S", transaction_amount=Decimal("120000.00"), layer="1",
            raw_data={"Account No": "ACC_D", "Bank/FIs": "Union Bank of India"}
        ))
        self.db.commit()

        res = get_ncrp_fund_flow_traceability_report_data(self.db, f.id)
        actions = res["suggested_actions"]
        self.assertGreaterEqual(len(actions), 1)

        act = actions[0]
        self.assertEqual(act["priority"], "HIGH")
        self.assertIn("Union Bank of India", act["target_bank"])
        self.assertIn("Section 91 CrPC", act["legal_basis"])

    def test_09_empty_workbook_handling(self):
        """Scenario 9: Empty workbook returns safe initialized payload with zero counts."""
        f = self._create_file("empty.xlsx")
        res = get_ncrp_fund_flow_traceability_report_data(self.db, f.id)
        validated = NcrpFundFlowTraceabilityReportResponse.model_validate(res)

        self.assertEqual(validated.summary_kpis["total_ncrp_transactions"], 0)
        self.assertEqual(validated.summary_kpis["total_recorded_inflow"], 0.0)
        self.assertEqual(len(validated.graph["nodes"]), 0)
        self.assertEqual(len(validated.terminal_accounts), 0)

    def test_10_missing_optional_sheets(self):
        """Scenario 10: Workbook with only transfers sheet and no withdrawal/hold sheets functions cleanly."""
        f = self._create_file("only_transfers.xlsx")
        self.db.add(NcrpTransaction(
            ncrp_file_id=f.id, case_id=1, sheet_name="Money Transfer to", row_number=2,
            account_or_wallet_id="A1", transaction_amount=Decimal("40000.00"), layer="1",
            raw_data={"Account No": "A2", "Bank/FIs": "Federal Bank"}
        ))
        self.db.commit()

        res = get_ncrp_fund_flow_traceability_report_data(self.db, f.id)
        self.assertEqual(res["summary_kpis"]["distinct_accounts_count"], 2)
        self.assertEqual(res["accounts_summary"][0]["held_amount"], 0.0)
        self.assertEqual(res["accounts_summary"][0]["withdrawn_amount"], 0.0)


if __name__ == "__main__":
    unittest.main()
