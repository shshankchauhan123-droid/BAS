from datetime import date, datetime
from typing import Any
from sqlalchemy.orm import Session

from app.files.file_model import File, MergedFileSource
from app.bank_transactions.bank_transaction_model import BankTransaction


def _normalize_to_date(val: Any) -> date | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        v = val.strip()
        if not v:
            return None
        try:
            return date.fromisoformat(v[:10])
        except Exception:
            pass
        for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(v, fmt).date()
            except Exception:
                pass
    return None


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
    document_type: str | None = None,
) -> list[File]:
    query = db.query(File).filter(File.case_id == case_id)
    if not include_superseded:
        query = query.filter(File.is_superseded == False)
    if document_type and hasattr(File, "document_type"):
        query = query.filter(File.document_type == document_type)
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
    document_type: str | None = None,
) -> list[File]:
    query = db.query(File).filter(
        File.case_id == case_id,
        File.created_by == user_id,
    )
    if not include_superseded:
        query = query.filter(File.is_superseded == False)
    if document_type and hasattr(File, "document_type"):
        query = query.filter(File.document_type == document_type)
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


def get_leaf_source_files_for_merged(
    db: Session,
    merged_file_id: int,
) -> list[File]:
    """
    Recursively find all base/original (non-merged) source files for a merged file.
    Includes cycle detection and chronological sorting.
    """
    visited_ids = {merged_file_id}
    queue = [merged_file_id]
    leaf_files: list[File] = []
    seen_leaf_ids = set()

    while queue:
        curr_id = queue.pop(0)
        source_ids = [
            row[0]
            for row in db.query(MergedFileSource.source_file_id)
            .filter(MergedFileSource.merged_file_id == curr_id)
            .all()
        ]
        if not source_ids:
            source_ids = [
                row[0]
                for row in db.query(File.id)
                .filter(File.superseded_by_file_id == curr_id)
                .all()
            ]

        for sid in source_ids:
            if sid in visited_ids:
                continue
            visited_ids.add(sid)
            s_file = db.query(File).filter(File.id == sid).first()
            if not s_file:
                continue
            if getattr(s_file, "is_merged", False):
                queue.append(sid)
            else:
                if s_file.id not in seen_leaf_ids:
                    seen_leaf_ids.add(s_file.id)
                    leaf_files.append(s_file)

    leaf_files.sort(key=lambda x: (_normalize_to_date(x.statement_start_date) or date.min, x.id))
    return leaf_files


def get_leaf_source_file_ids_for_merged(
    db: Session,
    merged_file_id: int,
) -> list[int]:
    files = get_leaf_source_files_for_merged(db, merged_file_id)
    return [f.id for f in files]


def get_merged_file_by_sources(
    db: Session,
    case_id: int,
    source_file_ids: list[int],
) -> File | None:
    source_set = set(source_file_ids)

    # Compute leaf IDs represented by the requested source_file_ids
    # If the selected inputs have overlapping lineage, it cannot be an idempotent repeat
    input_leaf_ids = set()
    has_overlap = False
    for fid in source_file_ids:
        f_obj = db.query(File).filter(File.id == fid, File.case_id == case_id).first()
        if f_obj:
            if getattr(f_obj, "is_merged", False):
                leaves = set(get_leaf_source_file_ids_for_merged(db, fid)) or {fid}
            else:
                leaves = {fid}
            if input_leaf_ids & leaves:
                has_overlap = True
            input_leaf_ids.update(leaves)

    if has_overlap:
        return None

    merged_files = (
        db.query(File)
        .filter(File.case_id == case_id, File.is_merged == True)
        .all()
    )

    # First check non-superseded active merged files
    for mf in merged_files:
        if mf.is_superseded:
            continue
        direct_sources = {
            s[0]
            for s in db.query(MergedFileSource.source_file_id)
            .filter(MergedFileSource.merged_file_id == mf.id)
            .all()
        }
        mf_leaves = set(get_leaf_source_file_ids_for_merged(db, mf.id)) or direct_sources

        if direct_sources == source_set or (input_leaf_ids and mf_leaves == input_leaf_ids):
            return mf

    # Fallback to any merged file matching either direct sources or leaf sources
    for mf in merged_files:
        direct_sources = {
            s[0]
            for s in db.query(MergedFileSource.source_file_id)
            .filter(MergedFileSource.merged_file_id == mf.id)
            .all()
        }
        mf_leaves = set(get_leaf_source_file_ids_for_merged(db, mf.id)) or direct_sources
        if direct_sources == source_set or (input_leaf_ids and mf_leaves == input_leaf_ids):
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
    document_type: str | None = None,
) -> list[int] | None:
    if file_ids is None:
        if document_type:
            query = db.query(File).filter(File.case_id == case_id)
            if hasattr(File, "document_type"):
                query = query.filter(File.document_type == document_type)
            case_files = query.filter(File.is_superseded == False).all()
            if not case_files:
                return []
            file_ids = [f.id for f in case_files]
        else:
            return None

    resolved: list[int] = []
    seen = set()
    queue = list(file_ids)

    while queue:
        fid = queue.pop(0)
        if fid in seen:
            continue
        seen.add(fid)

        query = db.query(File).filter(File.id == fid, File.case_id == case_id)
        if document_type and hasattr(File, "document_type"):
            query = query.filter(File.document_type == document_type)
        file_obj = query.first()
        if not file_obj:
            # If document_type filter is specified and file does not match, exclude it!
            if document_type:
                continue
            resolved.append(fid)
            continue

        if getattr(file_obj, "is_merged", False):
            sources = get_source_file_ids_for_merged(db, fid)
            if sources:
                for sid in sources:
                    if sid not in seen:
                        queue.append(sid)
            else:
                resolved.append(fid)
        else:
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