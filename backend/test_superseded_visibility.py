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
from app.files.file_service import normalize_account_number, merge_case_files, get_case_files, delete_uploaded_file
from app.files.file_repository import (
    resolve_source_file_ids,
    get_files_by_case,
    delete_file,
)
from app.bank_transactions.bank_transaction_repository import (
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
    print("STARTING SUPERSEDED MERGE VISIBILITY TEST SUITE")
    print("=" * 70)

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
            email=f"investigator_{test_run_id}@bas.test",
            password_hash="test_secret_hash",
            role="superadmin",
            is_active=True,
            first_login=False,
        )
        db.add(test_user)
        db.commit()
        db.refresh(test_user)

        # Create two test cases
        test_case_1 = Case(
            case_number=f"CASE-VIS-1-{test_run_id}",
            case_name="Primary Case",
            description="Case for superseded visibility testing",
            status="active",
            created_by=test_user.id,
        )
        test_case_2 = Case(
            case_number=f"CASE-VIS-2-{test_run_id}",
            case_name="Secondary Case",
            description="Case for cross-case isolation testing",
            status="active",
            created_by=test_user.id,
        )
        db.add(test_case_1)
        db.add(test_case_2)
        db.commit()
        db.refresh(test_case_1)
        db.refresh(test_case_2)

        # Helper to create file
        def make_file(case_id, filename, acc_num, start_d, end_d, status="COMPLETED", is_merged=False):
            dummy_path = os.path.join(BASE_DIR, f"dummy_{uuid.uuid4().hex[:6]}.pdf")
            with open(dummy_path, "wb") as f:
                f.write(b"%PDF-1.4 dummy content\n%%EOF")
            file_obj = File(
                case_id=case_id,
                created_by=test_user.id,
                original_filename=filename,
                stored_filename=os.path.basename(dummy_path),
                file_path=dummy_path,
                mime_type="application/pdf",
                file_size=1024,
                status=status,
                account_name="Vis Test Corp",
                account_number=acc_num,
                bank_name="Test Bank",
                statement_start_date=start_d,
                statement_end_date=end_d,
                is_merged=is_merged,
                is_superseded=False,
                superseded_by_file_id=None,
            )
            db.add(file_obj)
            db.commit()
            db.refresh(file_obj)
            created_files.append(file_obj)
            return file_obj

        # Helper to create transaction
        def make_tx(case_id, file_id, tx_date, debit, credit, desc, cp):
            tx = BankTransaction(
                case_id=case_id,
                file_id=file_id,
                transaction_date=tx_date,
                debit=Decimal(str(debit)) if debit else None,
                credit=Decimal(str(credit)) if credit else None,
                balance=Decimal("10000.00"),
                description=desc,
                counterparty_name=cp,
                mode="UPI" if "UPI" in desc else "NEFT",
            )
            db.add(tx)
            db.commit()
            db.refresh(tx)
            created_transactions.append(tx)
            return tx

        # -------------------------------------------------------------
        # Criteria 1: Before merging, two source files appear in active list
        # -------------------------------------------------------------
        f1 = make_file(test_case_1.id, "statement_2024.pdf", "9988776655", date(2024, 1, 1), date(2024, 6, 30))
        f2 = make_file(test_case_1.id, "statement_2025.pdf", "9988776655", date(2024, 7, 1), date(2024, 12, 31))
        f_unrelated = make_file(test_case_1.id, "other_account.pdf", "1122334455", date(2024, 1, 1), date(2024, 12, 31))
        f_case2 = make_file(test_case_2.id, "case2_stmt.pdf", "9988776655", date(2024, 1, 1), date(2024, 12, 31))

        # Add transactions
        make_tx(test_case_1.id, f1.id, date(2024, 2, 10), 1000.00, None, "UPI/VendorA", "Vendor A")
        make_tx(test_case_1.id, f1.id, date(2024, 4, 15), None, 5000.00, "NEFT/ClientX", "Client X")
        make_tx(test_case_1.id, f2.id, date(2024, 8, 20), 2000.00, None, "UPI/VendorB", "Vendor B")
        make_tx(test_case_1.id, f2.id, date(2024, 10, 5), None, 7000.00, "NEFT/ClientY", "Client Y")
        make_tx(test_case_1.id, f_unrelated.id, date(2024, 5, 1), 500.00, None, "UPI/VendorC", "Vendor C")
        make_tx(test_case_2.id, f_case2.id, date(2024, 6, 1), 300.00, None, "UPI/Case2Vendor", "Case2 Vendor")

        active_before = get_case_files(db=db, case_id=test_case_1.id, user=test_user, include_superseded=False)
        active_ids_before = {f.id for f in active_before}
        record(
            "Criteria 1: Before merging, source files appear in active list",
            f1.id in active_ids_before and f2.id in active_ids_before and len(active_before) == 3,
            f"Active count: {len(active_before)}"
        )

        # -------------------------------------------------------------
        # Criteria 2 & 3: After merge, only merged file + unrelated file appear; total reflects active count
        # -------------------------------------------------------------
        req = MergeFilesRequest(file_ids=[f1.id, f2.id], merged_filename="merged_2024_full.pdf")
        merged = merge_case_files(db=db, case_id=test_case_1.id, user=test_user, data=req)
        created_files.append(merged)

        active_after = get_case_files(db=db, case_id=test_case_1.id, user=test_user, include_superseded=False)
        active_ids_after = [f.id for f in active_after]
        record(
            "Criteria 2: After merging, only merged file replaces source files in active list",
            merged.id in active_ids_after and f1.id not in active_ids_after and f2.id not in active_ids_after,
            f"Active IDs: {active_ids_after}"
        )
        record(
            "Criteria 3: Total active files count reflects only active documents (2: merged + unrelated)",
            len(active_after) == 2,
            f"Count: {len(active_after)}"
        )

        # -------------------------------------------------------------
        # Criteria 4: Original source files are retained for audit and marked superseded
        # -------------------------------------------------------------
        db.refresh(f1)
        db.refresh(f2)
        all_including_superseded = get_case_files(db=db, case_id=test_case_1.id, user=test_user, include_superseded=True)
        record(
            "Criteria 4: Original source files are retained in DB with is_superseded=True and superseded_by_file_id",
            f1.is_superseded == True and f1.superseded_by_file_id == merged.id and
            f2.is_superseded == True and f2.superseded_by_file_id == merged.id and
            len(all_including_superseded) == 4,
            f"Total all files: {len(all_including_superseded)}"
        )

        # -------------------------------------------------------------
        # Criteria 5 & 6: Active report selection / Select All excludes superseded files
        # -------------------------------------------------------------
        # When user clicks "Select All" in any report, it selects active files (merged + unrelated)
        selected_all_ids = [f.id for f in active_after]
        record(
            "Criteria 5 & 6: Report active file list and Select All excludes superseded files",
            f1.id not in selected_all_ids and f2.id not in selected_all_ids and merged.id in selected_all_ids,
            f"Selected IDs: {selected_all_ids}"
        )

        # -------------------------------------------------------------
        # Criteria 7: Reports do not double-count transactions from merged and original files
        # -------------------------------------------------------------
        # Merged file query resolves to f1 and f2: 4 transactions (2 debits = 3000, 2 credits = 12000)
        res_summary = get_file_transaction_summary(db=db, file_id=merged.id)
        record(
            "Criteria 7a: Merged file summary reflects exact combined totals without duplicates",
            res_summary["total_transactions"] == 4 and
            float(res_summary["total_debits"]) == 3000.0 and
            float(res_summary["total_credits"]) == 12000.0,
            f"Tx count: {res_summary['total_transactions']}, Dr: {res_summary['total_debits']}, Cr: {res_summary['total_credits']}"
        )

        # Case level summary (file_ids=None): all case transactions (f1 + f2 + f_unrelated = 4 + 1 = 5 transactions)
        case_summary = get_case_transaction_summary(db=db, case_id=test_case_1.id)
        record(
            "Criteria 7b: Case summary (all files) counts each transaction exactly once",
            case_summary["total_transactions"] == 5 and
            float(case_summary["total_debits"]) == 3500.0 and
            float(case_summary["total_credits"]) == 12000.0,
            f"Case total txs: {case_summary['total_transactions']}"
        )

        # When Select All active files is sent: file_ids=[merged.id, f_unrelated.id]
        resolved_all = resolve_source_file_ids(db=db, case_id=test_case_1.id, file_ids=selected_all_ids)
        txs_all, total_all, _ = get_filtered_transactions_by_case(
            db=db,
            case_id=test_case_1.id,
            page=1,
            page_size=50,
            file_ids=resolved_all
        )
        record(
            "Criteria 7c: Filtered search on all active files returns 5 transactions without double-counting",
            total_all == 5,
            f"Total transactions: {total_all}"
        )

        # -------------------------------------------------------------
        # Criteria 8: Unrelated file in same case remains visible and selectable
        # -------------------------------------------------------------
        record(
            "Criteria 8: Unrelated file in the same case remains active and visible",
            f_unrelated.id in active_ids_after and f_unrelated.is_superseded == False,
            f"Unrelated file ID: {f_unrelated.id}"
        )

        # -------------------------------------------------------------
        # Criteria 9: Files belonging to other cases remain unaffected
        # -------------------------------------------------------------
        db.refresh(f_case2)
        active_case2 = get_case_files(db=db, case_id=test_case_2.id, user=test_user, include_superseded=False)
        record(
            "Criteria 9: Files in other cases are completely unaffected",
            f_case2.is_superseded == False and len(active_case2) == 1 and active_case2[0].id == f_case2.id,
            f"Case 2 active count: {len(active_case2)}"
        )

        # -------------------------------------------------------------
        # Criteria 10: Failed merge does not hide or deactivate source files
        # -------------------------------------------------------------
        # Attempt an invalid merge (e.g. less than 2 files)
        try:
            invalid_req = MergeFilesRequest(file_ids=[f_unrelated.id])
            merge_case_files(db=db, case_id=test_case_1.id, user=test_user, data=invalid_req)
            record("Criteria 10: Failed merge leaves source files unaffected", False, "Should have raised ValueError")
        except ValueError:
            db.refresh(f_unrelated)
            record(
                "Criteria 10: Failed merge leaves source files active and un-superseded",
                f_unrelated.is_superseded == False,
                "f_unrelated remained active"
            )

        # -------------------------------------------------------------
        # Criteria 11: Attempting to re-merge a superseded file is strictly rejected
        # -------------------------------------------------------------
        try:
            re_merge_req = MergeFilesRequest(file_ids=[f1.id, f_unrelated.id])
            merge_case_files(db=db, case_id=test_case_1.id, user=test_user, data=re_merge_req)
            record("Criteria 11: Re-merging superseded file is rejected", False, "Should have raised ValueError")
        except ValueError as e:
            record(
                "Criteria 11: Re-merging superseded file is strictly rejected",
                "already been merged" in str(e).lower(),
                str(e)
            )

        # -------------------------------------------------------------
        # Criteria 12: Existing direct file viewing and transaction viewing on source files continue to work
        # -------------------------------------------------------------
        txs_f1, total_f1 = get_transactions_by_file_paginated(db=db, file_id=f1.id, page=1, page_size=10)
        record(
            "Criteria 12: Direct transaction viewing on original superseded source file continues to work",
            total_f1 == 2,
            f"Direct transactions for f1: {total_f1}"
        )

        # -------------------------------------------------------------
        # Criteria 13: Deleting a merged file cascades deletion of its source files
        # -------------------------------------------------------------
        f1_id = f1.id
        f2_id = f2.id
        merged_id = merged.id
        created_files = [f for f in created_files if f not in (merged, f1, f2)]
        delete_uploaded_file(db=db, file_id=merged_id, user=test_user)

        remaining_active = get_case_files(db=db, case_id=test_case_1.id, user=test_user, include_superseded=False)
        remaining_active_ids = {f.id for f in remaining_active}

        record(
            "Criteria 13: Deleting merged file cascades to delete source files from active and database",
            db.query(File).filter(File.id.in_([merged_id, f1_id, f2_id])).count() == 0 and
            f1_id not in remaining_active_ids and f2_id not in remaining_active_ids and len(remaining_active) == 1,
            f"Remaining active count: {len(remaining_active)}"
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        record("EXCEPTION ENCOUNTERED", False, str(e))

    finally:
        # Cleanup test entities
        print("\nCleaning up test entities...")
        for tx in created_transactions:
            try:
                db.delete(tx)
                db.commit()
            except Exception:
                db.rollback()

        for f in created_files:
            try:
                # Remove physical file if dummy
                if f.file_path and os.path.exists(f.file_path):
                    try:
                        os.unlink(f.file_path)
                    except Exception:
                        pass
                delete_file(db=db, file=f)
            except Exception:
                db.rollback()

        if test_case_1:
            try:
                db.delete(test_case_1)
                db.commit()
            except Exception:
                db.rollback()

        if test_case_2:
            try:
                db.delete(test_case_2)
                db.commit()
            except Exception:
                db.rollback()

        if test_user:
            try:
                db.delete(test_user)
                db.commit()
            except Exception:
                db.rollback()

        db.close()
        print("Test data cleaned successfully.\n")

    print("=" * 70)
    print("TEST SUITE SUMMARY:")
    passed_count = sum(1 for _, p, _ in results if p)
    failed_count = sum(1 for _, p, _ in results if not p)
    print(f"Total: {len(results)} | Passed: {passed_count} | Failed: {failed_count}")
    print("=" * 70)

    if failed_count == 0 and len(results) > 0:
        print("ALL ACCEPTANCE CRITERIA VERIFIED AND PASSED!")
    else:
        print("SOME TESTS FAILED! CHECK OUTPUT ABOVE.")
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
