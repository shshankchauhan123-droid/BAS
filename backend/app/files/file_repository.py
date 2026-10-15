from sqlalchemy.orm import Session

from app.files.file_model import File, MergedFileSource
from app.bank_transactions.bank_transaction_model import BankTransaction

def create_file(
    db: Session,
    file: File,
) -> File:
    db.add(file)
    db.commit()
    db.refresh(file)

    return file


def get_file_by_id(
    db: Session,
    file_id: int,
) -> File | None:
    return (
        db.query(File)
        .filter(File.id == file_id)
        .first()
    )


def get_file_by_id_and_user(
    db: Session,
    file_id: int,
    user_id: int,
) -> File | None:
    return (
        db.query(File)
        .filter(
            File.id == file_id,
            File.created_by == user_id,
        )
        .first()
    )


def get_files_by_case(
    db: Session,
    case_id: int,
    include_superseded: bool = False,
) -> list[File]:
    query = db.query(File).filter(File.case_id == case_id)
    if not include_superseded:
        query = query.filter(File.is_superseded == False)
    return (
        query
        .order_by(File.created_at.desc())
        .all()
    )


def get_files_by_case_and_user(
    db: Session,
    case_id: int,
    user_id: int,
    include_superseded: bool = False,
) -> list[File]:
    query = db.query(File).filter(
        File.case_id == case_id,
        File.created_by == user_id,
    )
    if not include_superseded:
        query = query.filter(File.is_superseded == False)
    return (
        query
        .order_by(File.created_at.desc())
        .all()
    )


def update_file(
    db: Session,
    file: File,
) -> File:
    db.commit()
    db.refresh(file)

    return file


def get_merged_file_by_sources(
    db: Session,
    case_id: int,
    source_file_ids: list[int],
) -> File | None:
    source_set = set(source_file_ids)
    merged_files = (
        db.query(File)
        .filter(File.case_id == case_id, File.is_merged == True)
        .all()
    )
    for mf in merged_files:
        sources = (
            db.query(MergedFileSource.source_file_id)
            .filter(MergedFileSource.merged_file_id == mf.id)
            .all()
        )
        if {s[0] for s in sources} == source_set:
            return mf
    return None


def get_source_files_for_merged(
    db: Session,
    merged_file_id: int,
) -> list[File]:
    return (
        db.query(File)
        .join(MergedFileSource, MergedFileSource.source_file_id == File.id)
        .filter(MergedFileSource.merged_file_id == merged_file_id)
        .order_by(File.statement_start_date.asc().nulls_last(), File.id.asc())
        .all()
    )


def get_source_file_ids_for_merged(
    db: Session,
    merged_file_id: int,
) -> list[int]:
    rows = (
        db.query(MergedFileSource.source_file_id)
        .filter(MergedFileSource.merged_file_id == merged_file_id)
        .all()
    )
    return [r[0] for r in rows]


def resolve_source_file_ids(
    db: Session,
    case_id: int,
    file_ids: list[int] | None,
) -> list[int] | None:
    if not file_ids:
        return file_ids

    resolved: list[int] = []
    seen = set()

    for fid in file_ids:
        file_obj = db.query(File).filter(File.id == fid, File.case_id == case_id).first()
        if not file_obj:
            if fid not in seen:
                seen.add(fid)
                resolved.append(fid)
            continue

        if getattr(file_obj, "is_merged", False):
            sources = get_source_file_ids_for_merged(db, fid)
            for sid in sources:
                if sid not in seen:
                    seen.add(sid)
                    resolved.append(sid)
        else:
            if fid not in seen:
                seen.add(fid)
                resolved.append(fid)

    return resolved


def get_all_cascade_source_files_for_merged(
    db: Session,
    merged_file: File,
) -> list[File]:
    """
    Recursively find all source files for a merged file within the same case.
    Includes cycle detection and validation of case_id to prevent cross-case data loss.
    """
    if not getattr(merged_file, "is_merged", False):
        return []

    visited_ids = {merged_file.id}
    queue = [merged_file.id]
    cascade_files: list[File] = []

    while queue:
        current_id = queue.pop(0)

        # 1. Direct sources recorded in MergedFileSource
        mfs_ids = [
            row[0]
            for row in db.query(MergedFileSource.source_file_id)
            .filter(MergedFileSource.merged_file_id == current_id)
            .all()
        ]

        # 2. Direct sources linked via superseded_by_file_id
        superseded_ids = [
            row[0]
            for row in db.query(File.id)
            .filter(File.superseded_by_file_id == current_id)
            .all()
        ]

        direct_source_ids = list(dict.fromkeys(mfs_ids + superseded_ids))

        for sid in direct_source_ids:
            if sid in visited_ids:
                continue

            visited_ids.add(sid)

            src_file = db.query(File).filter(File.id == sid).first()
            if not src_file:
                continue

            # Validate case ownership to prevent cross-case data loss
            if src_file.case_id != merged_file.case_id:
                raise ValueError(
                    f"Security/Integrity violation: Source file {src_file.id} belongs to Case {src_file.case_id}, "
                    f"not the target Case {merged_file.case_id}."
                )

            cascade_files.append(src_file)

            # If this source file itself was merged or has sources, traverse recursively
            is_sub_merged = getattr(src_file, "is_merged", False) or bool(
                db.query(MergedFileSource.id)
                .filter(MergedFileSource.merged_file_id == sid)
                .first()
            )
            if is_sub_merged:
                queue.append(sid)

    return cascade_files


def delete_file(
    db: Session,
    file: File,
    cascade_files: list[File] | None = None,
) -> list[int]:
    """
    Deletes a file and optionally its cascaded source files from the database within
    a single transaction.
    Cleans up foreign keys, merged_file_sources, bank_transactions, and files records.
    """
    all_files = [file]
    if cascade_files:
        all_files.extend(cascade_files)

    all_file_ids = [f.id for f in all_files]

    # 1. Clear any superseded_by_file_id foreign keys referencing these files
    db.query(File).filter(
        File.superseded_by_file_id.in_(all_file_ids)
    ).update({File.superseded_by_file_id: None}, synchronize_session=False)

    # 2. Clean up junction table records for all deleted files
    db.query(MergedFileSource).filter(
        (MergedFileSource.merged_file_id.in_(all_file_ids)) |
        (MergedFileSource.source_file_id.in_(all_file_ids))
    ).delete(synchronize_session=False)

    # 3. Delete all transactions belonging to any of these files
    db.query(BankTransaction).filter(
        BankTransaction.file_id.in_(all_file_ids)
    ).delete(synchronize_session=False)

    # 4. Delete the files from the files table
    db.query(File).filter(
        File.id.in_(all_file_ids)
    ).delete(synchronize_session=False)

    # 5. Commit all database changes in a single transaction
    db.commit()

    return all_file_ids