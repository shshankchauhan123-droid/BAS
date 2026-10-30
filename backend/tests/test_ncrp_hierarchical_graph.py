import unittest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.main  # Ensure all models are registered in metadata
from app.core.database import Base
from app.ncrp.ncrp_model import NcrpFile, NcrpTransaction
from app.ncrp.ncrp_repository import (
    get_ncrp_account_profile_data,
    get_ncrp_hierarchical_graph_data,
    mask_account_number,
)


class TestNcrpHierarchicalGraph(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db = self.SessionLocal()

        # Create dummy file
        self.ncrp_file = NcrpFile(
            case_id=1,
            created_by=1,
            original_filename="Test_NCRP_Workbook.xlsx",
            stored_filename="test.xlsx",
            file_path="storage/ncrp/1/test.xlsx",
            file_size=1024,
            sheet_count=3,
            total_rows=10,
            imported_rows=10,
            failed_rows=0,
            status="COMPLETED",
        )
        self.db.add(self.ncrp_file)
        self.db.commit()
        self.db.refresh(self.ncrp_file)

        # Create dummy transactions:
        # Layer 1: Suspect Acc 111122223333 -> Acc 444455556666 (₹50,000)
        # Layer 1: Suspect Acc 111122223333 -> Acc 444455556666 (₹25,000) [Aggregation test]
        # Layer 1: Suspect Acc 111122223333 -> Acc 777788889999 (₹30,000)
        # Layer 2: Acc 444455556666 -> Acc 999900001111 (₹40,000)
        # Hold: Acc 999900001111 has Hold of ₹40,000
        txs = [
            NcrpTransaction(
                ncrp_file_id=self.ncrp_file.id,
                case_id=1,
                sheet_name="Money Transfer to",
                row_number=1,
                acknowledgement_no="ACK-001",
                account_or_wallet_id="111122223333",
                transaction_id_utr="UTR1001",
                transaction_date=datetime(2026, 1, 15, tzinfo=timezone.utc),
                transaction_amount=50000.0,
                disputed_amount=50000.0,
                bank_name="State Bank of India",
                layer="1",
                raw_data={
                    "Account No": "444455556666",
                    "Bank/FIs": "HDFC Bank",
                    "Action Taken By bank": "State Bank of India",
                    "IFSC": "SBIN0001234",
                    "Account Holder Name": "Suspect One",
                },
            ),
            NcrpTransaction(
                ncrp_file_id=self.ncrp_file.id,
                case_id=1,
                sheet_name="Money Transfer to",
                row_number=2,
                acknowledgement_no="ACK-001",
                account_or_wallet_id="111122223333",
                transaction_id_utr="UTR1002",
                transaction_date=datetime(2026, 1, 15, tzinfo=timezone.utc),
                transaction_amount=25000.0,
                disputed_amount=25000.0,
                bank_name="State Bank of India",
                layer="1",
                raw_data={
                    "Account No": "444455556666",
                    "Bank/FIs": "HDFC Bank",
                    "Action Taken By bank": "State Bank of India",
                },
            ),
            NcrpTransaction(
                ncrp_file_id=self.ncrp_file.id,
                case_id=1,
                sheet_name="Money Transfer to",
                row_number=3,
                acknowledgement_no="ACK-001",
                account_or_wallet_id="111122223333",
                transaction_id_utr="UTR1003",
                transaction_date=datetime(2026, 1, 16, tzinfo=timezone.utc),
                transaction_amount=30000.0,
                disputed_amount=30000.0,
                bank_name="State Bank of India",
                layer="1",
                raw_data={
                    "Account No": "777788889999",
                    "Bank/FIs": "ICICI Bank",
                    "Action Taken By bank": "State Bank of India",
                },
            ),
            NcrpTransaction(
                ncrp_file_id=self.ncrp_file.id,
                case_id=1,
                sheet_name="Money Transfer to Layer 2",
                row_number=4,
                acknowledgement_no="ACK-001",
                account_or_wallet_id="444455556666",
                transaction_id_utr="UTR2001",
                transaction_date=datetime(2026, 1, 17, tzinfo=timezone.utc),
                transaction_amount=40000.0,
                disputed_amount=40000.0,
                bank_name="HDFC Bank",
                layer="2",
                raw_data={
                    "Account No": "999900001111",
                    "Bank/FIs": "Axis Bank",
                    "Action Taken By bank": "HDFC Bank",
                },
            ),
            NcrpTransaction(
                ncrp_file_id=self.ncrp_file.id,
                case_id=1,
                sheet_name="Put on Hold",
                row_number=5,
                acknowledgement_no="ACK-001",
                account_or_wallet_id="999900001111",
                transaction_id_utr=None,
                transaction_date=datetime(2026, 1, 18, tzinfo=timezone.utc),
                transaction_amount=40000.0,
                disputed_amount=40000.0,
                bank_name="Axis Bank",
                layer="3",
                raw_data={
                    "Account No": "999900001111",
                    "Bank/FIs": "Axis Bank",
                    "Put on Hold Amount": 40000.0,
                },
            ),
        ]
        self.db.bulk_save_objects(txs)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_mask_account_number(self):
        self.assertEqual(mask_account_number("111122223333"), "11XXXXXX3333")
        self.assertEqual(mask_account_number("1234"), "1234")
        self.assertEqual(mask_account_number("123456"), "1XXXX6")
        self.assertEqual(mask_account_number(""), "")

    def test_root_detection_and_initial_hierarchy(self):
        res = get_ncrp_hierarchical_graph_data(
            db=self.db,
            file_id=self.ncrp_file.id,
            case_id=1,
        )

        self.assertEqual(res["selected_root"], "111122223333")
        self.assertEqual(len(res["root_accounts"]), 1)
        self.assertEqual(res["root_accounts"][0]["account"], "111122223333")

        # Initial nodes: root (111122223333) and its direct receivers (444455556666, 777788889999)
        node_accounts = {n["account"] for n in res["nodes"]}
        self.assertIn("111122223333", node_accounts)
        self.assertIn("444455556666", node_accounts)
        self.assertIn("777788889999", node_accounts)
        self.assertEqual(len(node_accounts), 3)

        # Edges should be aggregated:
        # 111122223333 -> 444455556666 has 2 transfers totaling 75000.0
        edge_4444 = next(e for e in res["edges"] if e["target_acc"] == "444455556666")
        self.assertEqual(edge_4444["amount"], 75000.0)
        self.assertEqual(edge_4444["tx_count"], 2)

        # Top summary KPIs
        self.assertEqual(res["total_amount"], 145000.0)
        self.assertEqual(res["total_disputed_amount"], 145000.0)
        self.assertEqual(res["distinct_accounts_count"], 4)

    def test_progressive_layer_expansion(self):
        # Expand account 444455556666 to uncover Layer 2 -> Layer 3
        res = get_ncrp_hierarchical_graph_data(
            db=self.db,
            file_id=self.ncrp_file.id,
            case_id=1,
            expanded_accounts=["444455556666"],
        )

        node_accounts = {n["account"] for n in res["nodes"]}
        self.assertIn("999900001111", node_accounts)
        self.assertEqual(len(node_accounts), 4)

        # Check node 999900001111 properties: Money Transfer To receiver
        node_9999 = next(n for n in res["nodes"] if n["account"] == "999900001111")
        self.assertEqual(node_9999["account"], "999900001111")
        self.assertEqual(node_9999["total_in"], 40000.0)
        self.assertEqual(node_9999["role"], "Receiver / Beneficiary")

    def test_terminal_account_expansion(self):
        # 777788889999 has no outgoing transfers
        res = get_ncrp_hierarchical_graph_data(
            db=self.db,
            file_id=self.ncrp_file.id,
            case_id=1,
            expand_account="777788889999",
        )

        self.assertFalse(res["has_outgoing"])
        self.assertEqual(
            res["message"],
            "No further linked transactions available for this account.",
        )

    def test_account_profile_drawer_data(self):
        profile = get_ncrp_account_profile_data(
            db=self.db,
            file_id=self.ncrp_file.id,
            account="111122223333",
            case_id=1,
        )

        self.assertEqual(profile["account"], "111122223333")
        self.assertEqual(profile["masked_account"], "11XXXXXX3333")
        self.assertEqual(profile["account_role"], "Source / Origin")
        self.assertEqual(profile["account_holder_name"], "Suspect One")
        self.assertEqual(profile["ifsc"], "SBIN0001234")
        self.assertEqual(profile["ack_no"], "ACK-001")
        self.assertEqual(profile["distinct_utr_count"], 3)
        self.assertEqual(len(profile["connected_accounts"]), 2)
        self.assertEqual(profile["total_out_amount"], 105000.0)
        self.assertEqual(profile["net_flow"], -105000.0)
        self.assertIn("money_transfers", profile)
        self.assertIn("pos_withdrawals", profile)
        self.assertIn("atm_withdrawals", profile)
        self.assertIn("cheque_withdrawals", profile)
        self.assertIn("hold_records", profile)
        self.assertIn("other_records", profile)
        self.assertEqual(len(profile["money_transfers"]), 3)
        self.assertEqual(profile["money_transfers"][0]["direction"], "OUTGOING")
        self.assertEqual(profile["money_transfers"][0]["sender_account"], "111122223333")


if __name__ == "__main__":
    unittest.main()
