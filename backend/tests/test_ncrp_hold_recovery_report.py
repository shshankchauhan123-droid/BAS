import unittest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.main  # Ensure all models are registered in metadata
from app.core.database import Base
from app.ncrp.ncrp_model import NcrpFile, NcrpTransaction
from app.ncrp.ncrp_repository import (
    calculate_ncrp_priority_risk_score,
    get_ncrp_hold_recovery_report_data,
)
from app.ncrp.ncrp_schema import NcrpHoldRecoveryReportResponse


class TestNcrpHoldRecoveryReport(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db = self.SessionLocal()

        # Create dummy NCRP file
        self.ncrp_file = NcrpFile(
            case_id=10,
            created_by=1,
            original_filename="NCRP_Hold_Recovery_Test.xlsx",
            stored_filename="test_hold.xlsx",
            file_path="storage/ncrp/10/test_hold.xlsx",
            file_size=2048,
            sheet_count=6,
            total_rows=15,
            imported_rows=15,
            failed_rows=0,
            status="COMPLETED",
        )
        self.db.add(self.ncrp_file)
        self.db.commit()
        self.db.refresh(self.ncrp_file)

        # Populate transactions representing all 6 sheets:
        # Layer 1: ₹5,00,000 sent from 111122223333 to 444455556666 (HDFC Bank)
        # Layer 2: ₹2,00,000 sent from 444455556666 to 777788889999 (SBI)
        # Hold: ₹50,000 held in 777788889999 (SBI)
        # Other (Lien): ₹1,00,000 reported lien in 444455556666 (HDFC Bank)
        # ATM: ₹20,000 withdrawn from PNB
        # POS: ₹30,000 withdrawn from Axis Bank
        # Cheque: ₹1,50,000 withdrawn from ICICI Bank
        txs = [
            # Money Transfer to - Layer 1
            NcrpTransaction(
                ncrp_file_id=self.ncrp_file.id,
                case_id=10,
                sheet_name="Money Transfer to",
                row_number=1,
                acknowledgement_no="ACK-999",
                account_or_wallet_id="111122223333",
                transaction_id_utr="UTR101",
                transaction_date=datetime(2026, 2, 1, tzinfo=timezone.utc),
                transaction_amount=500000.0,
                disputed_amount=500000.0,
                bank_name="HDFC Bank",
                layer="1",
                raw_data={
                    "Account No": "444455556666",
                    "Bank/FIs": "HDFC Bank",
                    "Action Taken By bank": "HDFC Bank",
                },
            ),
            # Money Transfer to - Layer 2
            NcrpTransaction(
                ncrp_file_id=self.ncrp_file.id,
                case_id=10,
                sheet_name="Money Transfer to",
                row_number=2,
                acknowledgement_no="ACK-999",
                account_or_wallet_id="444455556666",
                transaction_id_utr="UTR102",
                transaction_date=datetime(2026, 2, 2, tzinfo=timezone.utc),
                transaction_amount=200000.0,
                disputed_amount=200000.0,
                bank_name="State Bank of India",
                layer="2",
                raw_data={
                    "Account No": "777788889999",
                    "Bank/FIs": "State Bank of India",
                    "Action Taken By bank": "State Bank of India",
                },
            ),
            # Transaction put on hold
            NcrpTransaction(
                ncrp_file_id=self.ncrp_file.id,
                case_id=10,
                sheet_name="Transaction put on hold",
                row_number=3,
                acknowledgement_no="ACK-999",
                account_or_wallet_id="777788889999",
                transaction_id_utr="HOLD001",
                transaction_date=datetime(2026, 2, 3, tzinfo=timezone.utc),
                transaction_amount=50000.0,
                disputed_amount=50000.0,
                bank_name="State Bank of India",
                layer="2",
                raw_data={
                    "Account No": "777788889999",
                    "Bank/FIs": "State Bank of India",
                    "Action Taken By bank": "State Bank of India",
                    "Remarks": "Amount put on hold pursuant to notice",
                },
            ),
            # Other (Lien / Shadow balance)
            NcrpTransaction(
                ncrp_file_id=self.ncrp_file.id,
                case_id=10,
                sheet_name="Other",
                row_number=4,
                acknowledgement_no="ACK-999",
                account_or_wallet_id="444455556666",
                transaction_id_utr="LIEN001",
                transaction_date=datetime(2026, 2, 4, tzinfo=timezone.utc),
                transaction_amount=100000.0,
                disputed_amount=100000.0,
                bank_name="HDFC Bank",
                layer="1",
                raw_data={
                    "Account No": "444455556666",
                    "Bank/FIs": "HDFC Bank",
                    "Remarks": "Lien marked on account for Rs 100000",
                },
            ),
            # Withdrawal through ATM
            NcrpTransaction(
                ncrp_file_id=self.ncrp_file.id,
                case_id=10,
                sheet_name="Withdrawal through ATM",
                row_number=5,
                acknowledgement_no="ACK-999",
                account_or_wallet_id="444455556666",
                transaction_id_utr="ATM001",
                transaction_date=datetime(2026, 2, 5, tzinfo=timezone.utc),
                transaction_amount=20000.0,
                disputed_amount=20000.0,
                bank_name="Punjab National Bank",
                layer="1",
                raw_data={
                    "Account No": "444455556666",
                    "Bank/FIs": "Punjab National Bank",
                    "ATM ID": "PNB-ATM-01",
                },
            ),
            # Withdrawal through POS
            NcrpTransaction(
                ncrp_file_id=self.ncrp_file.id,
                case_id=10,
                sheet_name="Withdrawal through POS",
                row_number=6,
                acknowledgement_no="ACK-999",
                account_or_wallet_id="444455556666",
                transaction_id_utr="POS001",
                transaction_date=datetime(2026, 2, 6, tzinfo=timezone.utc),
                transaction_amount=30000.0,
                disputed_amount=30000.0,
                bank_name="Axis Bank",
                layer="1",
                raw_data={
                    "Account No": "444455556666",
                    "Bank/FIs": "Axis Bank",
                    "Merchant Name": "TEST MERCHANT",
                },
            ),
            # Cash Withdrawal through Cheque
            NcrpTransaction(
                ncrp_file_id=self.ncrp_file.id,
                case_id=10,
                sheet_name="Cash Withdrawal through Cheque",
                row_number=7,
                acknowledgement_no="ACK-999",
                account_or_wallet_id="777788889999",
                transaction_id_utr="CHQ001",
                transaction_date=datetime(2026, 2, 7, tzinfo=timezone.utc),
                transaction_amount=150000.0,
                disputed_amount=150000.0,
                bank_name="ICICI Bank",
                layer="2",
                raw_data={
                    "Account No": "777788889999",
                    "Bank/FIs": "ICICI Bank",
                    "Cheque No": "CHQ-123456",
                    "Payee Name": "Cash Withdrawal",
                },
            ),
        ]
        self.db.add_all(txs)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_hold_recovery_overview_calculations(self):
        raw = get_ncrp_hold_recovery_report_data(self.db, self.ncrp_file.id, case_id=10)
        self.assertIsNotNone(raw)
        report = NcrpHoldRecoveryReportResponse.model_validate(raw)

        overview = report.overview
        # Layer 1 amount = 500,000
        self.assertEqual(overview.reconciled_fraud_exposure.value, 500000.0)
        # Trace linked volume: 500k + 200k = 700,000
        self.assertEqual(overview.trace_linked_volume.value, 700000.0)
        # Verified hold: 50,000
        self.assertEqual(overview.amount_on_hold.value, 50000.0)
        # Total withdrawn: 20k (ATM) + 30k (POS) + 150k (Cheque) = 200,000
        self.assertEqual(overview.total_withdrawn_amount.value, 200000.0)
        # Unsecured gap: 500k - 50k = 450,000
        self.assertEqual(overview.unsecured_gap.value, 450000.0)
        # Hold coverage: 50,000 / 500,000 * 100 = 10.0%
        self.assertEqual(overview.hold_coverage.value, 10.0)
        # Actual recovered: 0.0
        self.assertEqual(overview.actual_recovered_amount.value, 0.0)

    def test_hold_allocation_and_layers(self):
        raw = get_ncrp_hold_recovery_report_data(self.db, self.ncrp_file.id, case_id=10)
        report = NcrpHoldRecoveryReportResponse.model_validate(raw)
        
        # Check hold allocation
        allocation = report.hold_allocation
        self.assertGreater(len(allocation.categories), 0)
        
        # Check layer decay (Layers present in workbook)
        layers = report.layer_coverage
        self.assertEqual(len(layers), 2)
        l1 = next((item for item in layers if item.layer_num == 1), None)
        l2 = next((item for item in layers if item.layer_num == 2), None)
        self.assertIsNotNone(l1)
        self.assertIsNotNone(l2)
        self.assertEqual(l1.disputed_amount, 500000.0)
        self.assertEqual(l2.disputed_amount, 200000.0)
        self.assertEqual(l2.verified_hold_amount, 50000.0)

    def test_withdrawals_and_compliance(self):
        raw = get_ncrp_hold_recovery_report_data(self.db, self.ncrp_file.id, case_id=10)
        report = NcrpHoldRecoveryReportResponse.model_validate(raw)
        
        # Withdrawals breakdown
        withdrawals = report.withdrawals
        self.assertEqual(withdrawals.total_amount, 200000.0)
        pos = next((m for m in withdrawals.methods if "POS" in m.method), None)
        atm = next((m for m in withdrawals.methods if "ATM" in m.method), None)
        cheque = next((m for m in withdrawals.methods if "Cheque" in m.method), None)
        self.assertIsNotNone(pos)
        self.assertIsNotNone(atm)
        self.assertIsNotNone(cheque)
        self.assertEqual(pos.amount, 30000.0)
        self.assertEqual(atm.amount, 20000.0)
        self.assertEqual(cheque.amount, 150000.0)
        self.assertEqual(len(withdrawals.records), 3)

        # Bank compliance matrix
        matrix = report.bank_matrix
        self.assertGreater(len(matrix), 0)
        sbi = next((b for b in matrix if "State Bank of India" in b.bank_name), None)
        self.assertIsNotNone(sbi)
        self.assertEqual(sbi.verified_hold_amount, 50000.0)
        self.assertEqual(sbi.verification_status, "Partially Held")

        # Priority follow-up recommendations
        self.assertGreater(len(report.priority_actions), 0)

    def test_risk_scoring_matrix_and_thresholds(self):
        """Verify transparent 0-100 risk scoring algorithm across all business scenarios."""
        # Scenario 1: ₹10 lakh POS withdrawal with zero hold -> CRITICAL
        score, pri, _ = calculate_ncrp_priority_risk_score(1000000.0, 0.0, is_cash_out=True)
        self.assertEqual(pri, "CRITICAL")
        self.assertGreaterEqual(score, 70.0)

        # Scenario 2: ₹5 lakh cheque withdrawal with zero hold -> CRITICAL
        score, pri, _ = calculate_ncrp_priority_risk_score(500000.0, 0.0, is_cash_out=True)
        self.assertEqual(pri, "CRITICAL")
        self.assertGreaterEqual(score, 70.0)

        # Scenario 3: ₹2 lakh POS withdrawal with zero hold -> HIGH
        score, pri, _ = calculate_ncrp_priority_risk_score(200000.0, 0.0, is_cash_out=True)
        self.assertEqual(pri, "HIGH")
        self.assertTrue(45.0 <= score < 70.0)

        # Scenario 4: ₹6 lakh ATM withdrawal with zero hold -> CRITICAL
        score, pri, _ = calculate_ncrp_priority_risk_score(600000.0, 0.0, is_cash_out=True)
        self.assertEqual(pri, "CRITICAL")
        self.assertGreaterEqual(score, 70.0)

        # Scenario 5: ₹50,000 cheque withdrawal with zero hold -> MEDIUM
        score, pri, _ = calculate_ncrp_priority_risk_score(50000.0, 0.0, is_cash_out=True)
        self.assertEqual(pri, "MEDIUM")
        self.assertTrue(20.0 <= score < 45.0)

        # Scenario 6: ₹50,000 POS withdrawal with zero hold -> MEDIUM
        score, pri, _ = calculate_ncrp_priority_risk_score(50000.0, 0.0, is_cash_out=True)
        self.assertEqual(pri, "MEDIUM")
        self.assertTrue(20.0 <= score < 45.0)

        # Scenario 7: ₹8 lakh exposure with ₹7.9 lakh verified hold -> LOW (lower priority based on remaining risk)
        score, pri, _ = calculate_ncrp_priority_risk_score(800000.0, 790000.0, is_cash_out=False)
        self.assertEqual(pri, "LOW")
        self.assertLess(score, 20.0)

        # Scenario 8: ₹8,000 exposure with ₹1 token hold -> MEDIUM
        score, pri, _ = calculate_ncrp_priority_risk_score(8000.0, 1.0, is_token_hold=True, is_dispersal_hub=True)
        self.assertEqual(pri, "MEDIUM")
        self.assertTrue(20.0 <= score < 45.0)

        # Scenario 9: ₹90,000 lien mentioned in Other but absent from Hold worksheet -> HIGH
        score, pri, _ = calculate_ncrp_priority_risk_score(90000.0, 0.0, is_unverified_lien=True)
        self.assertEqual(pri, "HIGH")
        self.assertTrue(45.0 <= score < 70.0)

    def test_dynamic_priority_actions_generation(self):
        """Verify dynamic generation, ordering, and evidence formatting of priority actions."""
        raw = get_ncrp_hold_recovery_report_data(self.db, self.ncrp_file.id, case_id=10)
        report = NcrpHoldRecoveryReportResponse.model_validate(raw)

        actions = report.priority_actions
        self.assertGreater(len(actions), 0)

        # Check sorting: CRITICAL -> HIGH -> MEDIUM -> LOW
        pri_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        for i in range(len(actions) - 1):
            curr_pri = pri_order[actions[i].priority]
            next_pri = pri_order[actions[i + 1].priority]
            self.assertLessEqual(curr_pri, next_pri)

        # Verify attributes exist on each action
        for act in actions:
            self.assertTrue(act.id.startswith("pri-"))
            self.assertIn(act.priority, ("CRITICAL", "HIGH", "MEDIUM", "LOW"))
            self.assertIsNotNone(act.account)
            self.assertIsNotNone(act.bank)
            self.assertGreater(act.disputed_amount, 0.0)
            self.assertEqual(act.unsecured_gap, max(0.0, act.disputed_amount - act.verified_hold_amount))
            self.assertIsNotNone(act.investigation_reason)
            self.assertIsNotNone(act.recommended_action)
            self.assertIsNotNone(act.risk_score)


if __name__ == "__main__":
    unittest.main()
