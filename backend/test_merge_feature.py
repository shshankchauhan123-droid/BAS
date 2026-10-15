import sys
import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

# Ensure backend root is on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.core.database import SessionLocal
from app.user.user_model import User
from app.case.case_model import Case
from app.files.file_model import File, MergedFileSource
from app.bank_transactions.bank_transaction_model import BankTransaction
from app.files.file_schema import MergeFilesRequest
from app.files.file_service import normalize_account_number, merge_case_files
from app.files.file_repository import (
    resolve_source_file_ids,
    get_source_files_for_merged,
    get_source_file_ids_for_merged,
    delete_file,
)
from app.bank_transactions.bank_transaction_repository import (
    get_transactions_by_file,
    get_transactions_by_file_paginated,
    get_file_transaction_summary,
    get_case_transaction_summary,
    get_mode_wise_by_case,
    get_filtered_transactions_by_case,
    get_transaction_relationships,
    get_counterparty_analysis,
)

def run_tests():
    db = SessionLocal()
    results = []

    def record(name: str, passed: bool, detail: str = ""):
        results.append((name, passed, detail))
        status_str = "PASS" if passed else "FAIL"
        print(f"[{status_str}] {name} {f'({detail})' if detail else ''}")

    print("=" * 70)
    print("STARTING COMPREHENSIVE MERGE BANK STATEMENTS TEST SUITE")
    print("=" * 70)

    # Setup temporary test entities
    test_run_id = uuid.uuid4().hex[:8]
    test_user = None
    test_case_1 = None
    test_case_2 = None
    created_files = []
    created_transactions = []

    try:
        # Create test user
        test_user = User(
            username=f"test_investigator_{test_run_id}",
            email=f"test_{test_run_id}@bas.local",
            password_hash="fakehashedpassword",
            role="admin",
            is_active=True,
        )
        db.add(test_user)
        db.flush()

        # Create 2 test cases
        test_case_1 = Case(
            case_number=f"CASE-TEST-1-{test_run_id}",
            case_name="Forensic Investigation Case 1",
            description="Testing statement merging",
            created_by=test_user.id,
            status="active",
        )
        test_case_2 = Case(
            case_number=f"CASE-TEST-2-{test_run_id}",
            case_name="Forensic Investigation Case 2",
            description="Cross case boundary testing",
            created_by=test_user.id,
            status="active",
        )
        db.add_all([test_case_1, test_case_2])
        db.commit()

        # Helper to create file
        def make_file(case_id, filename, acc_no, start_d, end_d, status="COMPLETED", size=1024):
            f = File(
                case_id=case_id,
                created_by=test_user.id,
                original_filename=filename,
                stored_filename=f"test_{uuid.uuid4().hex}.pdf",
                file_path=os.path.join(BASE_DIR, "storage", "cases", str(case_id), f"test_{uuid.uuid4().hex}.pdf"),
                file_size=size,
                status=status,
                account_name="M/S ACME TRADING CORP",
                account_number=acc_no,
                bank_name="STATE BANK OF INDIA",
                branch_name="COMMERCIAL BRANCH",
                ifsc="SBIN0001234",
                account_type="CURRENT",
                statement_start_date=start_d,
                statement_end_date=end_d,
            )
            # Ensure parent dir exists
            os.makedirs(os.path.dirname(f.file_path), exist_ok=True)
            with open(f.file_path, "wb") as fp:
                fp.write(b"%PDF-1.4 mock content")
            db.add(f)
            db.flush()
            created_files.append(f)
            return f

        # Helper to create transactions
        def make_tx(file_obj, tx_date, dr, cr, bal, desc, mode="NEFT", cp_name=None):
            tx = BankTransaction(
                file_id=file_obj.id,
                case_id=file_obj.case_id,
                account_name=file_obj.account_name,
                account_number=file_obj.account_number,
                transaction_date=tx_date,
                debit=Decimal(str(dr)) if dr else None,
                credit=Decimal(str(cr)) if cr else None,
                balance=Decimal(str(bal)) if bal else None,
                description=desc,
                mode=mode,
                counterparty_name=cp_name,
                counterparty_type="VENDOR" if cp_name else None,
                counterparty_source="RULE",
                counterparty_status="VERIFIED" if cp_name else None,
            )
            db.add(tx)
            db.flush()
            created_transactions.append(tx)
            return tx

        # -------------------------------------------------------------
        # SCENARIO 1: Two files with identical valid account numbers merge successfully
        # -------------------------------------------------------------
        f1 = make_file(test_case_1.id, "FY23_SBI_Stmt.pdf", "98765432101", date(2023, 4, 1), date(2024, 3, 31))
        f2 = make_file(test_case_1.id, "FY24_SBI_Stmt.pdf", "98765432101", date(2024, 4, 1), date(2025, 3, 31))
        make_tx(f1, date(2023, 5, 10), 15000, 0, 85000, "SUPPLIER PAYMENT 1", "NEFT", "TRIDENT DRUGS")
        make_tx(f1, date(2023, 11, 20), 0, 50000, 135000, "CUSTOMER RECEIPT 1", "RTGS", "APEX LOGISTICS")
        make_tx(f2, date(2024, 6, 15), 25000, 0, 110000, "SUPPLIER PAYMENT 2", "NEFT", "TRIDENT DRUGS")

        req1 = MergeFilesRequest(file_ids=[f1.id, f2.id], merged_filename="Custom_Merged_FY23_FY24.pdf")
        merged1 = merge_case_files(db, test_case_1.id, test_user, req1)
        created_files.append(merged1)

        is_merged1_ok = (
            merged1 is not None and
            merged1.is_merged is True and
            merged1.original_filename == "Custom_Merged_FY23_FY24.pdf" and
            merged1.account_number == "98765432101" and
            merged1.statement_start_date == date(2023, 4, 1) and
            merged1.statement_end_date == date(2025, 3, 31)
        )
        record("Scenario 1: Merge 2 files with identical accounts", is_merged1_ok, f"Merged File ID {merged1.id}")

        # -------------------------------------------------------------
        # SCENARIO 2: Four files with the same account number merge successfully
        # -------------------------------------------------------------
        f_q1 = make_file(test_case_1.id, "Q1_2025.pdf", "98765432101", date(2025, 4, 1), date(2025, 6, 30))
        f_q2 = make_file(test_case_1.id, "Q2_2025.pdf", "98765432101", date(2025, 7, 1), date(2025, 9, 30))
        f_q3 = make_file(test_case_1.id, "Q3_2025.pdf", "98765432101", date(2025, 10, 1), date(2025, 12, 31))
        f_q4 = make_file(test_case_1.id, "Q4_2025.pdf", "98765432101", date(2026, 1, 1), date(2026, 3, 31))

        make_tx(f_q1, date(2025, 5, 1), 1000, 0, 109000, "Q1 Bill", "UPI")
        make_tx(f_q2, date(2025, 8, 1), 2000, 0, 107000, "Q2 Bill", "UPI")
        make_tx(f_q3, date(2025, 11, 1), 3000, 0, 104000, "Q3 Bill", "UPI")
        make_tx(f_q4, date(2026, 2, 1), 4000, 0, 100000, "Q4 Bill", "UPI")

        req2 = MergeFilesRequest(file_ids=[f_q1.id, f_q2.id, f_q3.id, f_q4.id])
        merged2 = merge_case_files(db, test_case_1.id, test_user, req2)
        created_files.append(merged2)

        s_ids = get_source_file_ids_for_merged(db, merged2.id)
        is_merged2_ok = len(s_ids) == 4 and set(s_ids) == {f_q1.id, f_q2.id, f_q3.id, f_q4.id}
        record("Scenario 2: Merge 4 consecutive files", is_merged2_ok, f"Sources: {s_ids}")

        # -------------------------------------------------------------
        # SCENARIO 3: Chronological ordering of transactions (asc, nulls_last)
        # -------------------------------------------------------------
        txs_merged1 = get_transactions_by_file(db, merged1.id)
        dates = [tx.transaction_date for tx in txs_merged1]
        is_chrono = dates == sorted(dates)
        record("Scenario 3: Chronological transaction ordering", is_chrono, f"Dates: {dates}")

        # -------------------------------------------------------------
        # SCENARIO 4: NULL account number validation failure
        # -------------------------------------------------------------
        f_null = make_file(test_case_1.id, "Null_Acc.pdf", None, date(2024, 1, 1), date(2024, 6, 30))
        f_valid = make_file(test_case_1.id, "Valid_Acc.pdf", "98765432101", date(2024, 7, 1), date(2024, 12, 31))
        failed_null = False
        try:
            merge_case_files(db, test_case_1.id, test_user, MergeFilesRequest(file_ids=[f_null.id, f_valid.id]))
        except ValueError as e:
            failed_null = "valid account number" in str(e) or "account" in str(e).lower()
        record("Scenario 4: NULL account number rejection", failed_null)

        # -------------------------------------------------------------
        # SCENARIO 5: Empty / whitespace account number rejection
        # -------------------------------------------------------------
        f_empty = make_file(test_case_1.id, "Empty_Acc.pdf", "   ", date(2024, 1, 1), date(2024, 6, 30))
        failed_empty = False
        try:
            merge_case_files(db, test_case_1.id, test_user, MergeFilesRequest(file_ids=[f_empty.id, f_valid.id]))
        except ValueError as e:
            failed_empty = "valid account number" in str(e) or "account" in str(e).lower()
        record("Scenario 5: Empty/whitespace account number rejection", failed_empty)

        # -------------------------------------------------------------
        # SCENARIO 6: Different account numbers rejection
        # -------------------------------------------------------------
        f_diff = make_file(test_case_1.id, "Diff_Acc.pdf", "112233445566", date(2024, 1, 1), date(2024, 6, 30))
        failed_diff = False
        try:
            merge_case_files(db, test_case_1.id, test_user, MergeFilesRequest(file_ids=[f_valid.id, f_diff.id]))
        except ValueError as e:
            failed_diff = "do not match" in str(e)
        record("Scenario 6: Differing account numbers rejection", failed_diff)

        # -------------------------------------------------------------
        # SCENARIO 7: Selecting fewer than two files rejection
        # -------------------------------------------------------------
        failed_few = False
        try:
            merge_case_files(db, test_case_1.id, test_user, MergeFilesRequest(file_ids=[f_valid.id]))
        except ValueError as e:
            failed_few = "at least two files" in str(e).lower()
        record("Scenario 7: Fewer than 2 files rejection", failed_few)

        # -------------------------------------------------------------
        # SCENARIO 8: File still processing rejection
        # -------------------------------------------------------------
        f_proc = make_file(test_case_1.id, "Processing.pdf", "98765432101", date(2024, 1, 1), date(2024, 6, 30), status="PROCESSING")
        failed_proc = False
        try:
            merge_case_files(db, test_case_1.id, test_user, MergeFilesRequest(file_ids=[f_valid.id, f_proc.id]))
        except ValueError as e:
            failed_proc = "not completed processing" in str(e).lower()
        record("Scenario 8: PROCESSING status rejection", failed_proc)

        # -------------------------------------------------------------
        # SCENARIO 9: File failed processing rejection
        # -------------------------------------------------------------
        f_fail = make_file(test_case_1.id, "Failed.pdf", "98765432101", date(2024, 1, 1), date(2024, 6, 30), status="FAILED")
        failed_fail = False
        try:
            merge_case_files(db, test_case_1.id, test_user, MergeFilesRequest(file_ids=[f_valid.id, f_fail.id]))
        except ValueError as e:
            failed_fail = "failed processing" in str(e).lower()
        record("Scenario 9: FAILED status rejection", failed_fail)

        # -------------------------------------------------------------
        # SCENARIO 10: Files from different cases rejection
        # -------------------------------------------------------------
        f_case2 = make_file(test_case_2.id, "Case2_File.pdf", "98765432101", date(2024, 1, 1), date(2024, 6, 30))
        failed_cross = False
        try:
            merge_case_files(db, test_case_1.id, test_user, MergeFilesRequest(file_ids=[f_valid.id, f_case2.id]))
        except ValueError as e:
            failed_cross = "does not belong to case" in str(e)
        record("Scenario 10: Cross-case files rejection", failed_cross)

        # -------------------------------------------------------------
        # SCENARIO 11: Non-existent or unauthorized file ID
        # -------------------------------------------------------------
        failed_missing = False
        try:
            merge_case_files(db, test_case_1.id, test_user, MergeFilesRequest(file_ids=[f_valid.id, 99999999]))
        except ValueError as e:
            failed_missing = "could not be found" in str(e)
        record("Scenario 11: Non-existent file ID rejection", failed_missing)

        # -------------------------------------------------------------
        # SCENARIO 12: Repeat merge request idempotency
        # -------------------------------------------------------------
        repeat_merge = merge_case_files(db, test_case_1.id, test_user, req1)
        is_idempotent = (repeat_merge.id == merged1.id)
        record("Scenario 12: Repeat request idempotency", is_idempotent, f"Existing ID: {repeat_merge.id}")

        # -------------------------------------------------------------
        # SCENARIO 13: Overlapping periods preserve legitimate transactions
        # -------------------------------------------------------------
        f_ov1 = make_file(test_case_1.id, "Overlap_H1.pdf", "55566677788", date(2024, 1, 1), date(2024, 7, 31))
        f_ov2 = make_file(test_case_1.id, "Overlap_H2.pdf", "55566677788", date(2024, 6, 1), date(2024, 12, 31))
        t_ov1 = make_tx(f_ov1, date(2024, 6, 15), 5000, 0, 45000, "Overlap Date Transaction A")
        t_ov2 = make_tx(f_ov2, date(2024, 6, 15), 7500, 0, 37500, "Overlap Date Transaction B")

        merged_ov = merge_case_files(db, test_case_1.id, test_user, MergeFilesRequest(file_ids=[f_ov1.id, f_ov2.id]))
        created_files.append(merged_ov)

        txs_ov = get_transactions_by_file(db, merged_ov.id)
        ov_ids = {tx.id for tx in txs_ov}
        has_both_overlap = (t_ov1.id in ov_ids and t_ov2.id in ov_ids)
        record("Scenario 13: Overlapping transactions preserved without loss", has_both_overlap, f"Total txs: {len(txs_ov)}")

        # -------------------------------------------------------------
        # SCENARIO 14: Deterministic ordering with identical dates (id.asc)
        # -------------------------------------------------------------
        same_date_txs = [tx for tx in txs_ov if tx.transaction_date == date(2024, 6, 15)]
        ordered_by_id = [tx.id for tx in same_date_txs] == sorted([tx.id for tx in same_date_txs])
        record("Scenario 14: Deterministic secondary sort by id ASC", ordered_by_id, f"IDs: {[tx.id for tx in same_date_txs]}")

        # -------------------------------------------------------------
        # SCENARIO 15: Original files & source transaction references intact
        # -------------------------------------------------------------
        orig_f1_txs = get_transactions_by_file(db, f1.id)
        orig_intact = len(orig_f1_txs) == 2 and all(tx.file_id == f1.id for tx in orig_f1_txs)
        record("Scenario 15: Original file transactions untouched", orig_intact, f"F1 txs: {len(orig_f1_txs)}")

        # -------------------------------------------------------------
        # SCENARIO 16: Reports generated from merged statement reflect totals
        # -------------------------------------------------------------
        summary_m1 = get_file_transaction_summary(db, merged1.id)
        expected_total_m1 = 3  # 2 from f1, 1 from f2
        expected_debit_m1 = Decimal("40000")  # 15000 + 25000
        expected_credit_m1 = Decimal("50000")  # 50000
        summary_m1_ok = (
            summary_m1["total_transactions"] == expected_total_m1 and
            summary_m1["total_debits"] == expected_debit_m1 and
            summary_m1["total_credits"] == expected_credit_m1
        )
        record("Scenario 16: Merged statement summary totals accurate", summary_m1_ok, f"Total: {summary_m1['total_transactions']}, Debits: {summary_m1['total_debits']}, Credits: {summary_m1['total_credits']}")

        # -------------------------------------------------------------
        # SCENARIO 17: Filtered search & pagination resolves merged files
        # -------------------------------------------------------------
        res_fids = resolve_source_file_ids(db, test_case_1.id, [merged1.id])
        filtered_txs, total_filtered, _ = get_filtered_transactions_by_case(
            db, test_case_1.id, page=1, page_size=10, file_ids=res_fids
        )
        search_ok = (total_filtered == 3 and len(filtered_txs) == 3)
        record("Scenario 17: Case search resolution over merged statement", search_ok, f"Total: {total_filtered}")

        # -------------------------------------------------------------
        # SCENARIO 18: Mode-wise breakdown resolves merged statement
        # -------------------------------------------------------------
        mode_data = get_mode_wise_by_case(db, test_case_1.id, file_ids=res_fids)
        mode_counts = {m["mode"]: m["transaction_count"] for m in mode_data["modes"]}
        mode_ok = (mode_counts.get("NEFT") == 2 and mode_counts.get("RTGS") == 1)
        record("Scenario 18: Mode-wise breakdown over merged statement", mode_ok, f"Modes: {mode_counts}")

        # -------------------------------------------------------------
        # SCENARIO 19: Counterparty intelligence groups under merged file
        # -------------------------------------------------------------
        cp_data = get_counterparty_analysis(db, test_case_1.id, [merged1.id])
        cp_names = [c["counterparty_name"] for c in cp_data.get("counterparties", [])]
        cp_ok = "TRIDENT DRUGS" in cp_names and "APEX LOGISTICS" in cp_names
        record("Scenario 19: Counterparty intelligence resolves merged file", cp_ok, f"Found: {cp_names}")

        # -------------------------------------------------------------
        # SCENARIO 20: Transaction relationship graph links to merged node
        # -------------------------------------------------------------
        graph_data = get_transaction_relationships(db, test_case_1.id, [merged1.id])
        nodes = graph_data.get("nodes", [])
        graph_node_ok = len(nodes) == 1 and nodes[0]["file_id"] == merged1.id and nodes[0]["matching_transaction_count"] == 3
        record("Scenario 20: Transaction graph links directly to merged node", graph_node_ok, f"Node: {nodes[0]['id'] if nodes else None}, Tx count: {nodes[0]['matching_transaction_count'] if nodes else 0}")

    finally:
        print("\nCleaning up test data...")
        # Roll back and remove test entities cleanly
        try:
            for f in created_files:
                try:
                    db.query(MergedFileSource).filter(
                        (MergedFileSource.merged_file_id == f.id) |
                        (MergedFileSource.source_file_id == f.id)
                    ).delete(synchronize_session=False)
                    db.query(BankTransaction).filter(BankTransaction.file_id == f.id).delete(synchronize_session=False)
                    db.query(File).filter(File.id == f.id).delete(synchronize_session=False)
                    if hasattr(f, "file_path") and os.path.exists(f.file_path):
                        os.remove(f.file_path)
                except Exception:
                    pass

            if test_case_1:
                db.query(Case).filter(Case.id == test_case_1.id).delete(synchronize_session=False)
            if test_case_2:
                db.query(Case).filter(Case.id == test_case_2.id).delete(synchronize_session=False)
            if test_user:
                db.query(User).filter(User.id == test_user.id).delete(synchronize_session=False)

            db.commit()
            print("Test data cleaned successfully.")
        except Exception as cleanup_err:
            print("Notice during cleanup:", cleanup_err)
            db.rollback()
        finally:
            db.close()

    print("\n" + "=" * 70)
    print("TEST SUITE SUMMARY:")
    passed_count = sum(1 for _, p, _ in results if p)
    total_count = len(results)
    print(f"Total: {total_count} | Passed: {passed_count} | Failed: {total_count - passed_count}")
    print("=" * 70)
    if passed_count == total_count:
        print("ALL 20 TEST SCENARIOS PASSED CONVINCINGLY!")
    else:
        print("SOME TESTS FAILED. PLEASE REVIEW DETAILS ABOVE.")
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
