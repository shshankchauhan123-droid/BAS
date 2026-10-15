import sys
import os
import uuid
from pathlib import Path
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
from app.files.file_service import (
    delete_uploaded_file,
    get_case_files,
)
from app.files.file_repository import (
    get_all_cascade_source_files_for_merged,
    get_files_by_case,
    delete_file,
)

def run_tests():
    db = SessionLocal()
    results = []

    def record(name: str, passed: bool, detail: str = ""):
        results.append((name, passed, detail))
        status_str = "PASS" if passed else "FAIL"
        print(f"[{status_str}] {name} {f'({detail})' if detail else ''}")

    print("=" * 70)
    print("STARTING CASCADE FILE DELETION TEST SUITE")
    print("=" * 70)

    test_run_id = uuid.uuid4().hex[:8]
    test_user = None
    test_case_1 = None
    test_case_2 = None
    created_disk_files = []

    def create_dummy_disk_file(name: str) -> str:
        temp_dir = Path(BASE_DIR) / "storage" / "temp_tests"
        temp_dir.mkdir(parents=True, exist_ok=True)
        file_path = temp_dir / f"{test_run_id}_{name}"
        file_path.write_text(f"dummy content for {name}")
        created_disk_files.append(file_path)
        return str(file_path)

    try:
        # Create test superadmin user
        test_user = User(
            username=f"test_cascade_user_{test_run_id}",
            email=f"cascade_{test_run_id}@bas.test",
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
            case_number=f"CASE-CAS-1-{test_run_id}",
            case_name="Primary Cascade Case",
            description="Case for cascade deletion testing",
            status="active",
            created_by=test_user.id,
        )
        test_case_2 = Case(
            case_number=f"CASE-CAS-2-{test_run_id}",
            case_name="Cross Case Isolation Case",
            description="Case for cross-case boundary testing",
            status="active",
            created_by=test_user.id,
        )
        db.add_all([test_case_1, test_case_2])
        db.commit()
        db.refresh(test_case_1)
        db.refresh(test_case_2)

        # ================================================================
        # TEST 1: Deleting a normal (unmerged) file
        # ================================================================
        f1_disk = create_dummy_disk_file("normal1.pdf")
        f2_disk = create_dummy_disk_file("normal2.pdf")

        f1 = File(
            case_id=test_case_1.id,
            created_by=test_user.id,
            original_filename="normal1.pdf",
            stored_filename=f"{test_run_id}_normal1.pdf",
            file_path=f1_disk,
            file_size=1024,
            status="COMPLETED",
            account_number="ACC-1001",
            is_merged=False,
            is_superseded=False,
        )
        f2 = File(
            case_id=test_case_1.id,
            created_by=test_user.id,
            original_filename="normal2.pdf",
            stored_filename=f"{test_run_id}_normal2.pdf",
            file_path=f2_disk,
            file_size=2048,
            status="COMPLETED",
            account_number="ACC-1002",
            is_merged=False,
            is_superseded=False,
        )
        db.add_all([f1, f2])
        db.commit()
        db.refresh(f1)
        db.refresh(f2)

        # Add transaction for f1 and f2
        tx1 = BankTransaction(
            file_id=f1.id,
            case_id=test_case_1.id,
            account_number="ACC-1001",
            transaction_date=date(2025, 1, 15),
            credit=Decimal("1500.00"),
        )
        tx2 = BankTransaction(
            file_id=f2.id,
            case_id=test_case_1.id,
            account_number="ACC-1002",
            transaction_date=date(2025, 1, 20),
            debit=Decimal("2500.00"),
        )
        db.add_all([tx1, tx2])
        db.commit()

        # Delete normal file f1
        f1_id = f1.id
        f2_id = f2.id
        del_result_1 = delete_uploaded_file(db=db, file_id=f1_id, user=test_user)

        record(
            "Normal file delete response structure",
            del_result_1.get("file_id") == f1_id
            and del_result_1.get("deleted_file_ids") == [f1_id]
            and del_result_1.get("is_merged") is False,
            f"Returned {del_result_1}",
        )

        record(
            "Normal file removed from files table",
            db.query(File).filter(File.id == f1_id).first() is None,
        )

        record(
            "Normal file transactions removed",
            db.query(BankTransaction).filter(BankTransaction.file_id == f1_id).first() is None,
        )

        record(
            "Normal file physical disk file removed",
            not Path(f1_disk).exists(),
        )

        record(
            "Unrelated file f2 remains completely intact",
            db.query(File).filter(File.id == f2_id).first() is not None
            and db.query(BankTransaction).filter(BankTransaction.file_id == f2_id).first() is not None
            and Path(f2_disk).exists(),
        )

        # ================================================================
        # TEST 2: Deleting a merged file with 2 source files (File A + B -> M)
        # ================================================================
        fa_disk = create_dummy_disk_file("src_a.pdf")
        fb_disk = create_dummy_disk_file("src_b.pdf")
        fm_disk = create_dummy_disk_file("merged_m.pdf")

        file_a = File(
            case_id=test_case_1.id,
            created_by=test_user.id,
            original_filename="statement_a.pdf",
            stored_filename=f"{test_run_id}_a.pdf",
            file_path=fa_disk,
            file_size=1024,
            status="COMPLETED",
            account_number="ACC-2000",
            is_merged=False,
            is_superseded=True,
        )
        file_b = File(
            case_id=test_case_1.id,
            created_by=test_user.id,
            original_filename="statement_b.pdf",
            stored_filename=f"{test_run_id}_b.pdf",
            file_path=fb_disk,
            file_size=1024,
            status="COMPLETED",
            account_number="ACC-2000",
            is_merged=False,
            is_superseded=True,
        )
        db.add_all([file_a, file_b])
        db.commit()
        db.refresh(file_a)
        db.refresh(file_b)

        file_m = File(
            case_id=test_case_1.id,
            created_by=test_user.id,
            original_filename="merged_statement_ab.pdf",
            stored_filename=f"{test_run_id}_m.pdf",
            file_path=fm_disk,
            file_size=2048,
            status="COMPLETED",
            account_number="ACC-2000",
            is_merged=True,
            is_superseded=False,
        )
        db.add(file_m)
        db.commit()
        db.refresh(file_m)

        # Link sources via superseded_by_file_id and MergedFileSource
        file_a.superseded_by_file_id = file_m.id
        file_b.superseded_by_file_id = file_m.id
        mfs_a = MergedFileSource(merged_file_id=file_m.id, source_file_id=file_a.id)
        mfs_b = MergedFileSource(merged_file_id=file_m.id, source_file_id=file_b.id)
        db.add_all([mfs_a, mfs_b])
        db.commit()

        # Add transactions for file_a, file_b, and file_m
        tx_a = BankTransaction(
            file_id=file_a.id,
            case_id=test_case_1.id,
            account_number="ACC-2000",
            transaction_date=date(2025, 2, 1),
            credit=Decimal("100.00"),
        )
        tx_b = BankTransaction(
            file_id=file_b.id,
            case_id=test_case_1.id,
            account_number="ACC-2000",
            transaction_date=date(2025, 2, 2),
            debit=Decimal("200.00"),
        )
        db.add_all([tx_a, tx_b])
        db.commit()

        # Verify cascade sources resolution
        cascade_sources = get_all_cascade_source_files_for_merged(db=db, merged_file=file_m)
        cascade_source_ids = {s.id for s in cascade_sources}
        record(
            "Cascade source discovery finds all underlying files",
            cascade_source_ids == {file_a.id, file_b.id},
            f"Found IDs: {cascade_source_ids}",
        )

        fa_id = file_a.id
        fb_id = file_b.id
        fm_id = file_m.id
        expected_deleted_ids = {fm_id, fa_id, fb_id}

        # Perform deletion of merged file file_m
        del_result_2 = delete_uploaded_file(db=db, file_id=fm_id, user=test_user)

        actual_deleted_ids = set(del_result_2.get("deleted_file_ids", []))
        record(
            "Merged file delete response contains all cascaded IDs",
            del_result_2.get("file_id") == fm_id
            and del_result_2.get("is_merged") is True
            and actual_deleted_ids == expected_deleted_ids,
            f"Returned {del_result_2}",
        )

        record(
            "Merged file and source files deleted from files table",
            db.query(File).filter(File.id.in_(list(expected_deleted_ids))).count() == 0,
        )

        record(
            "Merged junction records completely cleaned up",
            db.query(MergedFileSource).filter(
                (MergedFileSource.merged_file_id.in_(list(expected_deleted_ids)))
                | (MergedFileSource.source_file_id.in_(list(expected_deleted_ids)))
            ).count() == 0,
        )

        record(
            "Transactions for source files and merged file deleted",
            db.query(BankTransaction).filter(
                BankTransaction.file_id.in_(list(expected_deleted_ids))
            ).count() == 0,
        )

        record(
            "Physical disk files for merged file and both sources unlinked",
            not Path(fm_disk).exists()
            and not Path(fa_disk).exists()
            and not Path(fb_disk).exists(),
        )

        # ================================================================
        # TEST 3: Nested merged file cascade deletion
        # (File X + File Y -> M1, then M1 + File Z -> M2)
        # ================================================================
        fx_disk = create_dummy_disk_file("src_x.pdf")
        fy_disk = create_dummy_disk_file("src_y.pdf")
        fm1_disk = create_dummy_disk_file("merged_m1.pdf")
        fz_disk = create_dummy_disk_file("src_z.pdf")
        fm2_disk = create_dummy_disk_file("merged_m2.pdf")

        file_x = File(
            case_id=test_case_1.id,
            created_by=test_user.id,
            original_filename="stmt_x.pdf",
            stored_filename=f"{test_run_id}_x.pdf",
            file_path=fx_disk,
            file_size=1024,
            status="COMPLETED",
            account_number="ACC-3000",
            is_merged=False,
            is_superseded=True,
        )
        file_y = File(
            case_id=test_case_1.id,
            created_by=test_user.id,
            original_filename="stmt_y.pdf",
            stored_filename=f"{test_run_id}_y.pdf",
            file_path=fy_disk,
            file_size=1024,
            status="COMPLETED",
            account_number="ACC-3000",
            is_merged=False,
            is_superseded=True,
        )
        db.add_all([file_x, file_y])
        db.commit()
        db.refresh(file_x)
        db.refresh(file_y)

        file_m1 = File(
            case_id=test_case_1.id,
            created_by=test_user.id,
            original_filename="merged_m1.pdf",
            stored_filename=f"{test_run_id}_m1.pdf",
            file_path=fm1_disk,
            file_size=2048,
            status="COMPLETED",
            account_number="ACC-3000",
            is_merged=True,
            is_superseded=True,
        )
        db.add(file_m1)
        db.commit()
        db.refresh(file_m1)

        file_x.superseded_by_file_id = file_m1.id
        file_y.superseded_by_file_id = file_m1.id
        mfs_x = MergedFileSource(merged_file_id=file_m1.id, source_file_id=file_x.id)
        mfs_y = MergedFileSource(merged_file_id=file_m1.id, source_file_id=file_y.id)
        db.add_all([mfs_x, mfs_y])
        db.commit()

        # Third file Z
        file_z = File(
            case_id=test_case_1.id,
            created_by=test_user.id,
            original_filename="stmt_z.pdf",
            stored_filename=f"{test_run_id}_z.pdf",
            file_path=fz_disk,
            file_size=1024,
            status="COMPLETED",
            account_number="ACC-3000",
            is_merged=False,
            is_superseded=True,
        )
        db.add(file_z)
        db.commit()
        db.refresh(file_z)

        # Merged M2 (combining M1 and Z)
        file_m2 = File(
            case_id=test_case_1.id,
            created_by=test_user.id,
            original_filename="merged_m2_all.pdf",
            stored_filename=f"{test_run_id}_m2.pdf",
            file_path=fm2_disk,
            file_size=4096,
            status="COMPLETED",
            account_number="ACC-3000",
            is_merged=True,
            is_superseded=False,
        )
        db.add(file_m2)
        db.commit()
        db.refresh(file_m2)

        file_m1.superseded_by_file_id = file_m2.id
        file_z.superseded_by_file_id = file_m2.id
        mfs_m1 = MergedFileSource(merged_file_id=file_m2.id, source_file_id=file_m1.id)
        mfs_z = MergedFileSource(merged_file_id=file_m2.id, source_file_id=file_z.id)
        db.add_all([mfs_m1, mfs_z])
        db.commit()

        # Add transactions for each
        for f_sub, amt in [(file_x, "10"), (file_y, "20"), (file_z, "30")]:
            tx_sub = BankTransaction(
                file_id=f_sub.id,
                case_id=test_case_1.id,
                account_number="ACC-3000",
                transaction_date=date(2025, 3, 1),
                credit=Decimal(amt),
            )
            db.add(tx_sub)
        db.commit()

        fx_id = file_x.id
        fy_id = file_y.id
        fm1_id = file_m1.id
        fz_id = file_z.id
        fm2_id = file_m2.id
        all_nested_ids = {fm2_id, fm1_id, fz_id, fx_id, fy_id}
        expected_nested_source_ids = {fm1_id, fz_id, fx_id, fy_id}

        # Verify recursive discovery
        nested_sources = get_all_cascade_source_files_for_merged(db=db, merged_file=file_m2)
        nested_ids = {s.id for s in nested_sources}
        record(
            "Recursive cascade discovery finds all nested levels (M1, Z, X, Y)",
            nested_ids == expected_nested_source_ids,
            f"Found IDs: {nested_ids}, Expected: {expected_nested_source_ids}",
        )

        # Delete top-level merged file M2
        del_result_3 = delete_uploaded_file(db=db, file_id=fm2_id, user=test_user)

        record(
            "Nested merge deletion returns all 5 file IDs",
            set(del_result_3.get("deleted_file_ids", [])) == all_nested_ids,
            f"Returned: {del_result_3.get('deleted_file_ids')}",
        )

        record(
            "All 5 nested files removed from database",
            db.query(File).filter(File.id.in_(list(all_nested_ids))).count() == 0,
        )

        record(
            "All transactions for all 5 nested files removed",
            db.query(BankTransaction).filter(
                BankTransaction.file_id.in_(list(all_nested_ids))
            ).count() == 0,
        )

        record(
            "All 5 physical files on disk removed",
            not Path(fm2_disk).exists()
            and not Path(fm1_disk).exists()
            and not Path(fz_disk).exists()
            and not Path(fx_disk).exists()
            and not Path(fy_disk).exists(),
        )

        # ================================================================
        # TEST 4: Case boundary and isolation verification
        # ================================================================
        f_cross_disk = create_dummy_disk_file("cross_case.pdf")
        f_cross = File(
            case_id=test_case_2.id, # Belongs to Case 2!
            created_by=test_user.id,
            original_filename="cross_case.pdf",
            stored_filename=f"{test_run_id}_cross.pdf",
            file_path=f_cross_disk,
            file_size=1024,
            status="COMPLETED",
            account_number="ACC-9999",
            is_merged=False,
            is_superseded=False,
        )
        db.add(f_cross)
        db.commit()
        db.refresh(f_cross)

        # Dummy merged file in Case 1 that fraudulently references Case 2's file
        f_rogue = File(
            case_id=test_case_1.id,
            created_by=test_user.id,
            original_filename="rogue_merge.pdf",
            stored_filename=f"{test_run_id}_rogue.pdf",
            file_path="",
            file_size=500,
            status="COMPLETED",
            account_number="ACC-9999",
            is_merged=True,
            is_superseded=False,
        )
        db.add(f_rogue)
        db.commit()
        db.refresh(f_rogue)

        mfs_rogue = MergedFileSource(merged_file_id=f_rogue.id, source_file_id=f_cross.id)
        db.add(mfs_rogue)
        db.commit()

        # Attempting cascade discovery should raise ValueError due to cross-case integrity check
        boundary_violation_caught = False
        try:
            get_all_cascade_source_files_for_merged(db=db, merged_file=f_rogue)
        except ValueError as err:
            boundary_violation_caught = True
            print(f"Caught expected boundary violation: {err}")

        record(
            "Cross-case boundary integrity protects foreign case files from deletion",
            boundary_violation_caught,
        )

        # Clean up rogue test entities
        db.query(MergedFileSource).filter(MergedFileSource.merged_file_id == f_rogue.id).delete()
        db.query(File).filter(File.id.in_([f_rogue.id, f_cross.id])).delete()
        db.commit()

        # ================================================================
        # TEST 5: Missing physical file tolerance
        # ================================================================
        ghost_disk_path = str(Path(BASE_DIR) / "storage" / "temp_tests" / f"{test_run_id}_ghost.pdf")
        if Path(ghost_disk_path).exists():
            Path(ghost_disk_path).unlink()

        f_ghost = File(
            case_id=test_case_1.id,
            created_by=test_user.id,
            original_filename="ghost.pdf",
            stored_filename=f"{test_run_id}_ghost.pdf",
            file_path=ghost_disk_path,
            file_size=500,
            status="COMPLETED",
            is_merged=False,
            is_superseded=False,
        )
        db.add(f_ghost)
        db.commit()
        db.refresh(f_ghost)

        ghost_id = f_ghost.id
        del_ghost_res = delete_uploaded_file(db=db, file_id=ghost_id, user=test_user)
        record(
            "Missing physical file does not prevent successful database deletion",
            del_ghost_res.get("file_id") == ghost_id
            and db.query(File).filter(File.id == ghost_id).first() is None,
        )

        # ================================================================
        # TEST 6: Active document list reflection
        # ================================================================
        active_files = get_files_by_case(db=db, case_id=test_case_1.id, include_superseded=False)
        active_ids = {f.id for f in active_files}
        record(
            "Active case file list reflects only remaining active file f2",
            active_ids == {f2_id},
            f"Active IDs: {active_ids}, expected {f2_id}",
        )

    finally:
        # Cleanup remaining test files
        try:
            for p in created_disk_files:
                if Path(p).exists():
                    Path(p).unlink()
        except Exception:
            pass

        # Cleanup test entities
        try:
            if test_case_1:
                db.query(BankTransaction).filter(BankTransaction.case_id == test_case_1.id).delete()
                db.query(MergedFileSource).filter(
                    MergedFileSource.merged_file_id.in_(
                        db.query(File.id).filter(File.case_id == test_case_1.id)
                    )
                ).delete(synchronize_session=False)
                db.query(File).filter(File.case_id == test_case_1.id).delete()
                db.query(Case).filter(Case.id == test_case_1.id).delete()

            if test_case_2:
                db.query(BankTransaction).filter(BankTransaction.case_id == test_case_2.id).delete()
                db.query(File).filter(File.case_id == test_case_2.id).delete()
                db.query(Case).filter(Case.id == test_case_2.id).delete()

            if test_user:
                db.query(User).filter(User.id == test_user.id).delete()

            db.commit()
        except Exception as e:
            print("Cleanup warning:", e)
            db.rollback()
        finally:
            db.close()

    print("=" * 70)
    passed_count = sum(1 for _, p, _ in results if p)
    total_count = len(results)
    print(f"CASCADE DELETION TESTS: {passed_count}/{total_count} PASSED")
    print("=" * 70)

    if passed_count != total_count:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
